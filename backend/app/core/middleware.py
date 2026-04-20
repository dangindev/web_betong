import uuid
from collections import defaultdict, deque
from threading import Lock
from time import monotonic

from fastapi import Request, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):  # type: ignore[no-untyped-def]
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):  # type: ignore[no-untyped-def]
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        return response


class InMemoryRateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app,
        requests_per_minute: int = 1200,
        login_requests_per_minute: int = 120,
    ):
        super().__init__(app)
        self.requests_per_minute = max(1, requests_per_minute)
        self.login_requests_per_minute = max(1, login_requests_per_minute)
        self._request_times: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    @staticmethod
    def _client_ip(request: Request) -> str:
        forwarded_for = request.headers.get("x-forwarded-for", "")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip() or "unknown"
        if request.client and request.client.host:
            return request.client.host
        return "unknown"

    def _consume_slot(self, key: str, limit: int) -> tuple[bool, int]:
        now = monotonic()
        window_seconds = 60
        with self._lock:
            queue = self._request_times[key]
            while queue and now - queue[0] > window_seconds:
                queue.popleft()

            if len(queue) >= limit:
                retry_after = max(1, int(window_seconds - (now - queue[0])))
                return False, retry_after

            queue.append(now)
            return True, 0

    async def dispatch(self, request: Request, call_next):  # type: ignore[no-untyped-def]
        if not request.url.path.startswith("/api/"):
            return await call_next(request)

        ip = self._client_ip(request)

        accepted, retry_after = self._consume_slot(f"{ip}:global", self.requests_per_minute)
        if not accepted:
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={"detail": "Rate limit exceeded"},
                headers={"Retry-After": str(retry_after)},
            )

        if request.url.path == "/api/v1/auth/login":
            accepted, retry_after = self._consume_slot(f"{ip}:login", self.login_requests_per_minute)
            if not accepted:
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={"detail": "Rate limit exceeded for login"},
                    headers={"Retry-After": str(retry_after)},
                )

        return await call_next(request)
