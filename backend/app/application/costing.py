from __future__ import annotations

from datetime import date, datetime, time, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.application.registry import serialize_instance
from app.domain.models import (
    AllocationResult,
    AllocationRule,
    AllocationRun,
    BatchTicket,
    CostObject,
    CostPeriod,
    CostPool,
    MarginSnapshot,
    PourRequest,
    ProductionLog,
    QuotationItem,
    SalesOrder,
    UnitCostSnapshot,
)

MONEY_PRECISION = Decimal("0.01")
QTY_PRECISION = Decimal("0.001")


def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


def _as_decimal(value: Decimal | float | int | str | None) -> Decimal:
    if value is None:
        return Decimal("0")
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _quantize_money(value: Decimal) -> Decimal:
    return value.quantize(MONEY_PRECISION, rounding=ROUND_HALF_UP)


def _quantize_qty(value: Decimal) -> Decimal:
    return value.quantize(QTY_PRECISION, rounding=ROUND_HALF_UP)


def _to_date(value: date | datetime | None) -> date | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    return value


def _period_range(period: CostPeriod) -> tuple[date, date]:
    start_date = _to_date(period.start_date)
    end_date = _to_date(period.end_date)
    if not start_date or not end_date:
        raise ValueError("Kỳ giá thành thiếu ngày bắt đầu/kết thúc")
    return start_date, end_date


def _get_cost_period(db: Session, organization_id: str, period_id: str) -> CostPeriod:
    period = db.get(CostPeriod, period_id)
    if not period or str(period.organization_id) != str(organization_id):
        raise ValueError("Kỳ giá thành không tồn tại")
    return period


def _sum_output_volume(db: Session, organization_id: str, period: CostPeriod) -> Decimal:
    start_date, end_date = _period_range(period)

    production_volume = (
        db.execute(
            select(func.coalesce(func.sum(ProductionLog.output_qty), 0))
            .where(ProductionLog.organization_id == organization_id)
            .where(ProductionLog.shift_date >= start_date)
            .where(ProductionLog.shift_date <= end_date)
        )
        .scalar_one()
    )
    production_total = _as_decimal(production_volume)
    if production_total > 0:
        return _quantize_qty(production_total)

    start_dt = datetime.combine(start_date, time.min).replace(tzinfo=timezone.utc)
    end_dt = datetime.combine(end_date, time.max).replace(tzinfo=timezone.utc)
    ticket_volume = (
        db.execute(
            select(func.coalesce(func.sum(BatchTicket.loaded_volume_m3), 0))
            .where(BatchTicket.organization_id == organization_id)
            .where(BatchTicket.load_completed_at >= start_dt)
            .where(BatchTicket.load_completed_at <= end_dt)
        )
        .scalar_one()
    )
    return _quantize_qty(_as_decimal(ticket_volume))


def _sum_runtime_minutes(db: Session, organization_id: str, period: CostPeriod) -> Decimal:
    start_date, end_date = _period_range(period)
    runtime = (
        db.execute(
            select(func.coalesce(func.sum(ProductionLog.runtime_minutes), 0))
            .where(ProductionLog.organization_id == organization_id)
            .where(ProductionLog.shift_date >= start_date)
            .where(ProductionLog.shift_date <= end_date)
        )
        .scalar_one()
    )
    return _as_decimal(runtime)


def _resolve_revenue_from_sales_order(db: Session, sales_order: SalesOrder | None) -> Decimal:
    if not sales_order or not sales_order.quotation_id:
        return Decimal("0")

    quotation_total = (
        db.execute(
            select(func.coalesce(func.sum(QuotationItem.total_amount), 0)).where(
                QuotationItem.quotation_id == sales_order.quotation_id
            )
        )
        .scalar_one()
    )
    return _quantize_money(_as_decimal(quotation_total))


def _resolve_volume_from_sales_order(db: Session, sales_order_id: str) -> Decimal:
    requested_volume = (
        db.execute(
            select(func.coalesce(func.sum(PourRequest.requested_volume_m3), 0)).where(
                PourRequest.sales_order_id == sales_order_id
            )
        )
        .scalar_one()
    )
    return _quantize_qty(_as_decimal(requested_volume))


