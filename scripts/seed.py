from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select

from app.core.auth import hash_password
from app.domain.models import (
    BusinessUnit,
    ConcreteProduct,
    Material,
    Organization,
    Permission,
    Plant,
    PriceBook,
    PriceRule,
    Pump,
    Role,
    RolePermission,
    SystemSetting,
    User,
    UserRole,
    Vehicle,
    VehicleType,
)
from app.infrastructure.db import SessionLocal


DEFAULT_MODULES = [
    "admin",
    "organizations",
    "business_units",
    "customers",
    "project_sites",
    "plants",
    "vehicles",
    "pumps",
    "materials",
    "concrete_products",
    "mix_designs",
    "system_settings",
    "attachments",
    "price_books",
    "price_rules",
    "quotations",
    "quotation_items",
    "sales_orders",
    "pour_requests",
    "pour_request_time_windows",
    "price_calculation_snapshots",
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
DEFAULT_ACTIONS = ["read", "write", "delete"]


def _get_or_create_organization(db) -> Organization:
    org = db.execute(select(Organization).where(Organization.code == "ORG_MAIN")).scalar_one_or_none()
    if org:
        return org

    org = Organization(
        code="ORG_MAIN",
        name="Web Betong Main Org",
        legal_name="Web Betong Co., Ltd",
        timezone="Asia/Ho_Chi_Minh",
        base_currency="VND",
        status="active",
    )
    db.add(org)
    db.flush()
    return org


def _get_or_create_business_unit(db, org_id: str) -> BusinessUnit:
    bu = db.execute(select(BusinessUnit).where(BusinessUnit.code == "BU_MAIN")).scalar_one_or_none()
    if bu:
        return bu

    bu = BusinessUnit(
        organization_id=org_id,
        code="BU_MAIN",
        name="Main Business Unit",
        unit_type="plant_operations",
        status="active",
    )
    db.add(bu)
    db.flush()
    return bu


def _seed_permissions_and_role(db, org_id: str) -> Role:
    role = db.execute(select(Role).where(Role.code == "SYS_ADMIN")).scalar_one_or_none()
    if role is None:
        role = Role(
            organization_id=org_id,
            code="SYS_ADMIN",
            name="System Administrator",
            description="Full access role",
            is_system=True,
        )
        db.add(role)
        db.flush()

    existing_permissions = {
        (p.module_code, p.action_code): p
        for p in db.execute(select(Permission)).scalars().all()
    }

    for module in DEFAULT_MODULES:
        for action in DEFAULT_ACTIONS:
            key = (module, action)
            permission = existing_permissions.get(key)
            if permission is None:
                permission = Permission(
                    module_code=module,
                    action_code=action,
                    description=f"{module}:{action}",
                )
                db.add(permission)
                db.flush()
                existing_permissions[key] = permission

            link_exists = db.execute(
                select(RolePermission).where(
                    RolePermission.role_id == role.id,
                    RolePermission.permission_id == permission.id,
                )
            ).scalar_one_or_none()
            if link_exists is None:
                db.add(RolePermission(role_id=role.id, permission_id=permission.id))

    return role


def _seed_admin_user(db, org_id: str, role_id: str, bu_id: str) -> User:
    user = db.execute(select(User).where(User.username == "admin")).scalar_one_or_none()
    if user is None:
        user = User(
            organization_id=org_id,
            username="admin",
            email="admin@web-betong.local",
            password_hash=hash_password("Admin@123"),
            full_name="System Admin",
            status="active",
            locale="vi",
            timezone="Asia/Ho_Chi_Minh",
            last_login_at=datetime.now(tz=timezone.utc),
        )
        db.add(user)
        db.flush()

    mapping = db.execute(
        select(UserRole).where(UserRole.user_id == user.id, UserRole.role_id == role_id)
    ).scalar_one_or_none()
    if mapping is None:
        db.add(UserRole(user_id=user.id, role_id=role_id, business_unit_id=bu_id, is_primary=True))

    return user


def _get_or_create_plant(db, org_id: str, bu_id: str, code: str, name: str, address: str) -> Plant:
    plant = db.execute(select(Plant).where(Plant.code == code)).scalar_one_or_none()
    if plant is None:
        plant = Plant(
            organization_id=org_id,
            business_unit_id=bu_id,
            code=code,
            name=name,
            address=address,
            status="active",
            loading_bays_count=2,
            default_load_minutes=15,
            default_wash_minutes=10,
            max_output_m3_per_hour=120,
        )
        db.add(plant)
        db.flush()
        return plant

    plant.organization_id = org_id
    plant.business_unit_id = bu_id
    plant.name = name
    plant.address = address
    plant.status = "active"
    db.add(plant)
    db.flush()
    return plant


def _seed_assets(db, org_id: str, bu_id: str) -> None:
    plants = [
        _get_or_create_plant(db, org_id, bu_id, "PLANT_A", "Plant A", "KCN A"),
        _get_or_create_plant(db, org_id, bu_id, "PLANT_B", "Plant B", "KCN B"),
    ]

    vehicle_type = db.execute(select(VehicleType).where(VehicleType.code == "MIXER")).scalar_one_or_none()
    if vehicle_type is None:
        vehicle_type = VehicleType(
            organization_id=org_id,
            code="MIXER",
            name="Mixer Truck",
            default_capacity_m3=7,
        )
        db.add(vehicle_type)
        db.flush()

    existing_vehicles = {vehicle.plate_no: vehicle for vehicle in db.execute(select(Vehicle)).scalars().all()}
    for idx in range(1, 25):
        plate_no = f"51D-{10000 + idx}"
        home_plant = plants[(idx - 1) % len(plants)]
        vehicle = existing_vehicles.get(plate_no)

        if vehicle is None:
            vehicle = Vehicle(
                organization_id=org_id,
                vehicle_type_id=vehicle_type.id,
                home_plant_id=home_plant.id,
                plate_no=plate_no,
                capacity_m3=7,
                effective_capacity_m3=6.5,
                status="active",
            )
            db.add(vehicle)
            continue

        vehicle.organization_id = org_id
        vehicle.vehicle_type_id = vehicle_type.id
        vehicle.home_plant_id = home_plant.id
        vehicle.status = "active"
        if vehicle.capacity_m3 is None:
            vehicle.capacity_m3 = 7
        if vehicle.effective_capacity_m3 is None:
            vehicle.effective_capacity_m3 = 6.5
        db.add(vehicle)

    pump_specs = [
        ("PUMP_1", plants[0]),
        ("PUMP_2", plants[0]),
        ("PUMP_3", plants[1]),
    ]
    existing_pumps = {pump.code: pump for pump in db.execute(select(Pump)).scalars().all()}

    for code, home_plant in pump_specs:
        pump = existing_pumps.get(code)
        if pump is None:
            db.add(
                Pump(
                    organization_id=org_id,
                    home_plant_id=home_plant.id,
                    code=code,
                    pump_type="boom",
                    boom_length_m=42,
                    capacity_m3_per_hour=35,
                    default_setup_minutes=30,
                    default_teardown_minutes=20,
                    status="active",
                )
            )
            continue

        pump.organization_id = org_id
        pump.home_plant_id = home_plant.id
        pump.status = "active"
        db.add(pump)

    material_specs = [
        ("XM40", "Xi măng PCB40", "cement", "kg"),
        ("DA12", "Đá 1x2", "aggregate", "kg"),
        ("CATV", "Cát vàng", "sand", "kg"),
    ]
    existing_materials = {material.code: material for material in db.execute(select(Material)).scalars().all()}
    for code, name, material_type, uom in material_specs:
        material = existing_materials.get(code)
        if material is None:
            db.add(
                Material(
                    organization_id=org_id,
                    code=code,
                    name=name,
                    material_type=material_type,
                    uom=uom,
                    status="active",
                )
            )
            continue

        material.organization_id = org_id
        material.name = name
        material.material_type = material_type
        material.uom = uom
        material.status = "active"
        db.add(material)

    product_specs = [
        ("M250", "Bê tông M250", 25),
        ("M300", "Bê tông M300", 30),
        ("M350", "Bê tông M350", 35),
    ]
    existing_products = {
        product.code: product for product in db.execute(select(ConcreteProduct)).scalars().all()
    }
    for code, name, strength_mpa in product_specs:
        product = existing_products.get(code)
        if product is None:
            db.add(
                ConcreteProduct(
                    organization_id=org_id,
                    code=code,
                    name=name,
                    grade_code=code,
                    strength_mpa=strength_mpa,
                    is_pumpable=True,
                    base_uom="m3",
                    status="active",
                )
            )
            continue

        product.organization_id = org_id
        product.name = name
        product.grade_code = code
        product.strength_mpa = strength_mpa
        product.is_pumpable = True
        product.base_uom = "m3"
        product.status = "active"
        db.add(product)


def _seed_phase2_pricing(db, org_id: str) -> None:
    price_book = db.execute(
        select(PriceBook).where(PriceBook.code == "PB_STD", PriceBook.organization_id == org_id)
    ).scalar_one_or_none()
    if price_book is None:
        price_book = PriceBook(
            organization_id=org_id,
            code="PB_STD",
            name="Standard Price Book",
            status="active",
            priority=10,
            effective_from=datetime.now(tz=timezone.utc),
        )
        db.add(price_book)
        db.flush()

    desired_rules = [
        {
            "rule_type": "BasePrice",
            "rule_name": "Base Price Standard",
            "priority": 100,
            "condition_json": {},
            "formula_json": {"mode": "fixed", "value": 1200000},
        },
        {
            "rule_type": "DistanceFee",
            "rule_name": "Distance Fee/km",
            "priority": 90,
            "condition_json": {"field": "distance_km", "op": "gt", "value": 0},
            "formula_json": {"mode": "per_km", "field": "distance_km", "rate": 15000},
        },
        {
            "rule_type": "DifficultyFee",
            "rule_name": "Difficulty Fee",
            "priority": 80,
            "condition_json": {"field": "difficulty_level", "op": "in", "value": ["normal", "hard"]},
            "formula_json": {
                "mode": "difficulty_map",
                "field": "difficulty_level",
                "mapping": {"easy": 0, "normal": 30000, "hard": 80000},
                "default": 0,
            },
        },
        {
            "rule_type": "PumpFee",
            "rule_name": "Pump Fee",
            "priority": 70,
            "condition_json": {"field": "requires_pump", "op": "truthy", "value": True},
            "formula_json": {"mode": "boolean", "field": "requires_pump", "true_value": 180000, "false_value": 0},
        },
        {
            "rule_type": "Surcharge",
            "rule_name": "Manual Surcharge",
            "priority": 60,
            "condition_json": {},
            "formula_json": {"mode": "passthrough", "field": "surcharge_amount"},
        },
        {
            "rule_type": "Discount",
            "rule_name": "Manual Discount",
            "priority": 50,
            "condition_json": {},
            "formula_json": {"mode": "passthrough", "field": "discount_amount"},
        },
    ]

    existing_rules = {
        rule.rule_name: rule
        for rule in db.execute(select(PriceRule).where(PriceRule.price_book_id == price_book.id)).scalars().all()
    }

    for desired in desired_rules:
        rule = existing_rules.get(desired["rule_name"])
        if rule is None:
            db.add(
                PriceRule(
                    price_book_id=price_book.id,
                    rule_type=desired["rule_type"],
                    rule_name=desired["rule_name"],
                    condition_json=desired["condition_json"],
                    formula_json=desired["formula_json"],
                    priority=desired["priority"],
                    is_active=True,
                )
            )
            continue

        rule.rule_type = desired["rule_type"]
        rule.condition_json = desired["condition_json"]
        rule.formula_json = desired["formula_json"]
        rule.priority = desired["priority"]
        rule.is_active = True
        db.add(rule)


def _seed_settings(db, org_id: str) -> None:
    existing = db.execute(
        select(SystemSetting).where(
            SystemSetting.organization_id == org_id,
            SystemSetting.key == "scheduler.defaults",
        )
    ).scalar_one_or_none()

    if existing is None:
        db.add(
            SystemSetting(
                organization_id=org_id,
                key="scheduler.defaults",
                value_json={
                    "default_travel_speed_kmh": 35,
                    "default_load_minutes": 15,
                    "default_unload_minutes": 20,
                    "default_setup_minutes": 30,
                    "default_teardown_minutes": 20,
                    "buffer_minutes": 10,
                },
                description="Default scheduler parameters",
            )
        )


def run() -> None:
    db = SessionLocal()
    try:
        org = _get_or_create_organization(db)
        bu = _get_or_create_business_unit(db, org.id)
        role = _seed_permissions_and_role(db, org.id)
        _seed_admin_user(db, org.id, role.id, bu.id)
        _seed_assets(db, org.id, bu.id)
        _seed_phase2_pricing(db, org.id)
        _seed_settings(db, org.id)

        db.commit()
        print("Seed completed successfully")
        print("Admin credentials: username=admin, password=Admin@123")
    except Exception:  # noqa: BLE001
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()
