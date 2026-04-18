"""phase2 pricing and sales schema

Revision ID: 0002_phase2_pricing_sales
Revises: 0001_phase1_foundation
Create Date: 2026-04-18
"""

from alembic import op

from app.infrastructure.db import Base
from app.domain import models as _models  # noqa: F401

revision = "0002_phase2_pricing_sales"
down_revision = "0001_phase1_foundation"
branch_labels = None
depends_on = None

PHASE2_TABLES = [
    "price_books",
    "price_rules",
    "quotations",
    "quotation_items",
    "sales_orders",
    "pour_requests",
    "pour_request_time_windows",
    "price_calculation_snapshots",
]


def upgrade() -> None:
    bind = op.get_bind()
    for table_name in PHASE2_TABLES:
        Base.metadata.tables[table_name].create(bind=bind, checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()
    for table_name in reversed(PHASE2_TABLES):
        Base.metadata.tables[table_name].drop(bind=bind, checkfirst=True)
