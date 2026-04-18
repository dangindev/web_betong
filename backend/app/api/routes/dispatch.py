from __future__ import annotations

import io
import json
from datetime import date, datetime, timezone
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.application.dispatch import (
    apply_offline_sync_batch,
    apply_pump_event,
    apply_trip_event,
    create_or_update_dispatch_order,
    generate_daily_kpi,
    get_schedule_conflicts,
    get_schedule_run_detail,
    ingest_gps_ping,
    manual_override_scheduled_trip,
    reconcile_pour_request,
    run_scheduler,
)
from app.core.dependencies import get_current_user, user_has_permission
from app.domain.models import DispatchOrder, ScheduledTrip, Trip, User
from app.infrastructure.db import get_db

router = APIRouter(prefix="/api/v1/dispatch", tags=["dispatch"])


class DispatchApprovalRequest(BaseModel):
    organization_id: str
    action: Literal["approve", "reject", "request-more-info"]
    assigned_plant_id: str | None = None
    assigned_pump_id: str | None = None
    target_truck_rhythm_minutes: int | None = None
    dispatch_lock: bool | None = None
    locked_fields_json: dict[str, Any] | list[Any] | None = None
    note: str | None = None


class ScheduleRunRequest(BaseModel):
    organization_id: str
    run_date: date | None = None
    dispatch_order_ids: list[str] | None = None


class ManualOverrideRequest(BaseModel):
    override_type: str = "manual_override"
    override_payload: dict[str, Any] = Field(default_factory=dict)
    note: str | None = None


class TripEventRequest(BaseModel):
    organization_id: str
    event_type: str
    event_time: datetime | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
    idempotency_key: str | None = None
    source: str = "mobile_driver"


class PumpEventRequest(BaseModel):
    organization_id: str
    event_type: str
    event_time: datetime | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
    idempotency_key: str | None = None
    source: str = "mobile_pump"


class GpsPingRequest(BaseModel):
    organization_id: str
    vehicle_id: str
    trip_id: str | None = None
    scheduled_trip_id: str | None = None
    pinged_at: datetime
    latitude: float
    longitude: float
    speed_kph: float | None = None
    heading_deg: float | None = None
    source: str = "mobile_driver"


class OfflineSyncRequest(BaseModel):
    organization_id: str
    device_id: str | None = None
    events: list[dict[str, Any]]


class ReconcileRequest(BaseModel):
    organization_id: str
    actual_volume_m3: float | None = None
    actual_trip_count: int | None = None
    reason_code: str | None = None
    note: str | None = None


class KpiSnapshotRequest(BaseModel):
    organization_id: str
    snapshot_date: date | None = None
    plant_id: str | None = None


def _ensure_dispatch_permission(db: Session, user: User, action: str) -> None:
    modules = [
        "dispatch_orders",
        "schedule_runs",
        "scheduled_trips",
        "trips",
        "trip_events",
        "pump_sessions",
        "pump_events",
        "reconciliation_records",
        "daily_kpi_snapshots",
    ]
    for module in modules:
        if user_has_permission(db, user.id, module, action):
            return
    if action == "read":
        for module in modules:
            if user_has_permission(db, user.id, module, "write"):
                return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Missing dispatch permission")


def _raise_for_service_error(exc: ValueError) -> None:
    message = str(exc)
    if "not found" in message.lower():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=message) from exc
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message) from exc


