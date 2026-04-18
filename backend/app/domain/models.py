from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.db import Base


class TimestampMixin:
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class Organization(TimestampMixin, Base):
    __tablename__ = "organizations"

    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    legal_name: Mapped[str | None] = mapped_column(String(255))
    tax_code: Mapped[str | None] = mapped_column(String(64))
    timezone: Mapped[str] = mapped_column(String(64), default="Asia/Ho_Chi_Minh")
    base_currency: Mapped[str] = mapped_column(String(16), default="VND")
    status: Mapped[str] = mapped_column(String(32), default="active")
    settings_json: Mapped[dict | list | None] = mapped_column(JSON)


class BusinessUnit(TimestampMixin, Base):
    __tablename__ = "business_units"

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    parent_id: Mapped[str | None] = mapped_column(ForeignKey("business_units.id"))
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    unit_type: Mapped[str | None] = mapped_column(String(64))
    address: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(32), default="active")


class Employee(TimestampMixin, Base):
    __tablename__ = "employees"

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    employee_no: Mapped[str] = mapped_column(String(50), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    department: Mapped[str | None] = mapped_column(String(255))
    position: Mapped[str | None] = mapped_column(String(255))
    employment_type: Mapped[str | None] = mapped_column(String(64))
    hire_date: Mapped[datetime | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(32), default="active")
    default_shift_group: Mapped[str | None] = mapped_column(String(64))


class User(TimestampMixin, Base):
    __tablename__ = "users"

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    employee_id: Mapped[str | None] = mapped_column(ForeignKey("employees.id"))
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    phone: Mapped[str | None] = mapped_column(String(32))
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="active")
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    locale: Mapped[str] = mapped_column(String(16), default="vi")
    timezone: Mapped[str] = mapped_column(String(64), default="Asia/Ho_Chi_Minh")


class Role(TimestampMixin, Base):
    __tablename__ = "roles"

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)


class Permission(TimestampMixin, Base):
    __tablename__ = "permissions"

    module_code: Mapped[str] = mapped_column(String(64), nullable=False)
    action_code: Mapped[str] = mapped_column(String(64), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)


class RolePermission(TimestampMixin, Base):
    __tablename__ = "role_permissions"
    __table_args__ = (UniqueConstraint("role_id", "permission_id", name="uq_role_permission"),)

    role_id: Mapped[str] = mapped_column(ForeignKey("roles.id"), nullable=False)
    permission_id: Mapped[str] = mapped_column(ForeignKey("permissions.id"), nullable=False)


class UserRole(TimestampMixin, Base):
    __tablename__ = "user_roles"
    __table_args__ = (UniqueConstraint("user_id", "role_id", "business_unit_id", name="uq_user_role"),)

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    role_id: Mapped[str] = mapped_column(ForeignKey("roles.id"), nullable=False)
    business_unit_id: Mapped[str | None] = mapped_column(ForeignKey("business_units.id"))
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)


class UserSession(TimestampMixin, Base):
    __tablename__ = "user_sessions"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    refresh_token_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    ip_address: Mapped[str | None] = mapped_column(String(64))
    user_agent: Mapped[str | None] = mapped_column(String(500))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Customer(TimestampMixin, Base):
    __tablename__ = "customers"

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    customer_type: Mapped[str | None] = mapped_column(String(64))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    tax_code: Mapped[str | None] = mapped_column(String(64))
    billing_address: Mapped[str | None] = mapped_column(String(500))
    payment_terms_days: Mapped[int | None] = mapped_column(Integer)
    credit_limit: Mapped[float | None] = mapped_column(Numeric(18, 2))
    status: Mapped[str] = mapped_column(String(32), default="active")


class CustomerContact(TimestampMixin, Base):
    __tablename__ = "customer_contacts"

    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id"), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(32))
    email: Mapped[str | None] = mapped_column(String(255))
    position: Mapped[str | None] = mapped_column(String(255))
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)


