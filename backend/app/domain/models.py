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


class PriceBook(TimestampMixin, Base):
    __tablename__ = "price_books"

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    region_scope: Mapped[str | None] = mapped_column(String(128))
    customer_scope: Mapped[str | None] = mapped_column(String(128))
    effective_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    effective_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(32), default="draft")
    priority: Mapped[int] = mapped_column(Integer, default=0)


class PriceRule(TimestampMixin, Base):
    __tablename__ = "price_rules"

    price_book_id: Mapped[str] = mapped_column(ForeignKey("price_books.id"), nullable=False)
    rule_type: Mapped[str] = mapped_column(String(64), nullable=False)
    rule_name: Mapped[str] = mapped_column(String(255), nullable=False)
    condition_json: Mapped[dict | list | None] = mapped_column(JSON)
    formula_json: Mapped[dict | list | None] = mapped_column(JSON)
    scope_region: Mapped[str | None] = mapped_column(String(128))
    scope_customer_id: Mapped[str | None] = mapped_column(ForeignKey("customers.id"))
    scope_plant_id: Mapped[str | None] = mapped_column(ForeignKey("plants.id"))
    priority: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Quotation(TimestampMixin, Base):
    __tablename__ = "quotations"

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id"), nullable=False)
    site_id: Mapped[str | None] = mapped_column(ForeignKey("project_sites.id"))
    quotation_no: Mapped[str] = mapped_column(String(64), nullable=False)
    price_book_id: Mapped[str | None] = mapped_column(ForeignKey("price_books.id"))
    valid_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    valid_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(32), default="draft")
    notes: Mapped[str | None] = mapped_column(Text)
    discount_override_pct: Mapped[float | None] = mapped_column(Numeric(8, 3))
    discount_override_amount: Mapped[float | None] = mapped_column(Numeric(18, 2))
    approval_status: Mapped[str] = mapped_column(String(32), default="pending")
    approved_by: Mapped[str | None] = mapped_column(String(36))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    approval_note: Mapped[str | None] = mapped_column(Text)


class QuotationItem(TimestampMixin, Base):
    __tablename__ = "quotation_items"

    quotation_id: Mapped[str] = mapped_column(ForeignKey("quotations.id"), nullable=False)
    concrete_product_id: Mapped[str] = mapped_column(ForeignKey("concrete_products.id"), nullable=False)
    quoted_volume_m3: Mapped[float | None] = mapped_column(Numeric(18, 3))
    distance_km: Mapped[float | None] = mapped_column(Numeric(18, 3))
    difficulty_level: Mapped[str | None] = mapped_column(String(64))
    requires_pump: Mapped[bool] = mapped_column(Boolean, default=False)
    base_price: Mapped[float | None] = mapped_column(Numeric(18, 2))
    distance_fee: Mapped[float | None] = mapped_column(Numeric(18, 2))
    difficulty_fee: Mapped[float | None] = mapped_column(Numeric(18, 2))
    pump_fee: Mapped[float | None] = mapped_column(Numeric(18, 2))
    surcharge_fee: Mapped[float | None] = mapped_column(Numeric(18, 2))
    discount_fee: Mapped[float | None] = mapped_column(Numeric(18, 2))
    final_unit_price: Mapped[float | None] = mapped_column(Numeric(18, 2))
    total_amount: Mapped[float | None] = mapped_column(Numeric(18, 2))
    pricing_snapshot_json: Mapped[dict | list | None] = mapped_column(JSON)


class SalesOrder(TimestampMixin, Base):
    __tablename__ = "sales_orders"

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id"), nullable=False)
    site_id: Mapped[str | None] = mapped_column(ForeignKey("project_sites.id"))
    quotation_id: Mapped[str | None] = mapped_column(ForeignKey("quotations.id"))
    order_no: Mapped[str] = mapped_column(String(64), nullable=False)
    contract_no: Mapped[str | None] = mapped_column(String(64))
    ordered_by_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    payment_terms_days: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(32), default="draft")
    notes: Mapped[str | None] = mapped_column(Text)