@router.post("/pour-requests/{pour_request_id}/approval")
def dispatch_approval(
    pour_request_id: str,
    payload: DispatchApprovalRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    _ensure_dispatch_permission(db, current_user, "write")
    try:
        dispatch_order = create_or_update_dispatch_order(
            db=db,
            organization_id=payload.organization_id,
            pour_request_id=pour_request_id,
            action=payload.action,
            actor_user_id=current_user.id,
            payload=payload.model_dump(),
        )
        return {"dispatch_order": {key: value for key, value in dispatch_order.__dict__.items() if not key.startswith("_")}}
    except ValueError as exc:
        _raise_for_service_error(exc)


@router.post("/schedule-runs")
def create_schedule_run(
    payload: ScheduleRunRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    _ensure_dispatch_permission(db, current_user, "write")
    try:
        return run_scheduler(
            db=db,
            organization_id=payload.organization_id,
            actor_user_id=current_user.id,
            run_date=payload.run_date,
            dispatch_order_ids=payload.dispatch_order_ids,
        )
    except ValueError as exc:
        _raise_for_service_error(exc)


@router.get("/schedule-runs/{schedule_run_id}")
def read_schedule_run(
    schedule_run_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    _ensure_dispatch_permission(db, current_user, "read")
    try:
        return get_schedule_run_detail(db=db, schedule_run_id=schedule_run_id)
    except ValueError as exc:
        _raise_for_service_error(exc)


@router.get("/schedule-runs/{schedule_run_id}/conflicts")
def read_schedule_conflicts(
    schedule_run_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    _ensure_dispatch_permission(db, current_user, "read")
    try:
        return {"items": get_schedule_conflicts(db=db, schedule_run_id=schedule_run_id)}
    except ValueError as exc:
        _raise_for_service_error(exc)


@router.post("/scheduled-trips/{scheduled_trip_id}/override")
def override_scheduled_trip(
    scheduled_trip_id: str,
    payload: ManualOverrideRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    _ensure_dispatch_permission(db, current_user, "write")
    try:
        return manual_override_scheduled_trip(
            db=db,
            scheduled_trip_id=scheduled_trip_id,
            actor_user_id=current_user.id,
            override_type=payload.override_type,
            override_payload=payload.override_payload,
            note=payload.note,
        )
    except ValueError as exc:
        _raise_for_service_error(exc)


@router.post("/trips/{trip_id}/events")
def post_trip_event(
    trip_id: str,
    payload: TripEventRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    _ensure_dispatch_permission(db, current_user, "write")
    try:
        return apply_trip_event(
            db=db,
            organization_id=payload.organization_id,
            trip_id=trip_id,
            event_type=payload.event_type,
            event_time=payload.event_time or datetime.now(tz=timezone.utc),
            payload=payload.payload,
            idempotency_key=payload.idempotency_key,
            reported_by_user_id=current_user.id,
            source=payload.source,
        )
    except ValueError as exc:
        _raise_for_service_error(exc)


@router.post("/pump-sessions/{pump_session_id}/events")
def post_pump_event(
    pump_session_id: str,
    payload: PumpEventRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    _ensure_dispatch_permission(db, current_user, "write")
    try:
        return apply_pump_event(
            db=db,
            organization_id=payload.organization_id,
            pump_session_id=pump_session_id,
            event_type=payload.event_type,
            event_time=payload.event_time or datetime.now(tz=timezone.utc),
            payload=payload.payload,
            idempotency_key=payload.idempotency_key,
            reported_by_user_id=current_user.id,
            source=payload.source,
        )
    except ValueError as exc:
        _raise_for_service_error(exc)


@router.post("/gps-pings")
def post_gps_ping(
    payload: GpsPingRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    _ensure_dispatch_permission(db, current_user, "write")
    try:
        return ingest_gps_ping(
            db=db,
            organization_id=payload.organization_id,
            vehicle_id=payload.vehicle_id,
            payload=payload.model_dump(),
        )
    except ValueError as exc:
        _raise_for_service_error(exc)


@router.post("/offline-sync")
def post_offline_sync(
    payload: OfflineSyncRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    _ensure_dispatch_permission(db, current_user, "write")
    try:
        return apply_offline_sync_batch(
            db=db,
            organization_id=payload.organization_id,
            actor_user_id=current_user.id,
            device_id=payload.device_id,
            events=payload.events,
        )
    except ValueError as exc:
        _raise_for_service_error(exc)


@router.post("/reconciliation/{pour_request_id}")
def post_reconciliation(
    pour_request_id: str,
    payload: ReconcileRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    _ensure_dispatch_permission(db, current_user, "write")
    try:
        return reconcile_pour_request(
            db=db,
            organization_id=payload.organization_id,
            pour_request_id=pour_request_id,
            actor_user_id=current_user.id,
            actual_volume_m3=payload.actual_volume_m3,
            actual_trip_count=payload.actual_trip_count,
            reason_code=payload.reason_code,
            note=payload.note,
        )
    except ValueError as exc:
        _raise_for_service_error(exc)


@router.post("/kpi/snapshot")
def post_kpi_snapshot(
    payload: KpiSnapshotRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    _ensure_dispatch_permission(db, current_user, "write")
    try:
        return generate_daily_kpi(
            db=db,
            organization_id=payload.organization_id,
            snapshot_date=payload.snapshot_date or date.today(),
            plant_id=payload.plant_id,
        )
    except ValueError as exc:
        _raise_for_service_error(exc)


@router.get("/realtime")
def realtime_snapshot(
    organization_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    _ensure_dispatch_permission(db, current_user, "read")

    pending_orders = (
        db.execute(
            select(func.count())
            .select_from(DispatchOrder)
            .where(DispatchOrder.organization_id == organization_id)
            .where(DispatchOrder.status.in_(["ready", "planning", "scheduled"]))
        ).scalar_one()
        or 0
    )
    active_trips = (
        db.execute(
            select(func.count())
            .select_from(Trip)
            .where(Trip.organization_id == organization_id)
            .where(Trip.status != "return_plant")
        ).scalar_one()
        or 0
    )

    payload = {
        "timestamp": datetime.now(tz=timezone.utc).isoformat(),
        "pending_dispatch_orders": pending_orders,
        "active_trips": active_trips,
    }

    def stream():
        yield f"event: dispatch_snapshot\ndata: {json.dumps(payload)}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")


@router.get("/reports/operations")
def export_operations_report(
    organization_id: str = Query(...),
    report_format: Literal["csv", "pdf"] = Query(default="csv"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    _ensure_dispatch_permission(db, current_user, "read")

    rows = (
        db.execute(
            select(ScheduledTrip)
            .where(ScheduledTrip.organization_id == organization_id)
            .order_by(ScheduledTrip.created_at.desc())
        )
        .scalars()
        .all()
    )

    if report_format == "csv":
        output = io.StringIO()
        output.write("scheduled_trip_id,dispatch_order_id,trip_no,vehicle_id,pump_id,status,planned_load_start_at,planned_return_at\n")
        for row in rows:
            output.write(
                f"{row.id},{row.dispatch_order_id},{row.trip_no},{row.assigned_vehicle_id or ''},{row.assigned_pump_id or ''},{row.status},{row.planned_load_start_at or ''},{row.planned_return_at or ''}\n"
            )
        data = output.getvalue().encode("utf-8")
        return StreamingResponse(
            io.BytesIO(data),
            media_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="operations-report.csv"'},
        )

    html_rows = "".join(
        f"<tr><td>{idx + 1}</td><td>{row.dispatch_order_id}</td><td>{row.trip_no}</td><td>{row.assigned_vehicle_id or '-'}</td><td>{row.assigned_pump_id or '-'}</td><td>{row.status}</td></tr>"
        for idx, row in enumerate(rows)
    )
    html = f"""
    <html>
      <head>
        <style>
          body {{ font-family: DejaVu Sans, Arial, sans-serif; font-size: 12px; }}
          table {{ border-collapse: collapse; width: 100%; }}
          th, td {{ border: 1px solid #ddd; padding: 6px; text-align: left; }}
        </style>
      </head>
      <body>
        <h1>Operations report</h1>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Dispatch Order</th>
              <th>Trip No</th>
              <th>Vehicle</th>
              <th>Pump</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>{html_rows}</tbody>
        </table>
      </body>
    </html>
    """

    try:
        from weasyprint import HTML

        pdf_bytes = HTML(string=html).write_pdf()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"PDF generation failed: {exc}") from exc

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": 'inline; filename="operations-report.pdf"'},
    )