class SiteAccessProfile(TimestampMixin, Base):
    __tablename__ = "site_access_profiles"

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    difficulty_level: Mapped[str | None] = mapped_column(String(64))
    narrow_alley: Mapped[bool] = mapped_column(Boolean, default=False)
    restricted_hours_json: Mapped[dict | list | None] = mapped_column(JSON)
    max_vehicle_weight_ton: Mapped[float | None] = mapped_column(Numeric(18, 3))
    bad_road_level: Mapped[str | None] = mapped_column(String(64))
    high_floor_level: Mapped[str | None] = mapped_column(String(64))
    requires_pump: Mapped[bool] = mapped_column(Boolean, default=False)
    preferred_pump_type: Mapped[str | None] = mapped_column(String(64))
    extra_setup_minutes: Mapped[int | None] = mapped_column(Integer)
    extra_risk_score: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text)


class ProjectSite(TimestampMixin, Base):
    __tablename__ = "project_sites"

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id"), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    site_name: Mapped[str] = mapped_column(String(255), nullable=False)
    site_type: Mapped[str | None] = mapped_column(String(64))
    address_line: Mapped[str] = mapped_column(String(500), nullable=False)
    ward: Mapped[str | None] = mapped_column(String(128))
    district: Mapped[str | None] = mapped_column(String(128))
    city: Mapped[str | None] = mapped_column(String(128))
    latitude: Mapped[float | None] = mapped_column(Numeric(12, 8))
    longitude: Mapped[float | None] = mapped_column(Numeric(12, 8))
    geom: Mapped[str | None] = mapped_column(Text)
    access_profile_id: Mapped[str | None] = mapped_column(ForeignKey("site_access_profiles.id"))
    default_contact_id: Mapped[str | None] = mapped_column(ForeignKey("customer_contacts.id"))
    default_plant_id: Mapped[str | None] = mapped_column(ForeignKey("plants.id"))
    status: Mapped[str] = mapped_column(String(32), default="active")


class Plant(TimestampMixin, Base):
    __tablename__ = "plants"

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    business_unit_id: Mapped[str | None] = mapped_column(ForeignKey("business_units.id"))
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    address: Mapped[str | None] = mapped_column(String(500))
    latitude: Mapped[float | None] = mapped_column(Numeric(12, 8))
    longitude: Mapped[float | None] = mapped_column(Numeric(12, 8))
    geom: Mapped[str | None] = mapped_column(Text)
    max_output_m3_per_hour: Mapped[float | None] = mapped_column(Numeric(18, 3))
    loading_bays_count: Mapped[int | None] = mapped_column(Integer)
    default_load_minutes: Mapped[int | None] = mapped_column(Integer)
    default_wash_minutes: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(32), default="active")


class PlantLoadingBay(TimestampMixin, Base):
    __tablename__ = "plant_loading_bays"

    plant_id: Mapped[str] = mapped_column(ForeignKey("plants.id"), nullable=False)
    bay_code: Mapped[str] = mapped_column(String(50), nullable=False)
    sequence_no: Mapped[int] = mapped_column(Integer, default=1)
    max_concurrent_trucks: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(32), default="active")


class VehicleType(TimestampMixin, Base):
    __tablename__ = "vehicle_types"

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    default_capacity_m3: Mapped[float | None] = mapped_column(Numeric(18, 3))
    notes: Mapped[str | None] = mapped_column(Text)


class Vehicle(TimestampMixin, Base):
    __tablename__ = "vehicles"

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    vehicle_type_id: Mapped[str | None] = mapped_column(ForeignKey("vehicle_types.id"))
    home_plant_id: Mapped[str | None] = mapped_column(ForeignKey("plants.id"))
    plate_no: Mapped[str] = mapped_column(String(32), nullable=False)
    capacity_m3: Mapped[float | None] = mapped_column(Numeric(18, 3))
    effective_capacity_m3: Mapped[float | None] = mapped_column(Numeric(18, 3))
    status: Mapped[str] = mapped_column(String(32), default="active")
    current_odometer_km: Mapped[float | None] = mapped_column(Numeric(18, 3))
    driver_employee_id: Mapped[str | None] = mapped_column(ForeignKey("employees.id"))
    gps_device_code: Mapped[str | None] = mapped_column(String(128))
    last_maintenance_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    next_maintenance_due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Pump(TimestampMixin, Base):
    __tablename__ = "pumps"

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    home_plant_id: Mapped[str | None] = mapped_column(ForeignKey("plants.id"))
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    pump_type: Mapped[str | None] = mapped_column(String(64))
    boom_length_m: Mapped[float | None] = mapped_column(Numeric(18, 3))
    capacity_m3_per_hour: Mapped[float | None] = mapped_column(Numeric(18, 3))
    default_setup_minutes: Mapped[int | None] = mapped_column(Integer)
    default_teardown_minutes: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(32), default="active")


