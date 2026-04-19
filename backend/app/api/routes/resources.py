from __future__ import annotations

from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.application.registry import MODEL_REGISTRY, allowed_columns, serialize_instance
from app.core.auth import hash_password
from app.core.dependencies import (
    apply_scope_filters,
    get_current_user,
    get_scope_context,
    payload_in_scope,
    row_in_scope,
    user_has_permission,
)
from app.domain.models import User
from app.infrastructure.db import get_db

router = APIRouter(prefix="/api/v1/resources", tags=["resources"])

ADMIN_RESOURCES = {
    "users",
    "roles",
    "permissions",
    "role_permissions",
    "user_roles",
    "user_sessions",
    "audit_logs",
    "system_settings",
}


APPEND_ONLY_RESOURCES = {"inventory_ledger_entries", "inventory_stock_takes", "allocation_results", "unit_cost_snapshots", "margin_snapshots"}



def _resolve_model(resource: str) -> type:
    model = MODEL_REGISTRY.get(resource)
    if not model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown resource")
    return model



def _module_for_resource(resource: str) -> str:
    return "admin" if resource in ADMIN_RESOURCES else resource



def _ensure_permission(db: Session, user: User, resource: str, action: str) -> None:
    module = _module_for_resource(resource)
    if not user_has_permission(db, user.id, module, action):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Missing permission {module}:{action}",
        )



def _ensure_scope_for_payload(
    db: Session,
    user: User,
    model: type,
    payload: dict[str, Any],
) -> None:
    scope = get_scope_context(db, user.id)
    if not payload_in_scope(model, payload, scope):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Payload outside assigned scope",
        )



def _ensure_scope_for_row(db: Session, user: User, model: type, row: Any) -> None:
    scope = get_scope_context(db, user.id)
    if not row_in_scope(model, row, scope):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Resource outside assigned scope",
        )



def _sanitize_payload(model: type, payload: dict[str, Any], for_update: bool = False) -> dict[str, Any]:
    allowed = allowed_columns(model)
    blocked = {"created_at", "updated_at"}
    if for_update:
        blocked.add("id")

    data = {k: v for k, v in payload.items() if k in allowed and k not in blocked}
    if not for_update and "id" in allowed and "id" not in data:
        data["id"] = str(uuid4())

    return data


@router.get("/{resource}")
def list_resources(
    resource: str,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, object]:
    model = _resolve_model(resource)
    _ensure_permission(db, current_user, resource, "read")

    scope = get_scope_context(db, current_user.id)
    scoped_base_query = apply_scope_filters(model, select(model), scope)

    query = scoped_base_query
    if "created_at" in allowed_columns(model):
        query = query.order_by(model.created_at.desc())
    query = query.offset(skip).limit(limit)

    rows = db.execute(query).scalars().all()
    total = db.execute(select(func.count()).select_from(scoped_base_query.subquery())).scalar_one()

    return {"items": [serialize_instance(item) for item in rows], "total": total}


@router.get("/{resource}/{item_id}")
def get_resource(
    resource: str,
    item_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    model = _resolve_model(resource)
    _ensure_permission(db, current_user, resource, "read")

    item = db.get(model, item_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource item not found")

    _ensure_scope_for_row(db, current_user, model, item)
    return serialize_instance(item)


@router.post("/{resource}")
def create_resource(
    resource: str,
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    model = _resolve_model(resource)
    _ensure_permission(db, current_user, resource, "write")

    if resource in APPEND_ONLY_RESOURCES:
        raise HTTPException(status_code=status.HTTP_405_METHOD_NOT_ALLOWED, detail="Resource chỉ cho phép ghi qua API nghiệp vụ chuyên biệt")

    data = _sanitize_payload(model, payload)
    if resource == "users" and "password" in payload and "password_hash" in allowed_columns(model):
        data["password_hash"] = hash_password(str(payload["password"]))

    _ensure_scope_for_payload(db, current_user, model, data)

    item = model(**data)
    db.add(item)
    db.commit()
    db.refresh(item)

    return serialize_instance(item)


@router.patch("/{resource}/{item_id}")
def update_resource(
    resource: str,
    item_id: str,
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    model = _resolve_model(resource)
    _ensure_permission(db, current_user, resource, "write")

    if resource in APPEND_ONLY_RESOURCES:
        raise HTTPException(status_code=status.HTTP_405_METHOD_NOT_ALLOWED, detail="Resource không cho phép cập nhật trực tiếp")

    item = db.get(model, item_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource item not found")

    _ensure_scope_for_row(db, current_user, model, item)

    data = _sanitize_payload(model, payload, for_update=True)
    if resource == "users" and "password" in payload and "password_hash" in allowed_columns(model):
        data["password_hash"] = hash_password(str(payload["password"]))

    scope_payload = data.copy()
    if hasattr(model, "business_unit_id"):
        scope_payload.setdefault("business_unit_id", getattr(item, "business_unit_id", None))
    for plant_column in ("plant_id", "home_plant_id", "default_plant_id"):
        if hasattr(model, plant_column):
            scope_payload.setdefault(plant_column, getattr(item, plant_column, None))

    _ensure_scope_for_payload(db, current_user, model, scope_payload)

    for key, value in data.items():
        setattr(item, key, value)

    db.add(item)
    db.commit()
    db.refresh(item)

    return serialize_instance(item)


@router.delete("/{resource}/{item_id}")
def delete_resource(
    resource: str,
    item_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    model = _resolve_model(resource)
    _ensure_permission(db, current_user, resource, "delete")

    if resource in APPEND_ONLY_RESOURCES:
        raise HTTPException(status_code=status.HTTP_405_METHOD_NOT_ALLOWED, detail="Resource không cho phép xóa trực tiếp")

    item = db.get(model, item_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource item not found")

    _ensure_scope_for_row(db, current_user, model, item)

    db.delete(item)
    db.commit()
    return {"status": "deleted"}