class PourRequest(TimestampMixin, Base):
    __tablename__ = "pour_requests"

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    sales_order_id: Mapped[str | None] = mapped_column(ForeignKey("sales_orders.id"))
    request_no: Mapped[str] = mapped_column(String(64), nullable=False)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id"), nullable=False)
    site_id: Mapped[str] = mapped_column(ForeignKey("project_sites.id"), nullable=False)
    concrete_product_id: Mapped[str] = mapped_column(ForeignKey("concrete_products.id"), nullable=False)
    assigned_plant_id: Mapped[str | None] = mapped_column(ForeignKey("plants.id"))
    requested_volume_m3: Mapped[float] = mapped_column(Numeric(18, 3), nullable=False)
    requested_date: Mapped[datetime | None] = mapped_column(Date)
    requested_start_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    requested_end_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    pour_method: Mapped[str | None] = mapped_column(String(64))
    requires_pump: Mapped[bool] = mapped_column(Boolean, default=False)
    expected_pump_type: Mapped[str | None] = mapped_column(String(64))
    difficulty_level: Mapped[str | None] = mapped_column(String(64))
    site_contact_name: Mapped[str | None] = mapped_column(String(255))
    site_contact_phone: Mapped[str | None] = mapped_column(String(32))
    special_constraints_json: Mapped[dict | list | None] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(32), default="draft")


class PourRequestTimeWindow(TimestampMixin, Base):
    __tablename__ = "pour_request_time_windows"

    pour_request_id: Mapped[str] = mapped_column(ForeignKey("pour_requests.id"), nullable=False)
    window_start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    window_end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    priority: Mapped[int] = mapped_column(Integer, default=0)


class PriceCalculationSnapshot(TimestampMixin, Base):
    __tablename__ = "price_calculation_snapshots"

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    source_type: Mapped[str] = mapped_column(String(64), nullable=False)
    source_id: Mapped[str] = mapped_column(String(36), nullable=False)
    price_book_id: Mapped[str | None] = mapped_column(ForeignKey("price_books.id"))
    input_snapshot_json: Mapped[dict | list | None] = mapped_column(JSON)
    result_snapshot_json: Mapped[dict | list | None] = mapped_column(JSON)
    final_unit_price: Mapped[float | None] = mapped_column(Numeric(18, 2))
    calculated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    calculated_by: Mapped[str | None] = mapped_column(String(36))


class OperationalShift(TimestampMixin, Base):
    __tablename__ = "operational_shifts"

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    business_unit_id: Mapped[str | None] = mapped_column(ForeignKey("business_units.id"))
    plant_id: Mapped[str | None] = mapped_column(ForeignKey("plants.id"))
    shift_code: Mapped[str] = mapped_column(String(32), nullable=False)
    shift_date: Mapped[datetime | None] = mapped_column(Date)
    shift_start_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    shift_end_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(32), default="active")


class VehicleAvailability(TimestampMixin, Base):
    __tablename__ = "vehicle_availabilities"

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    vehicle_id: Mapped[str] = mapped_column(ForeignKey("vehicles.id"), nullable=False)
    shift_date: Mapped[datetime | None] = mapped_column(Date)
    shift_start_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    shift_end_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)
    reason: Mapped[str | None] = mapped_column(Text)


class PumpAvailability(TimestampMixin, Base):
    __tablename__ = "pump_availabilities"

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    pump_id: Mapped[str] = mapped_column(ForeignKey("pumps.id"), nullable=False)
    shift_date: Mapped[datetime | None] = mapped_column(Date)
    shift_start_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    shift_end_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)
    reason: Mapped[str | None] = mapped_column(Text)


class ResourceLock(TimestampMixin, Base):
    __tablename__ = "resource_locks"

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(32), nullable=False)
    resource_id: Mapped[str] = mapped_column(String(36), nullable=False)
    lock_scope: Mapped[str] = mapped_column(String(64), nullable=False)
    lock_ref_id: Mapped[str | None] = mapped_column(String(36))
    field_name: Mapped[str | None] = mapped_column(String(64))
    reason: Mapped[str | None] = mapped_column(Text)
    locked_by: Mapped[str | None] = mapped_column(String(36))
    locked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class PlantCapacitySlot(TimestampMixin, Base):
    __tablename__ = "plant_capacity_slots"

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    plant_id: Mapped[str] = mapped_column(ForeignKey("plants.id"), nullable=False)
    slot_start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    slot_end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    max_loads: Mapped[int] = mapped_column(Integer, default=1)
    used_loads: Mapped[int] = mapped_column(Integer, default=0)
    slot_status: Mapped[str] = mapped_column(String(32), default="open")