class Asset(TimestampMixin, Base):
    __tablename__ = "assets"

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    cost_center_id: Mapped[str | None] = mapped_column(String(36))
    asset_code: Mapped[str] = mapped_column(String(50), nullable=False)
    asset_name: Mapped[str] = mapped_column(String(255), nullable=False)
    asset_type: Mapped[str | None] = mapped_column(String(64))
    serial_no: Mapped[str | None] = mapped_column(String(128))
    commissioned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(32), default="active")


class Material(TimestampMixin, Base):
    __tablename__ = "materials"

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    material_type: Mapped[str | None] = mapped_column(String(64))
    uom: Mapped[str | None] = mapped_column(String(32))
    density: Mapped[float | None] = mapped_column(Numeric(18, 3))
    default_cost_method: Mapped[str | None] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(32), default="active")


class ConcreteProduct(TimestampMixin, Base):
    __tablename__ = "concrete_products"

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    grade_code: Mapped[str | None] = mapped_column(String(64))
    slump: Mapped[str | None] = mapped_column(String(64))
    strength_mpa: Mapped[float | None] = mapped_column(Numeric(18, 3))
    is_pumpable: Mapped[bool] = mapped_column(Boolean, default=True)
    base_uom: Mapped[str | None] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(32), default="active")


class MixDesign(TimestampMixin, Base):
    __tablename__ = "mix_designs"

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    concrete_product_id: Mapped[str] = mapped_column(ForeignKey("concrete_products.id"), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    effective_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    effective_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    yield_m3: Mapped[float | None] = mapped_column(Numeric(18, 3))
    status: Mapped[str] = mapped_column(String(32), default="active")
    notes: Mapped[str | None] = mapped_column(Text)


class MixDesignComponent(TimestampMixin, Base):
    __tablename__ = "mix_design_components"

    mix_design_id: Mapped[str] = mapped_column(ForeignKey("mix_designs.id"), nullable=False)
    material_id: Mapped[str] = mapped_column(ForeignKey("materials.id"), nullable=False)
    quantity_per_batch: Mapped[float | None] = mapped_column(Numeric(18, 3))
    quantity_per_m3: Mapped[float | None] = mapped_column(Numeric(18, 3))
    loss_factor_pct: Mapped[float | None] = mapped_column(Numeric(18, 3))


class SystemSetting(TimestampMixin, Base):
    __tablename__ = "system_settings"

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    key: Mapped[str] = mapped_column(String(128), nullable=False)
    value_json: Mapped[dict | list | None] = mapped_column(JSON)
    description: Mapped[str | None] = mapped_column(Text)


class AuditLog(TimestampMixin, Base):
    __tablename__ = "audit_logs"

    organization_id: Mapped[str | None] = mapped_column(String(36))
    user_id: Mapped[str | None] = mapped_column(String(36))
    entity_type: Mapped[str] = mapped_column(String(128), nullable=False)
    entity_id: Mapped[str | None] = mapped_column(String(36))
    action: Mapped[str] = mapped_column(String(32), nullable=False)
    before_json: Mapped[dict | list | None] = mapped_column(JSON)
    after_json: Mapped[dict | list | None] = mapped_column(JSON)
    ip_address: Mapped[str | None] = mapped_column(String(64))
    user_agent: Mapped[str | None] = mapped_column(String(500))
    request_id: Mapped[str | None] = mapped_column(String(64))
    logged_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Attachment(TimestampMixin, Base):
    __tablename__ = "attachments"

    entity_type: Mapped[str] = mapped_column(String(128), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(36), nullable=False)
    file_key: Mapped[str] = mapped_column(String(512), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str | None] = mapped_column(String(128))
    size_bytes: Mapped[int | None] = mapped_column(Integer)
    uploaded_by: Mapped[str | None] = mapped_column(String(36))
    uploaded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