def create_production_log(
    db: Session,
    *,
    organization_id: str,
    actor_user_id: str | None,
    period_id: str | None,
    plant_id: str | None,
    shift_date: date | None,
    log_type: str,
    production_line: str | None,
    material_id: str | None,
    concrete_product_id: str | None,
    input_qty: float | None,
    output_qty: float | None,
    runtime_minutes: int | None,
    downtime_minutes: int | None,
    electricity_kwh: float | None,
    labor_hours: float | None,
    maintenance_cost: float | None,
    note: str | None,
) -> dict[str, Any]:
    if period_id:
        _get_cost_period(db, organization_id, period_id)

    allowed_log_types = {"crushing", "batching", "production"}
    if log_type not in allowed_log_types:
        raise ValueError("Loại nhật ký sản xuất không hợp lệ")

    item = ProductionLog(
        organization_id=organization_id,
        period_id=period_id,
        plant_id=plant_id,
        shift_date=shift_date,
        log_type=log_type,
        production_line=production_line,
        material_id=material_id,
        concrete_product_id=concrete_product_id,
        input_qty=float(_quantize_qty(_as_decimal(input_qty))) if input_qty is not None else None,
        output_qty=float(_quantize_qty(_as_decimal(output_qty))) if output_qty is not None else None,
        runtime_minutes=runtime_minutes,
        downtime_minutes=downtime_minutes,
        electricity_kwh=float(_quantize_qty(_as_decimal(electricity_kwh))) if electricity_kwh is not None else None,
        labor_hours=float(_quantize_money(_as_decimal(labor_hours))) if labor_hours is not None else None,
        maintenance_cost=float(_quantize_money(_as_decimal(maintenance_cost))) if maintenance_cost is not None else None,
        note=note,
        status="posted",
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    return {"production_log": serialize_instance(item), "created_by": actor_user_id}


def list_production_logs(
    db: Session,
    *,
    organization_id: str,
    period_id: str | None,
    plant_id: str | None,
    skip: int,
    limit: int,
) -> list[dict[str, Any]]:
    query = select(ProductionLog).where(ProductionLog.organization_id == organization_id)
    if period_id:
        query = query.where(ProductionLog.period_id == period_id)
    if plant_id:
        query = query.where(ProductionLog.plant_id == plant_id)

    query = query.order_by(ProductionLog.shift_date.desc(), ProductionLog.created_at.desc()).offset(skip).limit(limit)
    items = db.execute(query).scalars().all()
    return [serialize_instance(item) for item in items]


def create_cost_pool(
    db: Session,
    *,
    organization_id: str,
    period_id: str,
    pool_code: str,
    pool_name: str,
    cost_type: str | None,
    amount: float,
    source_reference: str | None,
    note: str | None,
) -> dict[str, Any]:
    _get_cost_period(db, organization_id, period_id)

    amount_decimal = _quantize_money(_as_decimal(amount))
    if amount_decimal <= 0:
        raise ValueError("Giá trị cost pool phải lớn hơn 0")

    item = CostPool(
        organization_id=organization_id,
        period_id=period_id,
        pool_code=pool_code,
        pool_name=pool_name,
        cost_type=cost_type,
        amount=float(amount_decimal),
        source_reference=source_reference,
        note=note,
        status="active",
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    return {"cost_pool": serialize_instance(item)}


def create_allocation_rule(
    db: Session,
    *,
    organization_id: str,
    period_id: str,
    pool_id: str,
    cost_center_id: str | None,
    cost_object_id: str | None,
    basis_type: str,
    ratio_value: float | None,
    priority: int,
    note: str | None,
) -> dict[str, Any]:
    _get_cost_period(db, organization_id, period_id)

    pool = db.get(CostPool, pool_id)
    if not pool or str(pool.organization_id) != str(organization_id):
        raise ValueError("Cost pool không tồn tại")
    if str(pool.period_id) != str(period_id):
        raise ValueError("Cost pool không thuộc kỳ giá thành đã chọn")

    if cost_object_id:
        obj = db.get(CostObject, cost_object_id)
        if not obj or str(obj.organization_id) != str(organization_id):
            raise ValueError("Cost object không tồn tại")

    allowed_basis = {"manual_ratio", "volume_m3", "runtime_minutes"}
    if basis_type not in allowed_basis:
        raise ValueError("Basis type không hợp lệ")

    ratio_decimal = _as_decimal(ratio_value) if ratio_value is not None else None

    rule = AllocationRule(
        organization_id=organization_id,
        period_id=period_id,
        pool_id=pool_id,
        cost_center_id=cost_center_id,
        cost_object_id=cost_object_id,
        basis_type=basis_type,
        ratio_value=float(_quantize_qty(ratio_decimal)) if ratio_decimal is not None else None,
        priority=priority,
        note=note,
        status="active",
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)

    return {"allocation_rule": serialize_instance(rule)}


def run_allocation(
    db: Session,
    *,
    organization_id: str,
    period_id: str,
    actor_user_id: str | None,
    note: str | None,
) -> dict[str, Any]:
    period = _get_cost_period(db, organization_id, period_id)

    pools = (
        db.execute(
            select(CostPool)
            .where(CostPool.organization_id == organization_id)
            .where(CostPool.period_id == period_id)
            .where(CostPool.status == "active")
            .order_by(CostPool.pool_code.asc())
        )
        .scalars()
        .all()
    )

    rules = (
        db.execute(
            select(AllocationRule)
            .where(AllocationRule.organization_id == organization_id)
            .where(AllocationRule.period_id == period_id)
            .where(AllocationRule.status == "active")
            .order_by(AllocationRule.priority.asc(), AllocationRule.created_at.asc())
        )
        .scalars()
        .all()
    )

    run = AllocationRun(
        organization_id=organization_id,
        period_id=period_id,
        run_code=f"ALLOC-{period.period_code}-{uuid4().hex[:6].upper()}",
        status="running",
        run_by=actor_user_id,
        note=note,
    )
    db.add(run)
    db.flush()

    volume_basis = _sum_output_volume(db, organization_id, period)
    runtime_basis = _sum_runtime_minutes(db, organization_id, period)

    results: list[AllocationResult] = []
    total_allocated = Decimal("0")

    for pool in pools:
        pool_rules = [item for item in rules if str(item.pool_id) == str(pool.id)]
        if not pool_rules:
            continue

        weights: list[Decimal] = []
        for rule in pool_rules:
            basis_type = str(rule.basis_type or "manual_ratio")
            if basis_type == "manual_ratio":
                weight = _as_decimal(rule.ratio_value)
            elif basis_type == "volume_m3":
                weight = volume_basis
            elif basis_type == "runtime_minutes":
                weight = runtime_basis
            else:
                weight = Decimal("1")
            weights.append(weight if weight > 0 else Decimal("0"))

        total_weight = sum(weights, Decimal("0"))
        if total_weight <= 0:
            weights = [Decimal("1") for _ in pool_rules]
            total_weight = Decimal(len(pool_rules))

        pool_amount = _as_decimal(pool.amount)
        allocated_sum = Decimal("0")

        for idx, rule in enumerate(pool_rules):
            ratio = weights[idx] / total_weight if total_weight > 0 else Decimal("0")
            allocated_amount = _quantize_money(pool_amount * ratio)

            if idx == len(pool_rules) - 1:
                allocated_amount = _quantize_money(pool_amount - allocated_sum)

            allocated_sum += allocated_amount

            result = AllocationResult(
                organization_id=organization_id,
                allocation_run_id=run.id,
                pool_id=pool.id,
                rule_id=rule.id,
                cost_center_id=rule.cost_center_id,
                cost_object_id=rule.cost_object_id,
                basis_type=rule.basis_type,
                basis_value=float(_quantize_qty(weights[idx])) if weights[idx] else 0,
                allocated_amount=float(allocated_amount),
                detail_json={
                    "pool_code": pool.pool_code,
                    "pool_name": pool.pool_name,
                    "weight": float(_quantize_qty(weights[idx])) if weights[idx] else 0,
                    "total_weight": float(_quantize_qty(total_weight)) if total_weight else 0,
                },
            )
            db.add(result)
            results.append(result)
            total_allocated += allocated_amount

    run.status = "completed"
    run.finished_at = _utcnow()
    run.summary_json = {
        "period_id": period_id,
        "pool_count": len(pools),
        "rule_count": len(rules),
        "result_count": len(results),
        "total_allocated": float(_quantize_money(total_allocated)),
        "volume_basis_m3": float(_quantize_qty(volume_basis)),
        "runtime_basis_minutes": float(_quantize_qty(runtime_basis)),
    }

    db.add(run)
    db.commit()
    db.refresh(run)
    for item in results:
        db.refresh(item)

    return {
        "allocation_run": serialize_instance(run),
        "results": [serialize_instance(item) for item in results],
    }


def get_allocation_run(
    db: Session,
    *,
    organization_id: str,
    allocation_run_id: str,
) -> dict[str, Any]:
    run = db.get(AllocationRun, allocation_run_id)
    if not run or str(run.organization_id) != str(organization_id):
        raise ValueError("Allocation run không tồn tại")

    results = (
        db.execute(
            select(AllocationResult)
            .where(AllocationResult.allocation_run_id == allocation_run_id)
            .order_by(AllocationResult.created_at.asc())
        )
        .scalars()
        .all()
    )

    return {
        "allocation_run": serialize_instance(run),
        "results": [serialize_instance(item) for item in results],
    }


def create_unit_cost_snapshot(
    db: Session,
    *,
    organization_id: str,
    period_id: str,
    actor_user_id: str | None,
    concrete_product_id: str | None,
    source_run_id: str | None,
    output_volume_m3: float | None,
    total_cost: float | None,
    note: str | None,
) -> dict[str, Any]:
    period = _get_cost_period(db, organization_id, period_id)

    selected_run: AllocationRun | None = None
    if source_run_id:
        selected_run = db.get(AllocationRun, source_run_id)
        if not selected_run or str(selected_run.organization_id) != str(organization_id):
            raise ValueError("Allocation run không tồn tại")
        if str(selected_run.period_id) != str(period_id):
            raise ValueError("Allocation run không thuộc kỳ giá thành đã chọn")

    total_cost_decimal = _as_decimal(total_cost) if total_cost is not None else None
    if total_cost_decimal is None:
        if selected_run:
            allocated = (
                db.execute(
                    select(func.coalesce(func.sum(AllocationResult.allocated_amount), 0)).where(
                        AllocationResult.allocation_run_id == selected_run.id
                    )
                )
                .scalar_one()
            )
            total_cost_decimal = _as_decimal(allocated)
        else:
            latest_run = (
                db.execute(
                    select(AllocationRun)
                    .where(AllocationRun.organization_id == organization_id)
                    .where(AllocationRun.period_id == period_id)
                    .where(AllocationRun.status == "completed")
                    .order_by(AllocationRun.finished_at.desc(), AllocationRun.created_at.desc())
                )
                .scalars()
                .first()
            )
            if latest_run:
                allocated = (
                    db.execute(
                        select(func.coalesce(func.sum(AllocationResult.allocated_amount), 0)).where(
                            AllocationResult.allocation_run_id == latest_run.id
                        )
                    )
                    .scalar_one()
                )
                total_cost_decimal = _as_decimal(allocated)
                selected_run = latest_run
            else:
                total_cost_decimal = Decimal("0")

    volume_decimal = _as_decimal(output_volume_m3) if output_volume_m3 is not None else _sum_output_volume(db, organization_id, period)
    volume_decimal = _quantize_qty(volume_decimal)

    total_cost_decimal = _quantize_money(total_cost_decimal)
    unit_cost = _quantize_money(total_cost_decimal / volume_decimal) if volume_decimal > 0 else Decimal("0")

    snapshot = UnitCostSnapshot(
        organization_id=organization_id,
        period_id=period_id,
        concrete_product_id=concrete_product_id,
        snapshot_code=f"UC-{period.period_code}-{uuid4().hex[:6].upper()}",
        output_volume_m3=float(volume_decimal),
        total_cost=float(total_cost_decimal),
        unit_cost=float(unit_cost),
        source_run_id=selected_run.id if selected_run else None,
        snapshot_json={
            "volume_m3": float(volume_decimal),
            "total_cost": float(total_cost_decimal),
            "source_run_id": selected_run.id if selected_run else None,
        },
        status="draft",
        note=note,
        closed_by=actor_user_id,
    )

    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)

    return {"unit_cost_snapshot": serialize_instance(snapshot)}


def list_unit_cost_snapshots(
    db: Session,
    *,
    organization_id: str,
    period_id: str | None,
    skip: int,
    limit: int,
) -> list[dict[str, Any]]:
    query = select(UnitCostSnapshot).where(UnitCostSnapshot.organization_id == organization_id)
    if period_id:
        query = query.where(UnitCostSnapshot.period_id == period_id)
    query = query.order_by(UnitCostSnapshot.created_at.desc()).offset(skip).limit(limit)

    items = db.execute(query).scalars().all()
    return [serialize_instance(item) for item in items]


def create_margin_snapshot(
    db: Session,
    *,
    organization_id: str,
    period_id: str,
    actor_user_id: str | None,
    sales_order_id: str | None,
    concrete_product_id: str | None,
    delivered_volume_m3: float | None,
    revenue_amount: float | None,
    cost_amount: float | None,
    note: str | None,
) -> dict[str, Any]:
    period = _get_cost_period(db, organization_id, period_id)

    sales_order: SalesOrder | None = None
    if sales_order_id:
        sales_order = db.get(SalesOrder, sales_order_id)
        if not sales_order or str(sales_order.organization_id) != str(organization_id):
            raise ValueError("Sales order không tồn tại")

    revenue_decimal = _as_decimal(revenue_amount) if revenue_amount is not None else _resolve_revenue_from_sales_order(db, sales_order)

    volume_decimal = _as_decimal(delivered_volume_m3)
    if delivered_volume_m3 is None and sales_order_id:
        volume_decimal = _resolve_volume_from_sales_order(db, sales_order_id)
    volume_decimal = _quantize_qty(volume_decimal)

    derived_cost = _as_decimal(cost_amount) if cost_amount is not None else None
    if derived_cost is None:
        latest_unit_cost = (
            db.execute(
                select(UnitCostSnapshot)
                .where(UnitCostSnapshot.organization_id == organization_id)
                .where(UnitCostSnapshot.period_id == period_id)
                .order_by(UnitCostSnapshot.created_at.desc())
            )
            .scalars()
            .first()
        )
        unit_cost = _as_decimal(latest_unit_cost.unit_cost) if latest_unit_cost else Decimal("0")
        derived_cost = _quantize_money(unit_cost * volume_decimal)

    revenue_decimal = _quantize_money(revenue_decimal)
    derived_cost = _quantize_money(derived_cost)

    margin_amount = _quantize_money(revenue_decimal - derived_cost)
    margin_pct = Decimal("0")
    if revenue_decimal > 0:
        margin_pct = _quantize_qty((margin_amount / revenue_decimal) * Decimal("100"))

    snapshot = MarginSnapshot(
        organization_id=organization_id,
        period_id=period_id,
        snapshot_code=f"MG-{period.period_code}-{uuid4().hex[:6].upper()}",
        sales_order_id=sales_order_id,
        customer_id=sales_order.customer_id if sales_order else None,
        site_id=sales_order.site_id if sales_order else None,
        concrete_product_id=concrete_product_id,
        delivered_volume_m3=float(volume_decimal) if volume_decimal else 0,
        revenue_amount=float(revenue_decimal),
        cost_amount=float(derived_cost),
        margin_amount=float(margin_amount),
        margin_pct=float(margin_pct),
        snapshot_json={
            "sales_order_id": sales_order_id,
            "period_id": period_id,
            "delivered_volume_m3": float(volume_decimal),
        },
        generated_by=actor_user_id,
        note=note,
    )

    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)

    return {"margin_snapshot": serialize_instance(snapshot)}


def list_margin_snapshots(
    db: Session,
    *,
    organization_id: str,
    period_id: str | None,
    skip: int,
    limit: int,
) -> list[dict[str, Any]]:
    query = select(MarginSnapshot).where(MarginSnapshot.organization_id == organization_id)
    if period_id:
        query = query.where(MarginSnapshot.period_id == period_id)
    query = query.order_by(MarginSnapshot.created_at.desc()).offset(skip).limit(limit)

    items = db.execute(query).scalars().all()
    return [serialize_instance(item) for item in items]
