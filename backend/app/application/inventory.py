from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.application.registry import serialize_instance
from app.domain.models import (
    CostPeriod,
    InventoryLedgerEntry,
    InventoryStockTake,
    Material,
    UnitCostSnapshot,
    Warehouse,
)


QTY_PRECISION = Decimal("0.001")
COST_PRECISION = Decimal("0.01")


def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


def _as_decimal(value: Decimal | float | int | str | None) -> Decimal:
    if value is None:
        return Decimal("0")
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _quantize_qty(value: Decimal) -> Decimal:
    return value.quantize(QTY_PRECISION, rounding=ROUND_HALF_UP)


def _quantize_cost(value: Decimal) -> Decimal:
    return value.quantize(COST_PRECISION, rounding=ROUND_HALF_UP)


def _to_date(value: date | datetime | None) -> date | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    return value


def _in_period_range(target_date: date | None, start_date: date | None, end_date: date | None) -> bool:
    if not target_date or not start_date or not end_date:
        return False
    return start_date <= target_date <= end_date


def _get_warehouse(db: Session, organization_id: str, warehouse_id: str) -> Warehouse:
    warehouse = db.get(Warehouse, warehouse_id)
    if not warehouse or str(warehouse.organization_id) != str(organization_id):
        raise ValueError("Kho không tồn tại")
    return warehouse


def _get_material(db: Session, material_id: str) -> Material:
    material = db.get(Material, material_id)
    if not material:
        raise ValueError("Vật tư không tồn tại")
    return material


def _get_cost_period(db: Session, organization_id: str, period_id: str) -> CostPeriod:
    period = db.get(CostPeriod, period_id)
    if not period or str(period.organization_id) != str(organization_id):
        raise ValueError("Kỳ giá thành không tồn tại")
    return period


def _resolve_cost_period_id(
    db: Session,
    organization_id: str,
    transaction_at: datetime,
    period_id: str | None,
) -> str | None:
    if period_id:
        _get_cost_period(db, organization_id, period_id)
        return period_id

    tx_date = transaction_at.date()
    period = (
        db.execute(
            select(CostPeriod)
            .where(CostPeriod.organization_id == organization_id)
            .where(CostPeriod.status == "open")
            .order_by(CostPeriod.start_date.desc())
        )
        .scalars()
        .first()
    )

    if period and _in_period_range(tx_date, _to_date(period.start_date), _to_date(period.end_date)):
        return period.id
    return None


def get_inventory_balance(
    db: Session,
    organization_id: str,
    warehouse_id: str,
    material_id: str,
) -> Decimal:
    rows = (
        db.execute(
            select(InventoryLedgerEntry.quantity_in, InventoryLedgerEntry.quantity_out)
            .where(InventoryLedgerEntry.organization_id == organization_id)
            .where(InventoryLedgerEntry.warehouse_id == warehouse_id)
            .where(InventoryLedgerEntry.material_id == material_id)
        )
        .all()
    )

    total = Decimal("0")
    for quantity_in, quantity_out in rows:
        total += _as_decimal(quantity_in) - _as_decimal(quantity_out)
    return _quantize_qty(total)


def _build_ledger_entry(
    *,
    organization_id: str,
    warehouse: Warehouse,
    material_id: str,
    movement_type: str,
    quantity_in: Decimal,
    quantity_out: Decimal,
    unit_cost: Decimal | None,
    reference_no: str | None,
    source_document_type: str | None,
    source_document_id: str | None,
    note: str | None,
    transaction_at: datetime,
    period_id: str | None,
    actor_user_id: str | None,
) -> InventoryLedgerEntry:
    quantity_for_cost = quantity_in if quantity_in > 0 else quantity_out
    total_cost = (
        _quantize_cost(unit_cost * quantity_for_cost) if unit_cost is not None and quantity_for_cost > 0 else None
    )

    return InventoryLedgerEntry(
        organization_id=organization_id,
        business_unit_id=warehouse.business_unit_id,
        plant_id=warehouse.plant_id,
        warehouse_id=warehouse.id,
        material_id=material_id,
        movement_type=movement_type,
        quantity_in=float(_quantize_qty(quantity_in)) if quantity_in > 0 else 0,
        quantity_out=float(_quantize_qty(quantity_out)) if quantity_out > 0 else 0,
        unit_cost=float(_quantize_cost(unit_cost)) if unit_cost is not None else None,
        total_cost=float(total_cost) if total_cost is not None else None,
        reference_no=reference_no,
        source_document_type=source_document_type,
        source_document_id=source_document_id,
        note=note,
        transaction_at=transaction_at,
        period_id=period_id,
        created_by=actor_user_id,
    )


