"""phase1 foundation schema

Revision ID: 0001_phase1_foundation
Revises:
Create Date: 2026-04-18
"""

from alembic import op

from app.infrastructure.db import Base
from app.domain import models as _models  # noqa: F401

revision = "0001_phase1_foundation"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    bind = op.get_bind()
    for table in reversed(Base.metadata.sorted_tables):
        table.drop(bind=bind, checkfirst=True)
