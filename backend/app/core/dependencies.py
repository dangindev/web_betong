from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import false, select
from sqlalchemy.orm import Session

from app.core.auth import decode_token
from app.domain.models import Permission, Plant, Role, RolePermission, User, UserRole
from app.infrastructure.db import get_db

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


@dataclass(frozen=True)
class ScopeContext:
    is_sys_admin: bool
    business_unit_ids: set[str]
    plant_ids: set[str]


def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)) -> User:
    try:
        payload = decode_token(token)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    if payload.get("typ") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid access token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing subject")

    user = db.get(User, user_id)
    if not user or user.status != "active":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User inactive")

    return user


def get_user_roles(db: Session, user_id: str) -> list[str]:
    rows = db.execute(
        select(Role.code)
        .join(UserRole, UserRole.role_id == Role.id)
        .where(UserRole.user_id == user_id)
    ).all()
    return [row[0] for row in rows]


def get_scope_context(db: Session, user_id: str) -> ScopeContext:
    rows = db.execute(
        select(Role.code, UserRole.business_unit_id)
        .join(UserRole, UserRole.role_id == Role.id)
        .where(UserRole.user_id == user_id)
    ).all()

    role_codes = {row[0] for row in rows}
    business_unit_ids = {str(row[1]) for row in rows if row[1]}

    plant_ids: set[str] = set()
    if business_unit_ids:
        plant_rows = db.execute(
            select(Plant.id).where(Plant.business_unit_id.in_(sorted(business_unit_ids)))
        ).all()
        plant_ids = {str(row[0]) for row in plant_rows}

    return ScopeContext(
        is_sys_admin="SYS_ADMIN" in role_codes,
        business_unit_ids=business_unit_ids,
        plant_ids=plant_ids,
    )


def user_has_permission(db: Session, user_id: str, module_code: str, action_code: str) -> bool:
    role_codes = get_user_roles(db, user_id)
    if "SYS_ADMIN" in role_codes:
        return True

    permission_exists = db.execute(
        select(Permission.id)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .join(Role, Role.id == RolePermission.role_id)
        .join(UserRole, UserRole.role_id == Role.id)
        .where(UserRole.user_id == user_id)
        .where(Permission.module_code == module_code)
        .where(Permission.action_code == action_code)
    ).first()
    return permission_exists is not None


def _has_column(model: type, column_name: str) -> bool:
    return hasattr(model, column_name)


def apply_scope_filters(model: type, query, scope: ScopeContext):
    if scope.is_sys_admin:
        return query

    if _has_column(model, "business_unit_id"):
        if not scope.business_unit_ids:
            return query.where(false())
        return query.where(getattr(model, "business_unit_id").in_(sorted(scope.business_unit_ids)))

    for plant_column in ("plant_id", "home_plant_id", "default_plant_id", "assigned_plant_id"):
        if _has_column(model, plant_column):
            if not scope.plant_ids:
                return query.where(false())
            return query.where(getattr(model, plant_column).in_(sorted(scope.plant_ids)))

    return query


def payload_in_scope(model: type, payload: dict[str, Any], scope: ScopeContext) -> bool:
    if scope.is_sys_admin:
        return True

    if _has_column(model, "business_unit_id"):
        business_unit_id = payload.get("business_unit_id")
        return bool(business_unit_id) and str(business_unit_id) in scope.business_unit_ids

    referenced_plant_ids = {
        str(payload[column_name])
        for column_name in ("plant_id", "home_plant_id", "default_plant_id", "assigned_plant_id")
        if payload.get(column_name)
    }
    if referenced_plant_ids:
        return referenced_plant_ids.issubset(scope.plant_ids)

    return True


def row_in_scope(model: type, row: Any, scope: ScopeContext) -> bool:
    if scope.is_sys_admin:
        return True

    if _has_column(model, "business_unit_id"):
        business_unit_id = getattr(row, "business_unit_id", None)
        return bool(business_unit_id) and str(business_unit_id) in scope.business_unit_ids

    row_plant_ids = {
        str(getattr(row, column_name))
        for column_name in ("plant_id", "home_plant_id", "default_plant_id", "assigned_plant_id")
        if getattr(row, column_name, None)
    }
    if row_plant_ids:
        return not row_plant_ids.isdisjoint(scope.plant_ids)

    return True


def require_permission(module_code: str, action_code: str):
    def _checker(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        if not user_has_permission(db, current_user.id, module_code, action_code):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing permission {module_code}:{action_code}",
            )
        return current_user

    return _checker


def bearer_token_from_headers(headers: dict[str, Any]) -> str | None:
    auth = headers.get("authorization")
    if not auth:
        return None
    parts = auth.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1]