def list_inventory_balances(
    db: Session,
    organization_id: str,
    warehouse_id: str | None = None,
    material_id: str | None = None,
) -> list[dict[str, Any]]:
    query = select(InventoryLedgerEntry).where(InventoryLedgerEntry.organization_id == organization_id)
    if warehouse_id:
        query = query.where(InventoryLedgerEntry.warehouse_id == warehouse_id)
    if material_id:
        query = query.where(InventoryLedgerEntry.material_id == material_id)

    entries = db.execute(query).scalars().all()

    balances: dict[tuple[str, str], Decimal] = defaultdict(lambda: Decimal("0"))
    last_transaction_at: dict[tuple[str, str], datetime | None] = {}

    for entry in entries:
        key = (str(entry.warehouse_id), str(entry.material_id))
        balances[key] += _as_decimal(entry.quantity_in) - _as_decimal(entry.quantity_out)
        current_last = last_transaction_at.get(key)
        if entry.transaction_at and (current_last is None or entry.transaction_at > current_last):
            last_transaction_at[key] = entry.transaction_at

    warehouse_ids = sorted({key[0] for key in balances})
    material_ids = sorted({key[1] for key in balances})

    warehouse_map = {
        warehouse.id: warehouse
        for warehouse in db.execute(select(Warehouse).where(Warehouse.id.in_(warehouse_ids))).scalars().all()
    }
    material_map = {
        material.id: material
        for material in db.execute(select(Material).where(Material.id.in_(material_ids))).scalars().all()
    }

    items: list[dict[str, Any]] = []
    for key, balance in balances.items():
        warehouse = warehouse_map.get(key[0])
        material = material_map.get(key[1])
        items.append(
            {
                "warehouse_id": key[0],
                "warehouse_code": warehouse.code if warehouse else None,
                "warehouse_name": warehouse.name if warehouse else None,
                "material_id": key[1],
                "material_code": material.code if material else None,
                "material_name": material.name if material else None,
                "available_qty": float(_quantize_qty(balance)),
                "last_transaction_at": last_transaction_at.get(key).isoformat() if last_transaction_at.get(key) else None,
            }
        )

    items.sort(
        key=lambda item: (
            str(item.get("warehouse_name") or ""),
            str(item.get("material_name") or ""),
        )
    )
    return items


