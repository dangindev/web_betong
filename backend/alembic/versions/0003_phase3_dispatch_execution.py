"""phase3 dispatch and execution schema

Revision ID: 0003_phase3_dispatch_execution
Revises: 0002_phase2_pricing_sales
Create Date: 2026-04-18
"""

from alembic import op

from app.infrastructure.db import Base
from app.domain import models as _models  # noqa: F401

revision = "0003_phase3_dispatch_execution"
down_revision = "0002_phase2_pricing_sales"
branch_labels = None
depends_on = None

PHASE3_TABLES = [
    "operational_shifts",
    "vehicle_availabilities",
    "pump_availabilities",
    "resource_locks",
    "plant_capacity_slots",
    "travel_estimates",
    "schedule_runs",
    "dispatch_orders",
    "scheduled_trips",
    "schedule_conflicts",
    "schedule_versions",
    "manual_overrides",
    "trips",
    "trip_events",
    "pump_sessions",
    "pump_events",
    "batch_tickets",
    "batch_ticket_components",
    "gps_pings",
    "notifications",
    "offline_sync_queue",
    "event_ingestions",
    "reconciliation_records",
    "daily_kpi_snapshots",
]


def upgrade() -> None:
    bind = op.get_bind()
    for table_name in PHASE3_TABLES:
        Base.metadata.tables[table_name].create(bind=bind, checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()
    for table_name in reversed(PHASE3_TABLES):
        Base.metadata.tables[table_name].drop(bind=bind, checkfirst=True)