class TravelEstimate(TimestampMixin, Base):
    __tablename__ = "travel_estimates"

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    plant_id: Mapped[str | None] = mapped_column(ForeignKey("plants.id"))
    site_id: Mapped[str | None] = mapped_column(ForeignKey("project_sites.id"))
    route_key: Mapped[str] = mapped_column(String(255), nullable=False)
    estimated_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    distance_km: Mapped[float | None] = mapped_column(Numeric(18, 3))
    source: Mapped[str] = mapped_column(String(32), default="manual")
    confidence_pct: Mapped[float | None] = mapped_column(Numeric(5, 2))
    cached_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ScheduleRun(TimestampMixin, Base):
    __tablename__ = "schedule_runs"

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    run_code: Mapped[str] = mapped_column(String(64), nullable=False)
    run_date: Mapped[datetime | None] = mapped_column(Date)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(32), default="running")
    algorithm_version: Mapped[str] = mapped_column(String(64), default="heuristic_v1")
    input_snapshot_json: Mapped[dict | list | None] = mapped_column(JSON)
    result_summary_json: Mapped[dict | list | None] = mapped_column(JSON)
    explanation_json: Mapped[dict | list | None] = mapped_column(JSON)
    created_by: Mapped[str | None] = mapped_column(String(36))
    manual_override_count: Mapped[int] = mapped_column(Integer, default=0)


class DispatchOrder(TimestampMixin, Base):
    __tablename__ = "dispatch_orders"
    __table_args__ = (UniqueConstraint("pour_request_id", name="uq_dispatch_orders_pour_request"),)

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    pour_request_id: Mapped[str] = mapped_column(ForeignKey("pour_requests.id"), nullable=False)
    sales_order_id: Mapped[str | None] = mapped_column(ForeignKey("sales_orders.id"))
    customer_id: Mapped[str | None] = mapped_column(ForeignKey("customers.id"))
    site_id: Mapped[str | None] = mapped_column(ForeignKey("project_sites.id"))
    assigned_plant_id: Mapped[str | None] = mapped_column(ForeignKey("plants.id"))
    assigned_pump_id: Mapped[str | None] = mapped_column(ForeignKey("pumps.id"))
    target_truck_rhythm_minutes: Mapped[int | None] = mapped_column(Integer)
    approval_status: Mapped[str] = mapped_column(String(32), default="pending")
    approval_note: Mapped[str | None] = mapped_column(Text)
    approved_by: Mapped[str | None] = mapped_column(String(36))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    dispatch_lock: Mapped[bool] = mapped_column(Boolean, default=False)
    locked_fields_json: Mapped[dict | list | None] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(32), default="draft")


class ScheduledTrip(TimestampMixin, Base):
    __tablename__ = "scheduled_trips"
    __table_args__ = (
        UniqueConstraint(
            "schedule_run_id",
            "dispatch_order_id",
            "trip_no",
            name="uq_scheduled_trips_run_dispatch_tripno",
        ),
    )

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    schedule_run_id: Mapped[str] = mapped_column(ForeignKey("schedule_runs.id"), nullable=False)
    dispatch_order_id: Mapped[str] = mapped_column(ForeignKey("dispatch_orders.id"), nullable=False)
    pour_request_id: Mapped[str | None] = mapped_column(ForeignKey("pour_requests.id"))
    trip_no: Mapped[int] = mapped_column(Integer, nullable=False)
    assigned_vehicle_id: Mapped[str | None] = mapped_column(ForeignKey("vehicles.id"))
    assigned_pump_id: Mapped[str | None] = mapped_column(ForeignKey("pumps.id"))
    assigned_plant_id: Mapped[str | None] = mapped_column(ForeignKey("plants.id"))
    planned_volume_m3: Mapped[float | None] = mapped_column(Numeric(18, 3))
    planned_load_start_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    planned_load_end_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    planned_depart_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    planned_arrive_site_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    planned_pour_start_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    planned_pour_end_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    planned_return_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cycle_minutes: Mapped[int | None] = mapped_column(Integer)
    priority_score: Mapped[float | None] = mapped_column(Numeric(18, 4))
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False)
    lock_reason: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="assigned")