def post_inventory_movement(
    db: Session,
    *,
    organization_id: str,
    actor_user_id: str | None,
    movement_type: str,
    warehouse_id: str,
    material_id: str,
    quantity: float | None,
    quantity_delta: float | None,
    destination_warehouse_id: str | None,
    unit_cost: float | None,
    reference_no: str | None,
    source_document_type: str | None,
    source_document_id: str | None,
    note: str | None,
    transaction_at: datetime | None,
    period_id: str | None,
) -> dict[str, Any]:
    allowed_types = {"receipt", "issue", "transfer", "adjustment", "waste"}
    if movement_type not in allowed_types:
        raise ValueError("Nghiệp vụ kho không hợp lệ")

    source_warehouse = _get_warehouse(db, organization_id, warehouse_id)
    _get_material(db, material_id)

    tx_time = transaction_at or _utcnow()
    effective_period_id = _resolve_cost_period_id(db, organization_id, tx_time, period_id)
    unit_cost_decimal = _as_decimal(unit_cost) if unit_cost is not None else None

    entries: list[InventoryLedgerEntry] = []
    touched_warehouses: set[str] = {source_warehouse.id}

    if movement_type == "adjustment":
        delta = _as_decimal(quantity_delta)
        if delta == 0:
            raise ValueError("Điều chỉnh phải có quantity_delta khác 0")

        if delta < 0:
            available = get_inventory_balance(db, organization_id, source_warehouse.id, material_id)
            needed = abs(delta)
            if available < needed:
                raise ValueError(f"Không đủ tồn kho để điều chỉnh giảm. Tồn hiện tại: {float(available)}")
            quantity_in = Decimal("0")
            quantity_out = needed
            movement_name = "adjustment_loss"
        else:
            quantity_in = delta
            quantity_out = Decimal("0")
            movement_name = "adjustment_gain"

        entries.append(
            _build_ledger_entry(
                organization_id=organization_id,
                warehouse=source_warehouse,
                material_id=material_id,
                movement_type=movement_name,
                quantity_in=quantity_in,
                quantity_out=quantity_out,
                unit_cost=unit_cost_decimal,
                reference_no=reference_no,
                source_document_type=source_document_type,
                source_document_id=source_document_id,
                note=note,
                transaction_at=tx_time,
                period_id=effective_period_id,
                actor_user_id=actor_user_id,
            )
        )

    else:
        qty = _as_decimal(quantity)
        if qty <= 0:
            raise ValueError("Số lượng phải lớn hơn 0")

        if movement_type in {"issue", "waste", "transfer"}:
            available = get_inventory_balance(db, organization_id, source_warehouse.id, material_id)
            if available < qty:
                raise ValueError(f"Không đủ tồn kho để xuất/chuyển. Tồn hiện tại: {float(available)}")

        if movement_type == "receipt":
            entries.append(
                _build_ledger_entry(
                    organization_id=organization_id,
                    warehouse=source_warehouse,
                    material_id=material_id,
                    movement_type="receipt",
                    quantity_in=qty,
                    quantity_out=Decimal("0"),
                    unit_cost=unit_cost_decimal,
                    reference_no=reference_no,
                    source_document_type=source_document_type,
                    source_document_id=source_document_id,
                    note=note,
                    transaction_at=tx_time,
                    period_id=effective_period_id,
                    actor_user_id=actor_user_id,
                )
            )

        elif movement_type == "issue":
            entries.append(
                _build_ledger_entry(
                    organization_id=organization_id,
                    warehouse=source_warehouse,
                    material_id=material_id,
                    movement_type="issue",
                    quantity_in=Decimal("0"),
                    quantity_out=qty,
                    unit_cost=unit_cost_decimal,
                    reference_no=reference_no,
                    source_document_type=source_document_type,
                    source_document_id=source_document_id,
                    note=note,
                    transaction_at=tx_time,
                    period_id=effective_period_id,
                    actor_user_id=actor_user_id,
                )
            )

        elif movement_type == "waste":
            entries.append(
                _build_ledger_entry(
                    organization_id=organization_id,
                    warehouse=source_warehouse,
                    material_id=material_id,
                    movement_type="waste",
                    quantity_in=Decimal("0"),
                    quantity_out=qty,
                    unit_cost=unit_cost_decimal,
                    reference_no=reference_no,
                    source_document_type=source_document_type,
                    source_document_id=source_document_id,
                    note=note,
                    transaction_at=tx_time,
                    period_id=effective_period_id,
                    actor_user_id=actor_user_id,
                )
            )

        elif movement_type == "transfer":
            if not destination_warehouse_id:
                raise ValueError("Nghiệp vụ chuyển kho cần destination_warehouse_id")
            destination = _get_warehouse(db, organization_id, destination_warehouse_id)
            if destination.id == source_warehouse.id:
                raise ValueError("Kho đi và kho đến phải khác nhau")

            touched_warehouses.add(destination.id)

            entries.append(
                _build_ledger_entry(
                    organization_id=organization_id,
                    warehouse=source_warehouse,
                    material_id=material_id,
                    movement_type="transfer_out",
                    quantity_in=Decimal("0"),
                    quantity_out=qty,
                    unit_cost=unit_cost_decimal,
                    reference_no=reference_no,
                    source_document_type=source_document_type,
                    source_document_id=source_document_id,
                    note=note,
                    transaction_at=tx_time,
                    period_id=effective_period_id,
                    actor_user_id=actor_user_id,
                )
            )
            entries.append(
                _build_ledger_entry(
                    organization_id=organization_id,
                    warehouse=destination,
                    material_id=material_id,
                    movement_type="transfer_in",
                    quantity_in=qty,
                    quantity_out=Decimal("0"),
                    unit_cost=unit_cost_decimal,
                    reference_no=reference_no,
                    source_document_type=source_document_type,
                    source_document_id=source_document_id,
                    note=note,
                    transaction_at=tx_time,
                    period_id=effective_period_id,
                    actor_user_id=actor_user_id,
                )
            )

    if not entries:
        raise ValueError("Không tạo được bút toán kho")

    for entry in entries:
        db.add(entry)

    db.flush()
    for entry in entries:
        entry.balance_after_qty = float(
            get_inventory_balance(db, organization_id, str(entry.warehouse_id), str(entry.material_id))
        )
        db.add(entry)

    db.commit()
    for entry in entries:
        db.refresh(entry)

    balances = [
        {
            "warehouse_id": warehouse,
            "material_id": material_id,
            "available_qty": float(get_inventory_balance(db, organization_id, warehouse, material_id)),
        }
        for warehouse in sorted(touched_warehouses)
    ]

    return {
        "entries": [serialize_instance(entry) for entry in entries],
        "balances": balances,
    }


