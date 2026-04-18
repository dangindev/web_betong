from __future__ import annotations

import math
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from app.application.registry import serialize_instance, serialize_value
from app.domain.models import (
    AuditLog,
    BatchTicket,
    DailyKpiSnapshot,
    DispatchOrder,
    EventIngestion,
    ManualOverride,
    Notification,
    OfflineSyncQueue,
    PlantCapacitySlot,
    PourRequest,
    Pump,
    PumpAvailability,
    PumpEvent,
    PumpSession,
    ResourceLock,
    ReconciliationRecord,
    ScheduleConflict,
    ScheduleRun,
    ScheduleVersion,
    ScheduledTrip,
    TravelEstimate,
    Trip,
    TripEvent,
    Vehicle,
    VehicleAvailability,
)

TRIP_EVENT_SEQUENCE = [
    "assigned",
    "accepted",
    "check_in_plant",
    "load_start",
    "load_end",
    "depart_plant",
    "arrive_site",
    "pour_start",
    "pour_end",
    "leave_site",
    "return_plant",
]

PUMP_EVENT_SEQUENCE = [
    "assigned",
    "moving",
    "setup_start",
    "pump_start",
    "pump_end",
    "teardown_end",
]


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _as_naive_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def _as_float(value: Any, default: float = 0.0) -> float:
    if value is None:
        return default
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(value)
    except Exception:  # noqa: BLE001
        return default


def _query_with_ids(query: Select[Any], model: type, ids: list[str] | None):
    if ids:
        return query.where(getattr(model, "id").in_(ids))
    return query


def _active_vehicle_pool(db: Session, organization_id: str, run_date: date | None) -> list[Vehicle]:
    availability_query = select(VehicleAvailability.vehicle_id).where(
        VehicleAvailability.organization_id == organization_id,
        VehicleAvailability.is_available.is_(True),
    )
    if run_date:
        availability_query = availability_query.where(VehicleAvailability.shift_date == run_date)

    available_vehicle_ids = [row[0] for row in db.execute(availability_query).all()]
    if available_vehicle_ids:
        return (
            db.execute(
                select(Vehicle)
                .where(Vehicle.organization_id == organization_id)
                .where(Vehicle.status == "active")
                .where(Vehicle.id.in_(available_vehicle_ids))
                .order_by(Vehicle.created_at.asc())
            )
            .scalars()
            .all()
        )

    return (
        db.execute(
            select(Vehicle)
            .where(Vehicle.organization_id == organization_id)
            .where(Vehicle.status == "active")
            .order_by(Vehicle.created_at.asc())
        )
        .scalars()
        .all()
    )


def _active_pump_pool(db: Session, organization_id: str, run_date: date | None) -> list[Pump]:
    availability_query = select(PumpAvailability.pump_id).where(
        PumpAvailability.organization_id == organization_id,
        PumpAvailability.is_available.is_(True),
    )
    if run_date:
        availability_query = availability_query.where(PumpAvailability.shift_date == run_date)

    available_pump_ids = [row[0] for row in db.execute(availability_query).all()]
    if available_pump_ids:
        return (
            db.execute(
                select(Pump)
                .where(Pump.organization_id == organization_id)
                .where(Pump.status == "active")
                .where(Pump.id.in_(available_pump_ids))
                .order_by(Pump.created_at.asc())
            )
            .scalars()
            .all()
        )

    return (
        db.execute(
            select(Pump)
            .where(Pump.organization_id == organization_id)
            .where(Pump.status == "active")
            .order_by(Pump.created_at.asc())
        )
        .scalars()
        .all()
    )


def _resource_locks(db: Session, organization_id: str) -> dict[str, set[str]]:
    now = _as_naive_utc(_utcnow())
    rows = (
        db.execute(
            select(ResourceLock)
            .where(ResourceLock.organization_id == organization_id)
            .where(ResourceLock.is_active.is_(True))
        )
        .scalars()
        .all()
    )
    locks = {"vehicle": set(), "pump": set(), "plant": set()}
    for row in rows:
        row_expires_at = _as_naive_utc(row.expires_at)
        if row_expires_at and now and row_expires_at < now:
            continue
        if row.resource_type in locks:
            locks[row.resource_type].add(str(row.resource_id))
    return locks