class ScheduleConflict(TimestampMixin, Base):
    __tablename__ = "schedule_conflicts"

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    schedule_run_id: Mapped[str] = mapped_column(ForeignKey("schedule_runs.id"), nullable=False)
    dispatch_order_id: Mapped[str | None] = mapped_column(ForeignKey("dispatch_orders.id"))
    conflict_type: Mapped[str] = mapped_column(String(64), nullable=False)
    severity: Mapped[str] = mapped_column(String(16), default="warning")
    message: Mapped[str] = mapped_column(Text, nullable=False)
    conflict_payload_json: Mapped[dict | list | None] = mapped_column(JSON)
    is_resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    resolved_by: Mapped[str | None] = mapped_column(String(36))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ScheduleVersion(TimestampMixin, Base):
    __tablename__ = "schedule_versions"

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    dispatch_order_id: Mapped[str | None] = mapped_column(ForeignKey("dispatch_orders.id"))
    scheduled_trip_id: Mapped[str | None] = mapped_column(ForeignKey("scheduled_trips.id"))
    change_type: Mapped[str] = mapped_column(String(64), nullable=False)
    before_json: Mapped[dict | list | None] = mapped_column(JSON)
    after_json: Mapped[dict | list | None] = mapped_column(JSON)
    changed_by: Mapped[str | None] = mapped_column(String(36))
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ManualOverride(TimestampMixin, Base):
    __tablename__ = "manual_overrides"

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    schedule_run_id: Mapped[str | None] = mapped_column(ForeignKey("schedule_runs.id"))
    dispatch_order_id: Mapped[str | None] = mapped_column(ForeignKey("dispatch_orders.id"))
    scheduled_trip_id: Mapped[str | None] = mapped_column(ForeignKey("scheduled_trips.id"))
    override_type: Mapped[str] = mapped_column(String(64), nullable=False)
    override_payload_json: Mapped[dict | list | None] = mapped_column(JSON)
    note: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[str | None] = mapped_column(String(36))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Trip(TimestampMixin, Base):
    __tablename__ = "trips"

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    scheduled_trip_id: Mapped[str | None] = mapped_column(ForeignKey("scheduled_trips.id"))
    dispatch_order_id: Mapped[str | None] = mapped_column(ForeignKey("dispatch_orders.id"))
    pour_request_id: Mapped[str | None] = mapped_column(ForeignKey("pour_requests.id"))
    vehicle_id: Mapped[str | None] = mapped_column(ForeignKey("vehicles.id"))
    pump_id: Mapped[str | None] = mapped_column(ForeignKey("pumps.id"))
    status: Mapped[str] = mapped_column(String(32), default="assigned")
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    actual_volume_m3: Mapped[float | None] = mapped_column(Numeric(18, 3))
    actual_distance_km: Mapped[float | None] = mapped_column(Numeric(18, 3))
    delay_reason_code: Mapped[str | None] = mapped_column(String(64))


class TripEvent(TimestampMixin, Base):
    __tablename__ = "trip_events"
    __table_args__ = (
        UniqueConstraint("organization_id", "idempotency_key", name="uq_trip_events_org_idem"),
    )

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    trip_id: Mapped[str] = mapped_column(ForeignKey("trips.id"), nullable=False)
    scheduled_trip_id: Mapped[str | None] = mapped_column(ForeignKey("scheduled_trips.id"))
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    event_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    idempotency_key: Mapped[str | None] = mapped_column(String(128))
    event_payload_json: Mapped[dict | list | None] = mapped_column(JSON)
    reported_by_user_id: Mapped[str | None] = mapped_column(String(36))
    source: Mapped[str] = mapped_column(String(64), default="mobile_driver")


class PumpSession(TimestampMixin, Base):
    __tablename__ = "pump_sessions"

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    trip_id: Mapped[str | None] = mapped_column(ForeignKey("trips.id"))
    scheduled_trip_id: Mapped[str | None] = mapped_column(ForeignKey("scheduled_trips.id"))
    pump_id: Mapped[str | None] = mapped_column(ForeignKey("pumps.id"))
    session_status: Mapped[str] = mapped_column(String(32), default="assigned")
    setup_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    pump_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    pump_ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    teardown_ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    actual_volume_m3: Mapped[float | None] = mapped_column(Numeric(18, 3))
    note: Mapped[str | None] = mapped_column(Text)