def post_inventory_stock_take(
    db: Session,
    *,
    organization_id: str,
    actor_user_id: str | None,
    warehouse_id: str,
    material_id: str,
    counted_qty: float,
    unit_cost: float | None,
    note: str | None,
    stock_take_date: date | None,
    period_id: str | None,
) -> dict[str, Any]:
    if counted_qty < 0:
        raise ValueError("Số lượng kiểm kê không được âm")

    warehouse = _get_warehouse(db, organization_id, warehouse_id)
    _get_material(db, material_id)

    tx_time = _utcnow()
    effective_period_id = _resolve_cost_period_id(db, organization_id, tx_time, period_id)

    system_qty = get_inventory_balance(db, organization_id, warehouse_id, material_id)
    counted_qty_decimal = _quantize_qty(_as_decimal(counted_qty))
    variance_qty = _quantize_qty(counted_qty_decimal - system_qty)

    stock_take = InventoryStockTake(
        organization_id=organization_id,
        warehouse_id=warehouse.id,
        material_id=material_id,
        stock_take_date=stock_take_date or tx_time.date(),
        counted_qty=float(counted_qty_decimal),
        system_qty=float(system_qty),
        variance_qty=float(variance_qty),
        unit_cost=float(_quantize_cost(_as_decimal(unit_cost))) if unit_cost is not None else None,
        note=note,
        period_id=effective_period_id,
        status="posted",
        posted_by=actor_user_id,
        posted_at=tx_time,
    )
    db.add(stock_take)
    db.flush()

    entries: list[InventoryLedgerEntry] = []
    unit_cost_decimal = _as_decimal(unit_cost) if unit_cost is not None else None

    if variance_qty > 0:
        entry = _build_ledger_entry(
            organization_id=organization_id,
            warehouse=warehouse,
            material_id=material_id,
            movement_type="stock_take_gain",
            quantity_in=variance_qty,
            quantity_out=Decimal("0"),
            unit_cost=unit_cost_decimal,
            reference_no=f"KK-{stock_take.id[:8]}",
            source_document_type="stock_take",
            source_document_id=stock_take.id,
            note=note,
            transaction_at=tx_time,
            period_id=effective_period_id,
            actor_user_id=actor_user_id,
        )
        entries.append(entry)
        db.add(entry)

    elif variance_qty < 0:
        required = abs(variance_qty)
        if system_qty < required:
            raise ValueError("Không thể ghi nhận kiểm kê giảm vì vượt quá tồn hệ thống")

        entry = _build_ledger_entry(
            organization_id=organization_id,
            warehouse=warehouse,
            material_id=material_id,
            movement_type="stock_take_loss",
            quantity_in=Decimal("0"),
            quantity_out=required,
            unit_cost=unit_cost_decimal,
            reference_no=f"KK-{stock_take.id[:8]}",
            source_document_type="stock_take",
            source_document_id=stock_take.id,
            note=note,
            transaction_at=tx_time,
            period_id=effective_period_id,
            actor_user_id=actor_user_id,
        )
        entries.append(entry)
        db.add(entry)

    db.flush()
    for entry in entries:
        entry.balance_after_qty = float(
            get_inventory_balance(db, organization_id, str(entry.warehouse_id), str(entry.material_id))
        )
        db.add(entry)

    db.commit()
    db.refresh(stock_take)
    for entry in entries:
        db.refresh(entry)

    return {
        "stock_take": serialize_instance(stock_take),
        "entries": [serialize_instance(entry) for entry in entries],
        "balance": {
            "warehouse_id": warehouse_id,
            "material_id": material_id,
            "available_qty": float(get_inventory_balance(db, organization_id, warehouse_id, material_id)),
        },
    }