def _resolve_cycle_minutes(
    db: Session,
    organization_id: str,
    plant_id: str | None,
    site_id: str | None,
) -> int:
    route_key = f"{plant_id or 'plant'}::{site_id or 'site'}"
    now = _as_naive_utc(_utcnow())
    estimate = (
        db.execute(
            select(TravelEstimate)
            .where(TravelEstimate.organization_id == organization_id)
            .where(TravelEstimate.route_key == route_key)
            .order_by(TravelEstimate.updated_at.desc())
        )
        .scalars()
        .first()
    )
    cached_until = _as_naive_utc(estimate.cached_until) if estimate else None
    if estimate and cached_until and now and cached_until > now:
        return max(30, int(estimate.estimated_minutes))

    cycle_minutes = 90
    if estimate is None:
        estimate = TravelEstimate(
            organization_id=organization_id,
            plant_id=plant_id,
            site_id=site_id,
            route_key=route_key,
            estimated_minutes=cycle_minutes,
            source="cache",
            confidence_pct=50,
            cached_until=(now + timedelta(minutes=30)) if now else None,
        )
        db.add(estimate)
    else:
        estimate.estimated_minutes = cycle_minutes
        estimate.cached_until = (now + timedelta(minutes=30)) if now else None
    return cycle_minutes


def _record_conflict(
    db: Session,
    organization_id: str,
    schedule_run_id: str,
    dispatch_order_id: str | None,
    conflict_type: str,
    message: str,
    payload: dict[str, Any] | None = None,
) -> ScheduleConflict:
    conflict = ScheduleConflict(
        organization_id=organization_id,
        schedule_run_id=schedule_run_id,
        dispatch_order_id=dispatch_order_id,
        conflict_type=conflict_type,
        severity="warning",
        message=message,
        conflict_payload_json=payload,
    )
    db.add(conflict)
    return conflict


def _record_notification(
    db: Session,
    organization_id: str,
    channel: str,
    template_code: str,
    recipient: str,
    payload: dict[str, Any],
    related_entity_type: str | None = None,
    related_entity_id: str | None = None,
) -> Notification:
    notification = Notification(
        organization_id=organization_id,
        channel=channel,
        template_code=template_code,
        recipient=recipient,
        payload_json=payload,
        status="sent",
        sent_at=_utcnow(),
        related_entity_type=related_entity_type,
        related_entity_id=related_entity_id,
    )
    db.add(notification)
    return notification


def create_or_update_dispatch_order(
    db: Session,
    organization_id: str,
    pour_request_id: str,
    action: str,
    actor_user_id: str,
    payload: dict[str, Any],
) -> DispatchOrder:
    pour_request = db.get(PourRequest, pour_request_id)
    if not pour_request or str(pour_request.organization_id) != str(organization_id):
        raise ValueError("Pour request not found")

    dispatch_order = (
        db.execute(select(DispatchOrder).where(DispatchOrder.pour_request_id == pour_request_id))
        .scalars()
        .first()
    )
    if dispatch_order is None:
        dispatch_order = DispatchOrder(
            organization_id=organization_id,
            pour_request_id=pour_request_id,
            sales_order_id=pour_request.sales_order_id,
            customer_id=pour_request.customer_id,
            site_id=pour_request.site_id,
            assigned_plant_id=pour_request.assigned_plant_id,
            target_truck_rhythm_minutes=payload.get("target_truck_rhythm_minutes") or 30,
            status="planning",
        )
        db.add(dispatch_order)

    if payload.get("assigned_plant_id"):
        dispatch_order.assigned_plant_id = payload["assigned_plant_id"]
    if payload.get("assigned_pump_id"):
        dispatch_order.assigned_pump_id = payload["assigned_pump_id"]
    if payload.get("locked_fields_json") is not None:
        dispatch_order.locked_fields_json = payload.get("locked_fields_json")
    if payload.get("target_truck_rhythm_minutes") is not None:
        dispatch_order.target_truck_rhythm_minutes = int(payload["target_truck_rhythm_minutes"])
    if payload.get("dispatch_lock") is not None:
        dispatch_order.dispatch_lock = bool(payload["dispatch_lock"])

    action_to_status = {
        "approve": "approved",
        "reject": "rejected",
        "request-more-info": "request_info",
    }
    if action not in action_to_status:
        raise ValueError("Invalid dispatch action")

    dispatch_order.approval_status = action_to_status[action]
    dispatch_order.approval_note = payload.get("note")
    dispatch_order.approved_by = actor_user_id
    dispatch_order.approved_at = _utcnow()
    dispatch_order.status = "ready" if action == "approve" else action_to_status[action]

    if action == "approve":
        pour_request.status = "approved"
    elif action == "reject":
        pour_request.status = "rejected"
    else:
        pour_request.status = "need_info"

    _record_notification(
        db,
        organization_id=organization_id,
        channel="internal",
        template_code=f"dispatch_{action}",
        recipient="dispatcher",
        payload={
            "pour_request_id": pour_request_id,
            "dispatch_order_id": getattr(dispatch_order, "id", None),
            "action": action,
        },
        related_entity_type="dispatch_orders",
        related_entity_id=getattr(dispatch_order, "id", None),
    )

    db.commit()
    db.refresh(dispatch_order)
    return dispatch_order