class PumpEvent(TimestampMixin, Base):
    __tablename__ = "pump_events"
    __table_args__ = (
        UniqueConstraint("organization_id", "idempotency_key", name="uq_pump_events_org_idem"),
    )

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    pump_session_id: Mapped[str] = mapped_column(ForeignKey("pump_sessions.id"), nullable=False)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    event_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    idempotency_key: Mapped[str | None] = mapped_column(String(128))
    event_payload_json: Mapped[dict | list | None] = mapped_column(JSON)
    reported_by_user_id: Mapped[str | None] = mapped_column(String(36))
    source: Mapped[str] = mapped_column(String(64), default="mobile_pump")


class BatchTicket(TimestampMixin, Base):
    __tablename__ = "batch_tickets"

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    trip_id: Mapped[str | None] = mapped_column(ForeignKey("trips.id"))
    scheduled_trip_id: Mapped[str | None] = mapped_column(ForeignKey("scheduled_trips.id"))
    ticket_no: Mapped[str] = mapped_column(String(64), nullable=False)
    plant_id: Mapped[str | None] = mapped_column(ForeignKey("plants.id"))
    vehicle_id: Mapped[str | None] = mapped_column(ForeignKey("vehicles.id"))
    concrete_product_id: Mapped[str | None] = mapped_column(ForeignKey("concrete_products.id"))
    load_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    load_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    loaded_volume_m3: Mapped[float | None] = mapped_column(Numeric(18, 3))
    status: Mapped[str] = mapped_column(String(32), default="open")


class BatchTicketComponent(TimestampMixin, Base):
    __tablename__ = "batch_ticket_components"

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    batch_ticket_id: Mapped[str] = mapped_column(ForeignKey("batch_tickets.id"), nullable=False)
    material_id: Mapped[str | None] = mapped_column(ForeignKey("materials.id"))
    target_qty: Mapped[float | None] = mapped_column(Numeric(18, 3))
    actual_qty: Mapped[float | None] = mapped_column(Numeric(18, 3))


class GpsPing(TimestampMixin, Base):
    __tablename__ = "gps_pings"

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    vehicle_id: Mapped[str] = mapped_column(ForeignKey("vehicles.id"), nullable=False)
    scheduled_trip_id: Mapped[str | None] = mapped_column(ForeignKey("scheduled_trips.id"))
    pinged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    latitude: Mapped[float] = mapped_column(Numeric(10, 7), nullable=False)
    longitude: Mapped[float] = mapped_column(Numeric(10, 7), nullable=False)
    speed_kph: Mapped[float | None] = mapped_column(Numeric(10, 2))
    heading_deg: Mapped[float | None] = mapped_column(Numeric(10, 2))
    source: Mapped[str] = mapped_column(String(64), default="mobile_driver")


class Notification(TimestampMixin, Base):
    __tablename__ = "notifications"

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    channel: Mapped[str] = mapped_column(String(32), nullable=False)
    template_code: Mapped[str | None] = mapped_column(String(64))
    recipient: Mapped[str] = mapped_column(String(255), nullable=False)
    payload_json: Mapped[dict | list | None] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(32), default="queued")
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    related_entity_type: Mapped[str | None] = mapped_column(String(64))
    related_entity_id: Mapped[str | None] = mapped_column(String(36))
    error_message: Mapped[str | None] = mapped_column(Text)


class OfflineSyncQueue(TimestampMixin, Base):
    __tablename__ = "offline_sync_queue"

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    device_id: Mapped[str | None] = mapped_column(String(128))
    channel: Mapped[str] = mapped_column(String(32), nullable=False)
    payload_json: Mapped[dict | list | None] = mapped_column(JSON)
    idempotency_key: Mapped[str | None] = mapped_column(String(128))
    status: Mapped[str] = mapped_column(String(32), default="queued")
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    error_message: Mapped[str | None] = mapped_column(Text)