def create_cost_period(
    db: Session,
    *,
    organization_id: str,
    period_code: str,
    start_date: date,
    end_date: date,
    note: str | None,
) -> dict[str, Any]:
    if start_date > end_date:
        raise ValueError("Ngày bắt đầu kỳ phải nhỏ hơn hoặc bằng ngày kết thúc")

    existing = (
        db.execute(
            select(CostPeriod)
            .where(CostPeriod.organization_id == organization_id)
            .where(CostPeriod.period_code == period_code)
        )
        .scalars()
        .first()
    )
    if existing:
        raise ValueError("Mã kỳ đã tồn tại")

    period = CostPeriod(
        organization_id=organization_id,
        period_code=period_code,
        start_date=start_date,
        end_date=end_date,
        status="draft",
        note=note,
    )
    db.add(period)
    db.commit()
    db.refresh(period)
    return {"period": serialize_instance(period)}


def build_preclose_checklist(
    db: Session,
    *,
    organization_id: str,
    period_id: str,
) -> dict[str, Any]:
    period = _get_cost_period(db, organization_id, period_id)
    start_date = _to_date(period.start_date)
    end_date = _to_date(period.end_date)
    if not start_date or not end_date:
        raise ValueError("Kỳ giá thành thiếu khoảng ngày")

    entries = (
        db.execute(
            select(InventoryLedgerEntry).where(InventoryLedgerEntry.organization_id == organization_id)
        )
        .scalars()
        .all()
    )
    period_entries = [
        entry
        for entry in entries
        if _in_period_range(_to_date(entry.transaction_at), start_date, end_date)
    ]

    unassigned_entries = [
        entry
        for entry in period_entries
        if not entry.period_id or str(entry.period_id) != str(period.id)
    ]

    stock_takes = (
        db.execute(
            select(InventoryStockTake).where(InventoryStockTake.organization_id == organization_id)
        )
        .scalars()
        .all()
    )
    period_stock_takes = [
        item
        for item in stock_takes
        if _in_period_range(_to_date(item.stock_take_date), start_date, end_date)
    ]
    pending_stock_takes = [item for item in period_stock_takes if str(item.status) != "posted"]

    checklist = {
        "period_id": period.id,
        "period_code": period.period_code,
        "inventory_entries_in_period": len(period_entries),
        "entries_missing_period_link": len(unassigned_entries),
        "stock_take_records_in_period": len(period_stock_takes),
        "stock_take_pending": len(pending_stock_takes),
        "ready_to_close": len(unassigned_entries) == 0 and len(pending_stock_takes) == 0,
    }

    return {
        "period": serialize_instance(period),
        "checklist": checklist,
    }


def open_cost_period(
    db: Session,
    *,
    organization_id: str,
    period_id: str,
    actor_user_id: str | None,
    note: str | None,
) -> dict[str, Any]:
    period = _get_cost_period(db, organization_id, period_id)
    start_date = _to_date(period.start_date)
    end_date = _to_date(period.end_date)

    if period.status == "open":
        return {"period": serialize_instance(period)}
    if period.status == "closed":
        raise ValueError("Kỳ đang đóng, hãy dùng thao tác mở lại")
    if not start_date or not end_date:
        raise ValueError("Kỳ giá thành thiếu khoảng ngày")

    open_periods = (
        db.execute(
            select(CostPeriod)
            .where(CostPeriod.organization_id == organization_id)
            .where(CostPeriod.status == "open")
            .where(CostPeriod.id != period.id)
        )
        .scalars()
        .all()
    )

    for existing in open_periods:
        existing_start = _to_date(existing.start_date)
        existing_end = _to_date(existing.end_date)
        if existing_start and existing_end and not (end_date < existing_start or start_date > existing_end):
            raise ValueError("Đã có kỳ mở trùng phạm vi ngày")

    period.status = "open"
    period.opened_at = _utcnow()
    period.opened_by = actor_user_id
    if note:
        period.note = note

    db.add(period)
    db.commit()
    db.refresh(period)
    return {"period": serialize_instance(period)}


