from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.router import api_router
from app.core.audit_middleware import AuditLogMiddleware
from app.core.config import settings
from app.core.errors import api_error_handler, generic_error_handler
from app.core.logging import configure_logging
from app.core.middleware import RequestIDMiddleware
from app.core.sentry import initialize_sentry


@asynccontextmanager
async def lifespan(_: FastAPI):
    configure_logging()
    initialize_sentry()
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    openapi_url="/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(RequestIDMiddleware)
app.add_middleware(AuditLogMiddleware)
app.include_router(api_router)
app.add_exception_handler(Exception, generic_error_handler)
app.add_exception_handler(ValueError, api_error_handler)