class EventIngestion(TimestampMixin, Base):
    __tablename__ = "event_ingestions"
    __table_args__ = (
        UniqueConstraint("organization_id", "idempotency_key", name="uq_event_ingestions_org_idem"),
    )

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    channel: Mapped[str] = mapped_column(String(32), nullable=False)
    idempotency_key: Mapped[str] = mapped_column(String(128), nullable=False)
    request_payload_json: Mapped[dict | list | None] = mapped_column(JSON)
    response_payload_json: Mapped[dict | list | None] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(32), default="success")
    processed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ReconciliationRecord(TimestampMixin, Base):
    __tablename__ = "reconciliation_records"

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    pour_request_id: Mapped[str | None] = mapped_column(ForeignKey("pour_requests.id"))
    dispatch_order_id: Mapped[str | None] = mapped_column(ForeignKey("dispatch_orders.id"))
    planned_volume_m3: Mapped[float | None] = mapped_column(Numeric(18, 3))
    actual_volume_m3: Mapped[float | None] = mapped_column(Numeric(18, 3))
    planned_trip_count: Mapped[int | None] = mapped_column(Integer)
    actual_trip_count: Mapped[int | None] = mapped_column(Integer)
    variance_volume_m3: Mapped[float | None] = mapped_column(Numeric(18, 3))
    variance_trip_count: Mapped[int | None] = mapped_column(Integer)
    reason_code: Mapped[str | None] = mapped_column(String(64))
    note: Mapped[str | None] = mapped_column(Text)
    reconciled_by: Mapped[str | None] = mapped_column(String(36))
    reconciled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="closed")


class DailyKpiSnapshot(TimestampMixin, Base):
    __tablename__ = "daily_kpi_snapshots"

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    snapshot_date: Mapped[datetime | None] = mapped_column(Date)
    plant_id: Mapped[str | None] = mapped_column(ForeignKey("plants.id"))
    on_time_pct: Mapped[float | None] = mapped_column(Numeric(5, 2))
    avg_cycle_minutes: Mapped[float | None] = mapped_column(Numeric(10, 2))
    vehicle_utilization_pct: Mapped[float | None] = mapped_column(Numeric(5, 2))
    pump_utilization_pct: Mapped[float | None] = mapped_column(Numeric(5, 2))
    empty_km: Mapped[float | None] = mapped_column(Numeric(18, 3))
    trips_count: Mapped[int | None] = mapped_column(Integer)
    volume_m3: Mapped[float | None] = mapped_column(Numeric(18, 3))
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Warehouse(TimestampMixin, Base):
    __tablename__ = "warehouses"
    __table_args__ = (UniqueConstraint("organization_id", "code", name="uq_warehouses_org_code"),)

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    business_unit_id: Mapped[str | None] = mapped_column(ForeignKey("business_units.id"))
    plant_id: Mapped[str | None] = mapped_column(ForeignKey("plants.id"))
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    address: Mapped[str | None] = mapped_column(String(500))
    manager_name: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(32), default="active")
    notes: Mapped[str | None] = mapped_column(Text)


class CostCenter(TimestampMixin, Base):
    __tablename__ = "cost_centers"
    __table_args__ = (UniqueConstraint("organization_id", "code", name="uq_cost_centers_org_code"),)

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    parent_id: Mapped[str | None] = mapped_column(ForeignKey("cost_centers.id"))
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    center_type: Mapped[str | None] = mapped_column(String(64))
    level_no: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(32), default="active")
    notes: Mapped[str | None] = mapped_column(Text)


class CostObject(TimestampMixin, Base):
    __tablename__ = "cost_objects"
    __table_args__ = (UniqueConstraint("organization_id", "code", name="uq_cost_objects_org_code"),)

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    cost_center_id: Mapped[str | None] = mapped_column(ForeignKey("cost_centers.id"))
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    object_type: Mapped[str | None] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(32), default="active")
    notes: Mapped[str | None] = mapped_column(Text)


class CostPeriod(TimestampMixin, Base):
    __tablename__ = "cost_periods"
    __table_args__ = (UniqueConstraint("organization_id", "period_code", name="uq_cost_periods_org_code"),)

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    period_code: Mapped[str] = mapped_column(String(32), nullable=False)
    start_date: Mapped[datetime | None] = mapped_column(Date)
    end_date: Mapped[datetime | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(32), default="draft")
    preclose_check_json: Mapped[dict | list | None] = mapped_column(JSON)
    opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    opened_by: Mapped[str | None] = mapped_column(String(36))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    closed_by: Mapped[str | None] = mapped_column(String(36))
    reopened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reopened_by: Mapped[str | None] = mapped_column(String(36))
    note: Mapped[str | None] = mapped_column(Text)


