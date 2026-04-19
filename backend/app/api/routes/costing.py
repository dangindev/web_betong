from __future__ import annotations

from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.application.costing import (
    create_allocation_rule,
    create_cost_pool,
    create_margin_snapshot,
    create_production_log,
    create_unit_cost_snapshot,
    get_allocation_run,
    list_margin_snapshots,
    list_production_logs,
    list_unit_cost_snapshots,
    run_allocation,
)
from app.core.dependencies import get_current_user, user_has_permission
from app.domain.models import User
from app.infrastructure.db import get_db

router = APIRouter(prefix="/api/v1/costing", tags=["costing"])


class ProductionLogCreateRequest(BaseModel):
    organization_id: str
    period_id: str | None = None
    plant_id: str | None = None
    shift_date: date | None = None
    log_type: str = "batching"
    production_line: str | None = None
    material_id: str | None = None
    concrete_product_id: str | None = None
    input_qty: float | None = None
    output_qty: float | None = None
    runtime_minutes: int | None = None
    downtime_minutes: int | None = None
    electricity_kwh: float | None = None
    labor_hours: float | None = None
    maintenance_cost: float | None = None
    note: str | None = None


class CostPoolCreateRequest(BaseModel):
    organization_id: str
    period_id: str
    pool_code: str
    pool_name: str
    cost_type: str | None = None
    amount: float
    source_reference: str | None = None
    note: str | None = None


class AllocationRuleCreateRequest(BaseModel):
    organization_id: str
    period_id: str
    pool_id: str
    cost_center_id: str | None = None
    cost_object_id: str | None = None
    basis_type: str = "manual_ratio"
    ratio_value: float | None = None
    priority: int = 100
    note: str | None = None


class RunAllocationRequest(BaseModel):
    organization_id: str
    period_id: str
    note: str | None = None


class UnitCostSnapshotCreateRequest(BaseModel):
    organization_id: str
    period_id: str
    concrete_product_id: str | None = None
    source_run_id: str | None = None
    output_volume_m3: float | None = None
    total_cost: float | None = None
    note: str | None = None


class MarginSnapshotCreateRequest(BaseModel):
    organization_id: str
    period_id: str
    sales_order_id: str | None = None
    concrete_product_id: str | None = None
    delivered_volume_m3: float | None = None
    revenue_amount: float | None = None
    cost_amount: float | None = None
    note: str | None = None


def _has_any_permission(db: Session, user: User, modules: list[str], action: str) -> bool:
    for module in modules:
        if user_has_permission(db, user.id, module, action):
            return True
    if action == "read":
        for module in modules:
            if user_has_permission(db, user.id, module, "write"):
                return True
    return False


def _ensure_costing_permission(db: Session, user: User, action: str) -> None:
    modules = ["costing", "cost_periods", "cost_centers", "cost_objects", "sales_orders"]
    if not _has_any_permission(db, user, modules, action):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Thiếu quyền thao tác phase 5")


