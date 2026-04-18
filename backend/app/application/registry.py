from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import inspect

from app.domain.models import (
    Asset,
    Attachment,
    AuditLog,
    BusinessUnit,
    ConcreteProduct,
    Customer,
    CustomerContact,
    Employee,
    Material,
    MixDesign,
    MixDesignComponent,
    Organization,
    Permission,
    Plant,
    PlantLoadingBay,
    ProjectSite,
    Pump,
    Role,
    RolePermission,
    SiteAccessProfile,
    SystemSetting,
    User,
    UserRole,
    UserSession,
    Vehicle,
    VehicleType,
)

MODEL_REGISTRY = {
    "organizations": Organization,
    "business_units": BusinessUnit,
    "employees": Employee,
    "users": User,
    "roles": Role,
    "permissions": Permission,
    "role_permissions": RolePermission,
    "user_roles": UserRole,
    "user_sessions": UserSession,
    "customers": Customer,
    "customer_contacts": CustomerContact,
    "site_access_profiles": SiteAccessProfile,
    "project_sites": ProjectSite,
    "plants": Plant,
    "plant_loading_bays": PlantLoadingBay,
    "vehicle_types": VehicleType,
    "vehicles": Vehicle,
    "pumps": Pump,
    "assets": Asset,
    "materials": Material,
    "concrete_products": ConcreteProduct,
    "mix_designs": MixDesign,
    "mix_design_components": MixDesignComponent,
    "system_settings": SystemSetting,
    "audit_logs": AuditLog,
    "attachments": Attachment,
}

IMPORT_EXPORT_RESOURCES = {"customers", "project_sites", "vehicles", "materials"}


def allowed_columns(model: type) -> set[str]:
    mapper = inspect(model)
    return {column.key for column in mapper.columns}


def serialize_value(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    return value


def serialize_instance(instance: Any) -> dict[str, Any]:
    mapper = inspect(instance.__class__)
    payload: dict[str, Any] = {}
    for column in mapper.columns:
        payload[column.key] = serialize_value(getattr(instance, column.key))
    return payload