class ProductionLog(TimestampMixin, Base):
    __tablename__ = "production_logs"

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    period_id: Mapped[str | None] = mapped_column(ForeignKey("cost_periods.id"))
    plant_id: Mapped[str | None] = mapped_column(ForeignKey("plants.id"))
    shift_date: Mapped[datetime | None] = mapped_column(Date)
    log_type: Mapped[str] = mapped_column(String(32), default="batching")
    production_line: Mapped[str | None] = mapped_column(String(64))
    material_id: Mapped[str | None] = mapped_column(ForeignKey("materials.id"))
    concrete_product_id: Mapped[str | None] = mapped_column(ForeignKey("concrete_products.id"))
    input_qty: Mapped[float | None] = mapped_column(Numeric(18, 3))
    output_qty: Mapped[float | None] = mapped_column(Numeric(18, 3))
    runtime_minutes: Mapped[int | None] = mapped_column(Integer)
    downtime_minutes: Mapped[int | None] = mapped_column(Integer)
    electricity_kwh: Mapped[float | None] = mapped_column(Numeric(18, 3))
    labor_hours: Mapped[float | None] = mapped_column(Numeric(18, 2))
    maintenance_cost: Mapped[float | None] = mapped_column(Numeric(18, 2))
    note: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="posted")


class CostPool(TimestampMixin, Base):
    __tablename__ = "cost_pools"
    __table_args__ = (UniqueConstraint("organization_id", "period_id", "pool_code", name="uq_cost_pools_period_code"),)

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    period_id: Mapped[str] = mapped_column(ForeignKey("cost_periods.id"), nullable=False)
    pool_code: Mapped[str] = mapped_column(String(64), nullable=False)
    pool_name: Mapped[str] = mapped_column(String(255), nullable=False)
    cost_type: Mapped[str | None] = mapped_column(String(64))
    amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    source_reference: Mapped[str | None] = mapped_column(String(128))
    status: Mapped[str] = mapped_column(String(32), default="active")
    note: Mapped[str | None] = mapped_column(Text)


class AllocationRule(TimestampMixin, Base):
    __tablename__ = "allocation_rules"

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    period_id: Mapped[str] = mapped_column(ForeignKey("cost_periods.id"), nullable=False)
    pool_id: Mapped[str] = mapped_column(ForeignKey("cost_pools.id"), nullable=False)
    cost_center_id: Mapped[str | None] = mapped_column(ForeignKey("cost_centers.id"))
    cost_object_id: Mapped[str | None] = mapped_column(ForeignKey("cost_objects.id"))
    basis_type: Mapped[str] = mapped_column(String(32), default="manual_ratio")
    ratio_value: Mapped[float | None] = mapped_column(Numeric(18, 6))
    priority: Mapped[int] = mapped_column(Integer, default=100)
    status: Mapped[str] = mapped_column(String(32), default="active")
    note: Mapped[str | None] = mapped_column(Text)


class AllocationRun(TimestampMixin, Base):
    __tablename__ = "allocation_runs"

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    period_id: Mapped[str] = mapped_column(ForeignKey("cost_periods.id"), nullable=False)
    run_code: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="running")
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    summary_json: Mapped[dict | list | None] = mapped_column(JSON)
    run_by: Mapped[str | None] = mapped_column(String(36))
    note: Mapped[str | None] = mapped_column(Text)


class AllocationResult(TimestampMixin, Base):
    __tablename__ = "allocation_results"

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    allocation_run_id: Mapped[str] = mapped_column(ForeignKey("allocation_runs.id"), nullable=False)
    pool_id: Mapped[str | None] = mapped_column(ForeignKey("cost_pools.id"))
    rule_id: Mapped[str | None] = mapped_column(ForeignKey("allocation_rules.id"))
    cost_center_id: Mapped[str | None] = mapped_column(ForeignKey("cost_centers.id"))
    cost_object_id: Mapped[str | None] = mapped_column(ForeignKey("cost_objects.id"))
    basis_type: Mapped[str | None] = mapped_column(String(32))
    basis_value: Mapped[float | None] = mapped_column(Numeric(18, 6))
    allocated_amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    detail_json: Mapped[dict | list | None] = mapped_column(JSON)


