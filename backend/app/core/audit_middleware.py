from __future__ import annotations

import json

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.auth import decode_token
from app.core.dependencies import bearer_token_from_headers
from app.domain.models import AuditLog
from app.infrastructure.db import SessionLocal


class AuditLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):  # type: ignore[no-untyped-def]
        body = await request.body()

        async def receive() -> dict[str, object]:
            return {"type": "http.request", "body": body, "more_body": False}

        request = Request(request.scope, receive)
        response = await call_next(request)

        if request.method in {"POST", "PUT", "PATCH", "DELETE"} and request.url.path.startswith(
            "/api/v1"
        ):
            user_id: str | None = None
            token = bearer_token_from_headers(dict(request.headers))
            if token:
                try:
                    payload = decode_token(token)
                    user_id = payload.get("sub")
                except Exception:  # noqa: BLE001
                    user_id = None

            request_body: dict | list | str | None
            try:
                request_body = json.loads(body.decode("utf-8")) if body else None
            except Exception:  # noqa: BLE001
                request_body = body.decode("utf-8", errors="ignore")

            db = SessionLocal()
            try:
                audit = AuditLog(
                    organization_id=None,
                    user_id=user_id,
                    entity_type=request.url.path,
                    entity_id=None,
                    action=request.method,
                    before_json=None,
                    after_json={"request_body": request_body, "status_code": response.status_code},
                    ip_address=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent"),
                    request_id=getattr(request.state, "request_id", None),
                )
                db.add(audit)
                db.commit()
            except Exception:  # noqa: BLE001
                db.rollback()
            finally:
                db.close()

        return response
