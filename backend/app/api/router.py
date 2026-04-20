from fastapi import APIRouter

from app.api.routes.auth import router as auth_router
from app.api.routes.costing import router as costing_router
from app.api.routes.dispatch import router as dispatch_router
from app.api.routes.health import router as health_router
from app.api.routes.integration import router as integration_router
from app.api.routes.inventory import router as inventory_router
from app.api.routes.pricing import router as pricing_router
from app.api.routes.resources import router as resources_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(resources_router)
api_router.include_router(integration_router)
api_router.include_router(pricing_router)
api_router.include_router(dispatch_router)
api_router.include_router(inventory_router)

api_router.include_router(costing_router)
