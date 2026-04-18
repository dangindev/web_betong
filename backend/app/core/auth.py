from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def _create_token(payload: dict[str, Any], expires_delta: timedelta) -> str:
    now = datetime.now(tz=timezone.utc)
    to_encode = payload.copy()
    to_encode.update({"iat": now, "exp": now + expires_delta})
    return jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_access_token(payload: dict[str, Any]) -> str:
    return _create_token(payload, timedelta(minutes=settings.access_token_exp_minutes))


def create_refresh_token(payload: dict[str, Any]) -> str:
    return _create_token(payload, timedelta(days=settings.refresh_token_exp_days))


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
