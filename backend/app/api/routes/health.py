from fastapi import APIRouter

from app.core.config import settings

router = APIRouter(tags=["health"])


@router.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name, "env": settings.app_env}


@router.get("/readyz")
def readyz() -> dict[str, str]:
    return {"status": "ready", "service": settings.app_name, "version": settings.app_version}
