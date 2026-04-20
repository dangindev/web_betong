"""phase5 production costing and margin schema

Revision ID: 0005_phase5_production_costing
Revises: 0004_phase4_inventory_costing
Create Date: 2026-04-19
"""

from alembic import op

from app.infrastructure.db import Base
from app.domain import models as _models  # noqa: F401

revision = "0005_phase5_production_costing"
down_revision = "0004_phase4_inventory_costing"
branch_labels = None
depends_on = None

PHASE5_TABLES = [
    "production_logs",
    "cost_pools",
    "allocation_rules",
    "allocation_runs",
    "allocation_results",
    "unit_cost_snapshots",
    "margin_snapshots",
]


def upgrade() -> None:
    bind = op.get_bind()
    for table_name in PHASE5_TABLES:
        Base.metadata.tables[table_name].create(bind=bind, checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()
    for table_name in reversed(PHASE5_TABLES):
        Base.metadata.tables[table_name].drop(bind=bind, checkfirst=True)