def run_scheduler(
    db: Session,
    organization_id: str,
    actor_user_id: str,
    run_date: date | None = None,
    dispatch_order_ids: list[str] | None = None,
) -> dict[str, Any]:
    run = ScheduleRun(
        organization_id=organization_id,
        run_code=f"SCH-{_utcnow().strftime('%Y%m%d-%H%M%S')}",
        run_date=run_date,
        status="running",
        created_by=actor_user_id,
        input_snapshot_json={"dispatch_order_ids": dispatch_order_ids or [], "run_date": str(run_date) if run_date else None},
    )
    db.add(run)
    db.flush()

    order_query = select(DispatchOrder).where(DispatchOrder.organization_id == organization_id)
    order_query = order_query.where(DispatchOrder.approval_status == "approved")
    order_query = _query_with_ids(order_query, DispatchOrder, dispatch_order_ids)
    orders = db.execute(order_query.order_by(DispatchOrder.created_at.asc())).scalars().all()

    pour_request_ids = [str(order.pour_request_id) for order in orders if order.pour_request_id]
    pour_requests = (
        db.execute(select(PourRequest).where(PourRequest.id.in_(pour_request_ids))).scalars().all()
        if pour_request_ids
        else []
    )
    pour_map = {str(item.id): item for item in pour_requests}

    vehicles = _active_vehicle_pool(db, organization_id, run_date)
    pumps = _active_pump_pool(db, organization_id, run_date)
    locks = _resource_locks(db, organization_id)

    vehicle_pool = [vehicle for vehicle in vehicles if str(vehicle.id) not in locks["vehicle"]]
    pump_pool = [pump for pump in pumps if str(pump.id) not in locks["pump"]]

    vehicle_idx = 0
    pump_idx = 0
    created_trips = 0
    created_conflicts = 0

    slots = (
        db.execute(select(PlantCapacitySlot).where(PlantCapacitySlot.organization_id == organization_id))
        .scalars()
        .all()
    )
    slots_by_plant: dict[str, list[PlantCapacitySlot]] = {}
    for slot in slots:
        slots_by_plant.setdefault(str(slot.plant_id), []).append(slot)

    for order_pos, order in enumerate(orders):
        pour_request = pour_map.get(str(order.pour_request_id))
        if order.dispatch_lock:
            _record_conflict(
                db,
                organization_id,
                run.id,
                str(order.id),
                "dispatch_lock",
                "Dispatch order bị lock, scheduler không thay đổi kế hoạch.",
            )
            created_conflicts += 1
            continue

        if not vehicle_pool:
            _record_conflict(
                db,
                organization_id,
                run.id,
                str(order.id),
                "vehicle_unavailable",
                "Không có xe khả dụng để lập lịch.",
            )
            created_conflicts += 1
            continue

        plant_id = str(order.assigned_plant_id or (pour_request.assigned_plant_id if pour_request else ""))
        if not plant_id:
            _record_conflict(
                db,
                organization_id,
                run.id,
                str(order.id),
                "missing_plant",
                "Chưa gán trạm cho dispatch order.",
            )
            created_conflicts += 1
            continue
        if plant_id in locks["plant"]:
            _record_conflict(
                db,
                organization_id,
                run.id,
                str(order.id),
                "plant_locked",
                "Trạm đang bị lock bởi thao tác thủ công.",
            )
            created_conflicts += 1
            continue

        requires_pump = bool(getattr(pour_request, "requires_pump", False))
        selected_pump_id: str | None = str(order.assigned_pump_id) if order.assigned_pump_id else None
        if requires_pump and not selected_pump_id:
            if not pump_pool:
                _record_conflict(
                    db,
                    organization_id,
                    run.id,
                    str(order.id),
                    "pump_unavailable",
                    "Đơn yêu cầu bơm nhưng không có pump khả dụng.",
                )
                created_conflicts += 1
            else:
                selected_pump_id = str(pump_pool[pump_idx % len(pump_pool)].id)
                pump_idx += 1

        vehicle = vehicle_pool[vehicle_idx % len(vehicle_pool)]
        vehicle_idx += 1
        vehicle_capacity = _as_float(vehicle.effective_capacity_m3, default=0) or _as_float(vehicle.capacity_m3, default=7) or 7

        requested_volume = _as_float(getattr(pour_request, "requested_volume_m3", None), default=0)
        trip_count = max(1, math.ceil(requested_volume / max(vehicle_capacity, 0.1)))
        base_start = getattr(pour_request, "requested_start_at", None) or (_utcnow() + timedelta(hours=order_pos))
        cycle_minutes = _resolve_cycle_minutes(db, organization_id, plant_id, str(getattr(pour_request, "site_id", "")))

        for trip_no in range(1, trip_count + 1):
            load_start = base_start + timedelta(minutes=(trip_no - 1) * cycle_minutes)
            load_end = load_start + timedelta(minutes=15)
            depart_at = load_end
            arrive_site = depart_at + timedelta(minutes=max(10, cycle_minutes // 3))
            pour_start = arrive_site + timedelta(minutes=5)
            pour_end = pour_start + timedelta(minutes=20)
            return_at = pour_end + timedelta(minutes=max(10, cycle_minutes // 2))

            slot_candidates = slots_by_plant.get(plant_id, [])
            if slot_candidates:
                slot = next(
                    (
                        item
                        for item in slot_candidates
                        if item.slot_start_at <= load_start < item.slot_end_at
                    ),
                    None,
                )
                if slot and int(slot.used_loads or 0) >= int(slot.max_loads or 0):
                    _record_conflict(
                        db,
                        organization_id,
                        run.id,
                        str(order.id),
                        "plant_slot_full",
                        "Plant slot đã full tại thời điểm dự kiến load.",
                        payload={"plant_capacity_slot_id": str(slot.id), "trip_no": trip_no},
                    )
                    created_conflicts += 1
                elif slot:
                    slot.used_loads = int(slot.used_loads or 0) + 1

            scheduled_trip = ScheduledTrip(
                organization_id=organization_id,
                schedule_run_id=run.id,
                dispatch_order_id=order.id,
                pour_request_id=order.pour_request_id,
                trip_no=trip_no,
                assigned_vehicle_id=vehicle.id,
                assigned_pump_id=selected_pump_id,
                assigned_plant_id=plant_id,
                planned_volume_m3=max(min(vehicle_capacity, requested_volume), 0) if requested_volume > 0 else vehicle_capacity,
                planned_load_start_at=load_start,
                planned_load_end_at=load_end,
                planned_depart_at=depart_at,
                planned_arrive_site_at=arrive_site,
                planned_pour_start_at=pour_start,
                planned_pour_end_at=pour_end,
                planned_return_at=return_at,
                cycle_minutes=cycle_minutes,
                priority_score=max(1, 100 - order_pos * 2 - trip_no),
                status="assigned",
            )
            db.add(scheduled_trip)
            db.flush()

            trip = Trip(
                organization_id=organization_id,
                scheduled_trip_id=scheduled_trip.id,
                dispatch_order_id=order.id,
                pour_request_id=order.pour_request_id,
                vehicle_id=vehicle.id,
                pump_id=selected_pump_id,
                status="assigned",
            )
            db.add(trip)
            db.flush()

            if selected_pump_id:
                db.add(
                    PumpSession(
                        organization_id=organization_id,
                        trip_id=trip.id,
                        scheduled_trip_id=scheduled_trip.id,
                        pump_id=selected_pump_id,
                        session_status="assigned",
                    )
                )

            created_trips += 1

        order.status = "scheduled"

    run.finished_at = _utcnow()
    run.status = "completed"
    run.result_summary_json = {
        "dispatch_orders": len(orders),
        "scheduled_trips": created_trips,
        "conflicts": created_conflicts,
    }
    run.explanation_json = {
        "algorithm": "heuristic_v1",
        "notes": "Greedy assign theo xe khả dụng, tôn trọng resource lock và slot capacity cơ bản.",
    }

    _record_notification(
        db,
        organization_id=organization_id,
        channel="internal",
        template_code="scheduler_run_completed",
        recipient="dispatcher",
        payload={"schedule_run_id": str(run.id), "trips": created_trips, "conflicts": created_conflicts},
        related_entity_type="schedule_runs",
        related_entity_id=str(run.id),
    )

    db.commit()

    run_refreshed = db.get(ScheduleRun, run.id)
    trips = (
        db.execute(select(ScheduledTrip).where(ScheduledTrip.schedule_run_id == run.id).order_by(ScheduledTrip.trip_no.asc()))
        .scalars()
        .all()
    )
    conflicts = (
        db.execute(select(ScheduleConflict).where(ScheduleConflict.schedule_run_id == run.id))
        .scalars()
        .all()
    )

    return {
        "schedule_run": serialize_instance(run_refreshed),
        "scheduled_trips": [serialize_instance(item) for item in trips],
        "conflicts": [serialize_instance(item) for item in conflicts],
        "summary": run_refreshed.result_summary_json or {},
    }


def get_schedule_run_detail(db: Session, schedule_run_id: str) -> dict[str, Any]:
    run = db.get(ScheduleRun, schedule_run_id)
    if not run:
        raise ValueError("Schedule run not found")

    trips = (
        db.execute(select(ScheduledTrip).where(ScheduledTrip.schedule_run_id == schedule_run_id))
        .scalars()
        .all()
    )
    versions = (
        db.execute(select(ScheduleVersion).where(ScheduleVersion.dispatch_order_id.in_([trip.dispatch_order_id for trip in trips if trip.dispatch_order_id])))
        .scalars()
        .all()
        if trips
        else []
    )

    return {
        "schedule_run": serialize_instance(run),
        "scheduled_trips": [serialize_instance(item) for item in trips],
        "versions": [serialize_instance(item) for item in versions],
    }


def get_schedule_conflicts(db: Session, schedule_run_id: str) -> list[dict[str, Any]]:
    run = db.get(ScheduleRun, schedule_run_id)
    if not run:
        raise ValueError("Schedule run not found")
    conflicts = (
        db.execute(select(ScheduleConflict).where(ScheduleConflict.schedule_run_id == schedule_run_id))
        .scalars()
        .all()
    )
    return [serialize_instance(item) for item in conflicts]


def manual_override_scheduled_trip(
    db: Session,
    scheduled_trip_id: str,
    actor_user_id: str,
    override_type: str,
    override_payload: dict[str, Any],
    note: str | None = None,
) -> dict[str, Any]:
    trip = db.get(ScheduledTrip, scheduled_trip_id)
    if not trip:
        raise ValueError("Scheduled trip not found")

    before = serialize_instance(trip)

    mutable_fields = {
        "assigned_vehicle_id",
        "assigned_pump_id",
        "assigned_plant_id",
        "planned_load_start_at",
        "planned_load_end_at",
        "planned_depart_at",
        "planned_arrive_site_at",
        "planned_pour_start_at",
        "planned_pour_end_at",
        "planned_return_at",
        "is_locked",
        "lock_reason",
        "status",
    }
    for key, value in override_payload.items():
        if key in mutable_fields:
            setattr(trip, key, value)

    run = db.get(ScheduleRun, trip.schedule_run_id) if trip.schedule_run_id else None
    if run:
        run.manual_override_count = int(run.manual_override_count or 0) + 1

    version = ScheduleVersion(
        organization_id=trip.organization_id,
        dispatch_order_id=trip.dispatch_order_id,
        scheduled_trip_id=trip.id,
        change_type=override_type,
        before_json=before,
        after_json=serialize_instance(trip),
        changed_by=actor_user_id,
    )
    db.add(version)

    db.add(
        ManualOverride(
            organization_id=trip.organization_id,
            schedule_run_id=trip.schedule_run_id,
            dispatch_order_id=trip.dispatch_order_id,
            scheduled_trip_id=trip.id,
            override_type=override_type,
            override_payload_json=override_payload,
            note=note,
            created_by=actor_user_id,
        )
    )

    db.add(
        AuditLog(
            organization_id=trip.organization_id,
            user_id=actor_user_id,
            entity_type="scheduled_trips",
            entity_id=trip.id,
            action="manual_override",
            before_json=before,
            after_json=serialize_instance(trip),
            request_id=None,
        )
    )

    db.commit()
    refreshed = db.get(ScheduledTrip, trip.id)
    return {
        "scheduled_trip": serialize_instance(refreshed),
        "schedule_version": serialize_instance(version),
    }


def _validate_transition(current_status: str, new_status: str, sequence: list[str]) -> None:
    if new_status not in sequence:
        raise ValueError("Unsupported state transition")
    current_index = sequence.index(current_status) if current_status in sequence else 0
    new_index = sequence.index(new_status)
    if new_index < current_index:
        raise ValueError("Event out of order")
    if new_index - current_index > 1:
        raise ValueError("Missing previous event before transition")


def _idempotent_response(
    db: Session,
    organization_id: str,
    channel: str,
    idempotency_key: str | None,
) -> dict[str, Any] | None:
    if not idempotency_key:
        return None
    ingestion = (
        db.execute(
            select(EventIngestion)
            .where(EventIngestion.organization_id == organization_id)
            .where(EventIngestion.channel == channel)
            .where(EventIngestion.idempotency_key == idempotency_key)
        )
        .scalars()
        .first()
    )
    if ingestion and isinstance(ingestion.response_payload_json, dict):
        return ingestion.response_payload_json
    return None


def _store_ingestion(
    db: Session,
    organization_id: str,
    channel: str,
    idempotency_key: str | None,
    request_payload: dict[str, Any],
    response_payload: dict[str, Any],
) -> None:
    if not idempotency_key:
        return
    db.add(
        EventIngestion(
            organization_id=organization_id,
            channel=channel,
            idempotency_key=idempotency_key,
            request_payload_json=request_payload,
            response_payload_json=response_payload,
            status="success",
        )
    )


def apply_trip_event(
    db: Session,
    organization_id: str,
    trip_id: str,
    event_type: str,
    event_time: datetime,
    payload: dict[str, Any] | None,
    idempotency_key: str | None,
    reported_by_user_id: str,
    source: str,
) -> dict[str, Any]:
    cached = _idempotent_response(db, organization_id, "trip_event", idempotency_key)
    if cached:
        return cached

    trip = db.get(Trip, trip_id)
    if not trip or str(trip.organization_id) != str(organization_id):
        raise ValueError("Trip not found")

    current_status = str(trip.status or "assigned")
    _validate_transition(current_status=current_status, new_status=event_type, sequence=TRIP_EVENT_SEQUENCE)

    event = TripEvent(
        organization_id=organization_id,
        trip_id=trip.id,
        scheduled_trip_id=trip.scheduled_trip_id,
        event_type=event_type,
        event_time=event_time,
        idempotency_key=idempotency_key,
        event_payload_json=payload,
        reported_by_user_id=reported_by_user_id,
        source=source,
    )
    db.add(event)

    trip.status = event_type
    if event_type in {"accepted", "check_in_plant", "load_start"} and not trip.started_at:
        trip.started_at = event_time
    if event_type == "return_plant":
        trip.ended_at = event_time

    payload = payload or {}
    if event_type == "load_start":
        existing_ticket = (
            db.execute(select(BatchTicket).where(BatchTicket.trip_id == trip.id)).scalars().first()
        )
        if existing_ticket is None:
            db.add(
                BatchTicket(
                    organization_id=organization_id,
                    trip_id=trip.id,
                    scheduled_trip_id=trip.scheduled_trip_id,
                    ticket_no=f"BT-{datetime.now().strftime('%Y%m%d%H%M%S')}-{str(trip.id)[:6]}",
                    plant_id=payload.get("plant_id"),
                    vehicle_id=trip.vehicle_id,
                    concrete_product_id=payload.get("concrete_product_id"),
                    load_started_at=event_time,
                    status="loading",
                )
            )
    if event_type == "load_end":
        ticket = db.execute(select(BatchTicket).where(BatchTicket.trip_id == trip.id)).scalars().first()
        if ticket:
            ticket.load_completed_at = event_time
            ticket.loaded_volume_m3 = payload.get("loaded_volume_m3")
            ticket.status = "loaded"

    if payload.get("actual_volume_m3") is not None:
        trip.actual_volume_m3 = payload.get("actual_volume_m3")
    if payload.get("actual_distance_km") is not None:
        trip.actual_distance_km = payload.get("actual_distance_km")

    scheduled_trip = db.get(ScheduledTrip, trip.scheduled_trip_id) if trip.scheduled_trip_id else None
    if scheduled_trip is not None:
        scheduled_trip.status = event_type

    response = {
        "trip": serialize_instance(trip),
        "trip_event": serialize_instance(event),
    }
    _store_ingestion(
        db,
        organization_id=organization_id,
        channel="trip_event",
        idempotency_key=idempotency_key,
        request_payload={"trip_id": trip_id, "event_type": event_type, "payload": payload},
        response_payload=response,
    )

    db.commit()
    return response


def apply_pump_event(
    db: Session,
    organization_id: str,
    pump_session_id: str,
    event_type: str,
    event_time: datetime,
    payload: dict[str, Any] | None,
    idempotency_key: str | None,
    reported_by_user_id: str,
    source: str,
) -> dict[str, Any]:
    cached = _idempotent_response(db, organization_id, "pump_event", idempotency_key)
    if cached:
        return cached

    pump_session = db.get(PumpSession, pump_session_id)
    if not pump_session or str(pump_session.organization_id) != str(organization_id):
        raise ValueError("Pump session not found")

    current_status = str(pump_session.session_status or "assigned")
    _validate_transition(current_status=current_status, new_status=event_type, sequence=PUMP_EVENT_SEQUENCE)

    payload = payload or {}
    event = PumpEvent(
        organization_id=organization_id,
        pump_session_id=pump_session.id,
        event_type=event_type,
        event_time=event_time,
        idempotency_key=idempotency_key,
        event_payload_json=payload,
        reported_by_user_id=reported_by_user_id,
        source=source,
    )
    db.add(event)

    pump_session.session_status = event_type
    if event_type == "setup_start":
        pump_session.setup_started_at = event_time
    elif event_type == "pump_start":
        pump_session.pump_started_at = event_time
    elif event_type == "pump_end":
        pump_session.pump_ended_at = event_time
        if payload.get("actual_volume_m3") is not None:
            pump_session.actual_volume_m3 = payload.get("actual_volume_m3")
    elif event_type == "teardown_end":
        pump_session.teardown_ended_at = event_time

    response = {
        "pump_session": serialize_instance(pump_session),
        "pump_event": serialize_instance(event),
    }
    _store_ingestion(
        db,
        organization_id=organization_id,
        channel="pump_event",
        idempotency_key=idempotency_key,
        request_payload={"pump_session_id": pump_session_id, "event_type": event_type, "payload": payload},
        response_payload=response,
    )

    db.commit()
    return response


def ingest_gps_ping(
    db: Session,
    organization_id: str,
    vehicle_id: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    pinged_at = payload.get("pinged_at")
    if not isinstance(pinged_at, datetime):
        raise ValueError("pinged_at must be datetime")

    last_ping = (
        db.execute(
            select(TripEvent)
            .where(TripEvent.organization_id == organization_id)
            .where(TripEvent.event_type == "gps_ping")
            .where(TripEvent.event_payload_json.is_not(None))
            .order_by(TripEvent.event_time.desc())
        )
        .scalars()
        .first()
    )
    pinged_at_naive = _as_naive_utc(pinged_at)
    last_ping_time = _as_naive_utc(last_ping.event_time) if last_ping else None
    if pinged_at_naive and last_ping_time and abs((pinged_at_naive - last_ping_time).total_seconds()) < 5:
        raise ValueError("GPS ping rate limit exceeded")

    from app.domain.models import GpsPing

    ping = GpsPing(
        organization_id=organization_id,
        vehicle_id=vehicle_id,
        scheduled_trip_id=payload.get("scheduled_trip_id"),
        pinged_at=pinged_at,
        latitude=payload.get("latitude"),
        longitude=payload.get("longitude"),
        speed_kph=payload.get("speed_kph"),
        heading_deg=payload.get("heading_deg"),
        source=payload.get("source") or "mobile_driver",
    )
    db.add(ping)

    if payload.get("trip_id"):
        db.add(
            TripEvent(
                organization_id=organization_id,
                trip_id=payload.get("trip_id"),
                scheduled_trip_id=payload.get("scheduled_trip_id"),
                event_type="gps_ping",
                event_time=pinged_at,
                event_payload_json={
                    "vehicle_id": vehicle_id,
                    "latitude": serialize_value(payload.get("latitude")),
                    "longitude": serialize_value(payload.get("longitude")),
                },
                source="gps",
            )
        )

    db.commit()
    return {"gps_ping": serialize_instance(ping)}


def apply_offline_sync_batch(
    db: Session,
    organization_id: str,
    actor_user_id: str,
    device_id: str | None,
    events: list[dict[str, Any]],
) -> dict[str, Any]:
    results: list[dict[str, Any]] = []

    for event in events:
        queue = OfflineSyncQueue(
            organization_id=organization_id,
            device_id=device_id,
            channel=event.get("channel") or "unknown",
            payload_json=event,
            idempotency_key=event.get("idempotency_key"),
            status="processing",
        )
        db.add(queue)
        db.flush()

        try:
            channel = event.get("channel")
            if channel == "trip_event":
                result = apply_trip_event(
                    db=db,
                    organization_id=organization_id,
                    trip_id=event["trip_id"],
                    event_type=event["event_type"],
                    event_time=event.get("event_time") or _utcnow(),
                    payload=event.get("payload") or {},
                    idempotency_key=event.get("idempotency_key"),
                    reported_by_user_id=actor_user_id,
                    source="offline_sync",
                )
            elif channel == "pump_event":
                result = apply_pump_event(
                    db=db,
                    organization_id=organization_id,
                    pump_session_id=event["pump_session_id"],
                    event_type=event["event_type"],
                    event_time=event.get("event_time") or _utcnow(),
                    payload=event.get("payload") or {},
                    idempotency_key=event.get("idempotency_key"),
                    reported_by_user_id=actor_user_id,
                    source="offline_sync",
                )
            else:
                raise ValueError("Unsupported offline sync channel")
            queue.status = "done"
            queue.processed_at = _utcnow()
            results.append({"queue_id": queue.id, "status": "done", "result": result})
        except Exception as exc:  # noqa: BLE001
            db.rollback()
            queue = db.get(OfflineSyncQueue, queue.id)
            if queue:
                queue.status = "failed"
                queue.error_message = str(exc)
                queue.processed_at = _utcnow()
                db.commit()
            results.append({"queue_id": queue.id if queue else None, "status": "failed", "error": str(exc)})

    return {"processed": len(results), "results": results}


def reconcile_pour_request(
    db: Session,
    organization_id: str,
    pour_request_id: str,
    actor_user_id: str,
    actual_volume_m3: float | None,
    actual_trip_count: int | None,
    reason_code: str | None,
    note: str | None,
) -> dict[str, Any]:
    pour_request = db.get(PourRequest, pour_request_id)
    if not pour_request or str(pour_request.organization_id) != str(organization_id):
        raise ValueError("Pour request not found")

    dispatch_order = (
        db.execute(select(DispatchOrder).where(DispatchOrder.pour_request_id == pour_request_id))
        .scalars()
        .first()
    )
    planned_trips = (
        db.execute(
            select(ScheduledTrip).where(ScheduledTrip.pour_request_id == pour_request_id)
        )
        .scalars()
        .all()
    )

    planned_volume = sum(_as_float(item.planned_volume_m3) for item in planned_trips)
    planned_trip_count = len(planned_trips)

    if actual_volume_m3 is None:
        trip_rows = (
            db.execute(select(Trip).where(Trip.pour_request_id == pour_request_id)).scalars().all()
        )
        actual_volume_m3 = sum(_as_float(item.actual_volume_m3) for item in trip_rows)

    if actual_trip_count is None:
        actual_trip_count = (
            db.execute(select(Trip).where(Trip.pour_request_id == pour_request_id)).scalars().all()
            and len(db.execute(select(Trip).where(Trip.pour_request_id == pour_request_id)).scalars().all())
        ) or 0

    record = ReconciliationRecord(
        organization_id=organization_id,
        pour_request_id=pour_request_id,
        dispatch_order_id=dispatch_order.id if dispatch_order else None,
        planned_volume_m3=planned_volume,
        actual_volume_m3=actual_volume_m3,
        planned_trip_count=planned_trip_count,
        actual_trip_count=actual_trip_count,
        variance_volume_m3=(actual_volume_m3 or 0) - planned_volume,
        variance_trip_count=(actual_trip_count or 0) - planned_trip_count,
        reason_code=reason_code,
        note=note,
        reconciled_by=actor_user_id,
        status="closed",
    )
    db.add(record)

    pour_request.status = "reconciled"
    if dispatch_order:
        dispatch_order.status = "reconciled"

    db.commit()
    return {"reconciliation": serialize_instance(record)}


def generate_daily_kpi(
    db: Session,
    organization_id: str,
    snapshot_date: date,
    plant_id: str | None = None,
) -> dict[str, Any]:
    trips_query = select(Trip).where(Trip.organization_id == organization_id)
    trips = db.execute(trips_query).scalars().all()

    total_trips = len(trips)
    completed_trips = [item for item in trips if item.status == "return_plant"]
    on_time_pct = (len(completed_trips) / total_trips * 100) if total_trips else 0

    cycle_minutes: list[float] = []
    for item in completed_trips:
        if item.started_at and item.ended_at:
            cycle_minutes.append((item.ended_at - item.started_at).total_seconds() / 60)
    avg_cycle = sum(cycle_minutes) / len(cycle_minutes) if cycle_minutes else 0

    active_vehicles = (
        db.execute(select(Vehicle).where(Vehicle.organization_id == organization_id).where(Vehicle.status == "active"))
        .scalars()
        .all()
    )
    active_pumps = (
        db.execute(select(Pump).where(Pump.organization_id == organization_id).where(Pump.status == "active"))
        .scalars()
        .all()
    )

    used_vehicle_ids = {str(item.vehicle_id) for item in trips if item.vehicle_id}
    used_pump_ids = {str(item.pump_id) for item in trips if item.pump_id}

    vehicle_utilization_pct = (len(used_vehicle_ids) / len(active_vehicles) * 100) if active_vehicles else 0
    pump_utilization_pct = (len(used_pump_ids) / len(active_pumps) * 100) if active_pumps else 0

    empty_km = sum(max(_as_float(item.actual_distance_km), 0) * 0.1 for item in trips)
    volume_m3 = sum(_as_float(item.actual_volume_m3) for item in trips)

    snapshot = DailyKpiSnapshot(
        organization_id=organization_id,
        snapshot_date=snapshot_date,
        plant_id=plant_id,
        on_time_pct=round(on_time_pct, 2),
        avg_cycle_minutes=round(avg_cycle, 2),
        vehicle_utilization_pct=round(vehicle_utilization_pct, 2),
        pump_utilization_pct=round(pump_utilization_pct, 2),
        empty_km=round(empty_km, 3),
        trips_count=total_trips,
        volume_m3=round(volume_m3, 3),
    )
    db.add(snapshot)
    db.commit()

    return {"daily_kpi_snapshot": serialize_instance(snapshot)}