def close_cost_period(
    db: Session,
    *,
    organization_id: str,
    period_id: str,
    actor_user_id: str | None,
    note: str | None,
) -> dict[str, Any]:
    period = _get_cost_period(db, organization_id, period_id)
    if period.status != "open":
        raise ValueError("Chỉ đóng được kỳ đang mở")

    checklist_payload = build_preclose_checklist(
        db,
        organization_id=organization_id,
        period_id=period_id,
    )
    checklist = checklist_payload["checklist"]
    if not checklist["ready_to_close"]:
        raise ValueError(
            "Chưa đủ điều kiện đóng kỳ: còn dữ liệu chưa khóa kỳ hoặc phiếu kiểm kê chưa chốt"
        )

    start_date = _to_date(period.start_date)
    end_date = _to_date(period.end_date)
    entries = (
        db.execute(
            select(InventoryLedgerEntry).where(InventoryLedgerEntry.organization_id == organization_id)
        )
        .scalars()
        .all()
    )

    for entry in entries:
        if _in_period_range(_to_date(entry.transaction_at), start_date, end_date) and not entry.period_id:
            entry.period_id = period.id
            db.add(entry)

    from app.application.costing import create_unit_cost_snapshot, run_allocation

    allocation_payload = run_allocation(
        db,
        organization_id=organization_id,
        period_id=period_id,
        actor_user_id=actor_user_id,
        note=note or f"Tự động phân bổ khi chốt kỳ {period.period_code}",
    )
    allocation_run = allocation_payload.get("allocation_run")

    source_run_id: str | None = None
    if isinstance(allocation_run, dict) and allocation_run.get("id"):
        source_run_id = str(allocation_run["id"])

    snapshot_payload = create_unit_cost_snapshot(
        db,
        organization_id=organization_id,
        period_id=period_id,
        actor_user_id=actor_user_id,
        concrete_product_id=None,
        source_run_id=source_run_id,
        output_volume_m3=None,
        total_cost=None,
        note=note or f"Tự động chốt snapshot đơn giá khi đóng kỳ {period.period_code}",
    )

    frozen_snapshot: dict[str, Any] | None = None
    unit_cost_snapshot_data = snapshot_payload.get("unit_cost_snapshot")
    if isinstance(unit_cost_snapshot_data, dict):
        snapshot_id = str(unit_cost_snapshot_data.get("id") or "")
        if snapshot_id:
            snapshot = db.get(UnitCostSnapshot, snapshot_id)
            if snapshot and str(snapshot.organization_id) == str(organization_id):
                snapshot.status = "frozen"
                snapshot.closed_at = _utcnow()
                snapshot.closed_by = actor_user_id
                db.add(snapshot)
                db.flush()
                frozen_snapshot = serialize_instance(snapshot)

    period.status = "closed"
    period.closed_at = _utcnow()
    period.closed_by = actor_user_id
    period.preclose_check_json = {
        **checklist,
        "allocation_run_id": allocation_run.get("id") if isinstance(allocation_run, dict) else None,
        "unit_cost_snapshot_id": frozen_snapshot.get("id") if frozen_snapshot else None,
    }
    if note:
        period.note = note

    db.add(period)
    db.commit()
    db.refresh(period)
    return {
        "period": serialize_instance(period),
        "checklist": checklist,
        "allocation_run": allocation_run,
        "unit_cost_snapshot": frozen_snapshot,
    }


def reopen_cost_period(
    db: Session,
    *,
    organization_id: str,
    period_id: str,
    actor_user_id: str | None,
    note: str | None,
) -> dict[str, Any]:
    period = _get_cost_period(db, organization_id, period_id)
    if period.status != "closed":
        raise ValueError("Chỉ mở lại được kỳ đã đóng")

    period.status = "open"
    period.reopened_at = _utcnow()
    period.reopened_by = actor_user_id
    if note:
        period.note = note

    db.add(period)
    db.commit()
    db.refresh(period)
    return {"period": serialize_instance(period)}
