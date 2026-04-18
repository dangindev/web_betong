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

PHASE1_TABLES = [
    "organizations",
    "business_units",
    "employees",
    "users",
    "roles",
    "permissions",
    "role_permissions",
    "user_roles",
    "user_sessions",
    "customers",
    "customer_contacts",
    "site_access_profiles",
    "project_sites",
    "plants",
    "plant_loading_bays",
    "vehicle_types",
    "vehicles",
    "pumps",
    "assets",
    "materials",
    "concrete_products",
    "mix_designs",
    "mix_design_components",
    "system_settings",
    "audit_logs",
    "attachments",
]


def upgrade() -> None:
    bind = op.get_bind()
    for table_name in PHASE1_TABLES:
        Base.metadata.tables[table_name].create(bind=bind, checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()
    for table_name in reversed(PHASE1_TABLES):
        Base.metadata.tables[table_name].drop(bind=bind, checkfirst=True)