class UnitCostSnapshot(TimestampMixin, Base):
    __tablename__ = "unit_cost_snapshots"

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    period_id: Mapped[str] = mapped_column(ForeignKey("cost_periods.id"), nullable=False)
    concrete_product_id: Mapped[str | None] = mapped_column(ForeignKey("concrete_products.id"))
    snapshot_code: Mapped[str] = mapped_column(String(64), nullable=False)
    output_volume_m3: Mapped[float] = mapped_column(Numeric(18, 3), nullable=False)
    total_cost: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    unit_cost: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    source_run_id: Mapped[str | None] = mapped_column(ForeignKey("allocation_runs.id"))
    snapshot_json: Mapped[dict | list | None] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(32), default="draft")
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    closed_by: Mapped[str | None] = mapped_column(String(36))
    note: Mapped[str | None] = mapped_column(Text)


class MarginSnapshot(TimestampMixin, Base):
    __tablename__ = "margin_snapshots"

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    period_id: Mapped[str] = mapped_column(ForeignKey("cost_periods.id"), nullable=False)
    snapshot_code: Mapped[str] = mapped_column(String(64), nullable=False)
    sales_order_id: Mapped[str | None] = mapped_column(ForeignKey("sales_orders.id"))
    customer_id: Mapped[str | None] = mapped_column(ForeignKey("customers.id"))
    site_id: Mapped[str | None] = mapped_column(ForeignKey("project_sites.id"))
    concrete_product_id: Mapped[str | None] = mapped_column(ForeignKey("concrete_products.id"))
    delivered_volume_m3: Mapped[float | None] = mapped_column(Numeric(18, 3))
    revenue_amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    cost_amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    margin_amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    margin_pct: Mapped[float | None] = mapped_column(Numeric(8, 3))
    snapshot_json: Mapped[dict | list | None] = mapped_column(JSON)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    generated_by: Mapped[str | None] = mapped_column(String(36))
    note: Mapped[str | None] = mapped_column(Text)


class InventoryLedgerEntry(TimestampMixin, Base):
    __tablename__ = "inventory_ledger_entries"

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    business_unit_id: Mapped[str | None] = mapped_column(ForeignKey("business_units.id"))
    plant_id: Mapped[str | None] = mapped_column(ForeignKey("plants.id"))
    warehouse_id: Mapped[str] = mapped_column(ForeignKey("warehouses.id"), nullable=False)
    material_id: Mapped[str] = mapped_column(ForeignKey("materials.id"), nullable=False)
    movement_type: Mapped[str] = mapped_column(String(32), nullable=False)
    quantity_in: Mapped[float | None] = mapped_column(Numeric(18, 3), default=0)
    quantity_out: Mapped[float | None] = mapped_column(Numeric(18, 3), default=0)
    unit_cost: Mapped[float | None] = mapped_column(Numeric(18, 2))
    total_cost: Mapped[float | None] = mapped_column(Numeric(18, 2))
    reference_no: Mapped[str | None] = mapped_column(String(64))
    source_document_type: Mapped[str | None] = mapped_column(String(64))
    source_document_id: Mapped[str | None] = mapped_column(String(36))
    note: Mapped[str | None] = mapped_column(Text)
    transaction_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    period_id: Mapped[str | None] = mapped_column(ForeignKey("cost_periods.id"))
    created_by: Mapped[str | None] = mapped_column(String(36))
    balance_after_qty: Mapped[float | None] = mapped_column(Numeric(18, 3))


class InventoryStockTake(TimestampMixin, Base):
    __tablename__ = "inventory_stock_takes"

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    warehouse_id: Mapped[str] = mapped_column(ForeignKey("warehouses.id"), nullable=False)
    material_id: Mapped[str] = mapped_column(ForeignKey("materials.id"), nullable=False)
    stock_take_date: Mapped[datetime | None] = mapped_column(Date)
    counted_qty: Mapped[float] = mapped_column(Numeric(18, 3), nullable=False)
    system_qty: Mapped[float | None] = mapped_column(Numeric(18, 3))
    variance_qty: Mapped[float | None] = mapped_column(Numeric(18, 3))
    unit_cost: Mapped[float | None] = mapped_column(Numeric(18, 2))
    note: Mapped[str | None] = mapped_column(Text)
    period_id: Mapped[str | None] = mapped_column(ForeignKey("cost_periods.id"))
    status: Mapped[str] = mapped_column(String(32), default="posted")
    posted_by: Mapped[str | None] = mapped_column(String(36))
    posted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


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