def _raise_service_error(exc: ValueError) -> None:
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/production-logs")
def create_phase5_production_log(
    payload: ProductionLogCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    _ensure_costing_permission(db, current_user, "write")
    try:
        return create_production_log(
            db,
            organization_id=payload.organization_id,
            actor_user_id=current_user.id,
            period_id=payload.period_id,
            plant_id=payload.plant_id,
            shift_date=payload.shift_date,
            log_type=payload.log_type,
            production_line=payload.production_line,
            material_id=payload.material_id,
            concrete_product_id=payload.concrete_product_id,
            input_qty=payload.input_qty,
            output_qty=payload.output_qty,
            runtime_minutes=payload.runtime_minutes,
            downtime_minutes=payload.downtime_minutes,
            electricity_kwh=payload.electricity_kwh,
            labor_hours=payload.labor_hours,
            maintenance_cost=payload.maintenance_cost,
            note=payload.note,
        )
    except ValueError as exc:
        _raise_service_error(exc)


@router.get("/production-logs")
def get_phase5_production_logs(
    organization_id: str = Query(...),
    period_id: str | None = Query(default=None),
    plant_id: str | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    _ensure_costing_permission(db, current_user, "read")
    return {
        "items": list_production_logs(
            db,
            organization_id=organization_id,
            period_id=period_id,
            plant_id=plant_id,
            skip=skip,
            limit=limit,
        )
    }


@router.post("/cost-pools")
def create_phase5_cost_pool(
    payload: CostPoolCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    _ensure_costing_permission(db, current_user, "write")
    try:
        return create_cost_pool(
            db,
            organization_id=payload.organization_id,
            period_id=payload.period_id,
            pool_code=payload.pool_code,
            pool_name=payload.pool_name,
            cost_type=payload.cost_type,
            amount=payload.amount,
            source_reference=payload.source_reference,
            note=payload.note,
        )
    except ValueError as exc:
        _raise_service_error(exc)


@router.post("/allocation-rules")
def create_phase5_allocation_rule(
    payload: AllocationRuleCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    _ensure_costing_permission(db, current_user, "write")
    try:
        return create_allocation_rule(
            db,
            organization_id=payload.organization_id,
            period_id=payload.period_id,
            pool_id=payload.pool_id,
            cost_center_id=payload.cost_center_id,
            cost_object_id=payload.cost_object_id,
            basis_type=payload.basis_type,
            ratio_value=payload.ratio_value,
            priority=payload.priority,
            note=payload.note,
        )
    except ValueError as exc:
        _raise_service_error(exc)


@router.post("/allocation-runs")
def run_phase5_allocation(
    payload: RunAllocationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    _ensure_costing_permission(db, current_user, "write")
    try:
        return run_allocation(
            db,
            organization_id=payload.organization_id,
            period_id=payload.period_id,
            actor_user_id=current_user.id,
            note=payload.note,
        )
    except ValueError as exc:
        _raise_service_error(exc)


@router.get("/allocation-runs/{allocation_run_id}")
def get_phase5_allocation_run(
    allocation_run_id: str,
    organization_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    _ensure_costing_permission(db, current_user, "read")
    try:
        return get_allocation_run(
            db,
            organization_id=organization_id,
            allocation_run_id=allocation_run_id,
        )
    except ValueError as exc:
        _raise_service_error(exc)


@router.post("/unit-cost-snapshots")
def create_phase5_unit_cost_snapshot(
    payload: UnitCostSnapshotCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    _ensure_costing_permission(db, current_user, "write")
    try:
        return create_unit_cost_snapshot(
            db,
            organization_id=payload.organization_id,
            period_id=payload.period_id,
            actor_user_id=current_user.id,
            concrete_product_id=payload.concrete_product_id,
            source_run_id=payload.source_run_id,
            output_volume_m3=payload.output_volume_m3,
            total_cost=payload.total_cost,
            note=payload.note,
        )
    except ValueError as exc:
        _raise_service_error(exc)


@router.get("/unit-cost-snapshots")
def get_phase5_unit_cost_snapshots(
    organization_id: str = Query(...),
    period_id: str | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    _ensure_costing_permission(db, current_user, "read")
    return {
        "items": list_unit_cost_snapshots(
            db,
            organization_id=organization_id,
            period_id=period_id,
            skip=skip,
            limit=limit,
        )
    }


@router.post("/margin-snapshots")
def create_phase5_margin_snapshot(
    payload: MarginSnapshotCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    _ensure_costing_permission(db, current_user, "write")
    try:
        return create_margin_snapshot(
            db,
            organization_id=payload.organization_id,
            period_id=payload.period_id,
            actor_user_id=current_user.id,
            sales_order_id=payload.sales_order_id,
            concrete_product_id=payload.concrete_product_id,
            delivered_volume_m3=payload.delivered_volume_m3,
            revenue_amount=payload.revenue_amount,
            cost_amount=payload.cost_amount,
            note=payload.note,
        )
    except ValueError as exc:
        _raise_service_error(exc)


@router.get("/margin-snapshots")
def get_phase5_margin_snapshots(
    organization_id: str = Query(...),
    period_id: str | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    _ensure_costing_permission(db, current_user, "read")
    return {
        "items": list_margin_snapshots(
            db,
            organization_id=organization_id,
            period_id=period_id,
            skip=skip,
            limit=limit,
        )
    }
