from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_refresh_token,
    verify_password,
)
from app.core.dependencies import get_current_user
from app.domain.models import Permission, Role, RolePermission, User, UserRole, UserSession
from app.infrastructure.db import get_db

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


def _roles_for_user(db: Session, user_id: str) -> list[str]:
    rows = db.execute(
        select(Role.code)
        .join(UserRole, UserRole.role_id == Role.id)
        .where(UserRole.user_id == user_id)
    ).all()
    return [row[0] for row in rows]


def _permissions_for_user(db: Session, user_id: str) -> list[str]:
    rows = db.execute(
        select(Permission.module_code, Permission.action_code)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .join(Role, Role.id == RolePermission.role_id)
        .join(UserRole, UserRole.role_id == Role.id)
        .where(UserRole.user_id == user_id)
    ).all()
    return [f"{row[0]}:{row[1]}" for row in rows]


def _utc_now_matching_timezone(reference: datetime | None) -> datetime:
    if reference is None:
        return datetime.now(tz=timezone.utc)
    if reference.tzinfo is None:
        return datetime.utcnow()
    return datetime.now(tz=timezone.utc)


@router.post("/login")
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)) -> dict[str, object]:
    user = db.execute(select(User).where(User.username == payload.username)).scalar_one_or_none()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if user.status != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User inactive")

    roles = _roles_for_user(db, user.id)
    permissions = _permissions_for_user(db, user.id)

    session_id = str(uuid4())
    access_token = create_access_token(
        {
            "typ": "access",
            "sub": user.id,
            "username": user.username,
            "roles": roles,
            "permissions": permissions,
            "sid": session_id,
        }
    )
    refresh_token = create_refresh_token(
        {
            "typ": "refresh",
            "sub": user.id,
            "sid": session_id,
        }
    )

    session = UserSession(
        id=session_id,
        user_id=user.id,
        refresh_token_hash=hash_refresh_token(refresh_token),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        expires_at=datetime.now(tz=timezone.utc) + timedelta(days=14),
        revoked_at=None,
    )
    db.add(session)

    user.last_login_at = datetime.now(tz=timezone.utc)
    db.add(user)
    db.commit()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "email": user.email,
            "roles": roles,
            "permissions": permissions,
        },
    }


@router.post("/refresh")
def refresh_tokens(payload: RefreshRequest, db: Session = Depends(get_db)) -> dict[str, str]:
    try:
        token_payload = decode_token(payload.refresh_token)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token") from exc

    if token_payload.get("typ") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token type")

    session_id = token_payload.get("sid")
    user_id = token_payload.get("sub")
    if not session_id or not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Malformed refresh token")

    session = db.get(UserSession, session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session not found")

    if session.revoked_at is not None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session revoked")

    if session.expires_at < _utc_now_matching_timezone(session.expires_at):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")

    if session.refresh_token_hash != hash_refresh_token(payload.refresh_token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token mismatch")

    user = db.get(User, user_id)
    if not user or user.status != "active":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User inactive")

    roles = _roles_for_user(db, user.id)
    permissions = _permissions_for_user(db, user.id)

    session.revoked_at = _utc_now_matching_timezone(session.expires_at)
    db.add(session)

    new_session_id = str(uuid4())
    access_token = create_access_token(
        {
            "typ": "access",
            "sub": user.id,
            "username": user.username,
            "roles": roles,
            "permissions": permissions,
            "sid": new_session_id,
        }
    )
    refresh_token = create_refresh_token(
        {
            "typ": "refresh",
            "sub": user.id,
            "sid": new_session_id,
        }
    )

    new_session = UserSession(
        id=new_session_id,
        user_id=user.id,
        refresh_token_hash=hash_refresh_token(refresh_token),
        expires_at=datetime.now(tz=timezone.utc) + timedelta(days=14),
    )
    db.add(new_session)
    db.commit()

    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}


@router.post("/logout")
def logout(payload: LogoutRequest, db: Session = Depends(get_db)) -> dict[str, str]:
    try:
        token_payload = decode_token(payload.refresh_token)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token") from exc

    session_id = token_payload.get("sid")
    if not session_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Malformed refresh token")

    session = db.get(UserSession, session_id)
    if session and session.revoked_at is None:
        session.revoked_at = _utc_now_matching_timezone(session.expires_at)
        db.add(session)
        db.commit()

    return {"status": "ok"}


@router.get("/me")
def me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict[str, object]:
    return {
        "id": current_user.id,
        "username": current_user.username,
        "full_name": current_user.full_name,
        "email": current_user.email,
        "roles": _roles_for_user(db, current_user.id),
        "permissions": _permissions_for_user(db, current_user.id),
    }
