"""phase4 inventory and costing foundation schema

Revision ID: 0004_phase4_inventory_costing
Revises: 0003_phase3_dispatch_execution
Create Date: 2026-04-19
"""

from alembic import op

from app.infrastructure.db import Base
from app.domain import models as _models  # noqa: F401

revision = "0004_phase4_inventory_costing"
down_revision = "0003_phase3_dispatch_execution"
branch_labels = None
depends_on = None

PHASE4_TABLES = [
    "warehouses",
    "cost_centers",
    "cost_objects",
    "cost_periods",
    "inventory_ledger_entries",
    "inventory_stock_takes",
]


def upgrade() -> None:
    bind = op.get_bind()
    for table_name in PHASE4_TABLES:
        Base.metadata.tables[table_name].create(bind=bind, checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()
    for table_name in reversed(PHASE4_TABLES):
        Base.metadata.tables[table_name].drop(bind=bind, checkfirst=True)
