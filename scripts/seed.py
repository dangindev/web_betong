from __future__ import annotations

from calendar import monthrange
from datetime import date, datetime, timezone

from sqlalchemy import select

from app.core.auth import hash_password
from app.domain.models import (
    BusinessUnit,
    ConcreteProduct,
    CostCenter,
    CostObject,
    CostPeriod,
    Customer,
    InventoryLedgerEntry,
    Material,
    Organization,
    Permission,
    Plant,
    PourRequest,
    PriceBook,
    PriceRule,
    ProjectSite,
    Pump,
    Role,
    RolePermission,
    SalesOrder,
    SystemSetting,
    User,
    UserRole,
    Vehicle,
    VehicleType,
    Warehouse,
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
    "warehouses",
    "inventory_ledger_entries",
    "inventory_stock_takes",
    "cost_centers",
    "cost_objects",
    "cost_periods",
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
    "inventory",
    "costing",
]
DEFAULT_ACTIONS = ["read", "write", "delete"]


def _get_or_create_organization(db) -> Organization:
    org = db.execute(select(Organization).where(Organization.code == "ORG_MAIN")).scalar_one_or_none()
    if org:
        org.name = "Công ty Bê tông An Phát"
        org.legal_name = "CÔNG TY TNHH BÊ TÔNG AN PHÁT"
        org.timezone = "Asia/Ho_Chi_Minh"
        org.base_currency = "VND"
        org.status = "active"
        db.add(org)
        db.flush()
        return org

    org = Organization(
        code="ORG_MAIN",
        name="Công ty Bê tông An Phát",
        legal_name="CÔNG TY TNHH BÊ TÔNG AN PHÁT",
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
        bu.organization_id = org_id
        bu.name = "Khối vận hành bê tông"
        bu.unit_type = "plant_operations"
        bu.status = "active"
        db.add(bu)
        db.flush()
        return bu

    bu = BusinessUnit(
        organization_id=org_id,
        code="BU_MAIN",
        name="Khối vận hành bê tông",
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
            name="Quản trị hệ thống",
            description="Toàn quyền hệ thống",
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
            email="admin@betonflow.vn",
            password_hash=hash_password("Admin@123"),
            full_name="Quản trị BetonFlow",
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
            loading_bays_count=3,
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


def _seed_assets(db, org_id: str, bu_id: str) -> tuple[list[Plant], list[Material], list[ConcreteProduct]]:
    plants = [
        _get_or_create_plant(db, org_id, bu_id, "TRAM_BTAN", "Trạm trộn Bình Tân", "KCN Tân Tạo, Bình Tân, TP.HCM"),
        _get_or_create_plant(db, org_id, bu_id, "TRAM_TDUC", "Trạm trộn Thủ Đức", "Linh Trung, Thủ Đức, TP.HCM"),
    ]

    vehicle_type = db.execute(select(VehicleType).where(VehicleType.code == "MIXER")).scalar_one_or_none()
    if vehicle_type is None:
        vehicle_type = VehicleType(
            organization_id=org_id,
            code="MIXER",
            name="Xe trộn bê tông",
            default_capacity_m3=7,
        )
        db.add(vehicle_type)
        db.flush()

    existing_vehicles = {vehicle.plate_no: vehicle for vehicle in db.execute(select(Vehicle)).scalars().all()}
    for idx in range(1, 25):
        plate_no = f"51C-{12000 + idx}"
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
        ("CBM-01", plants[0]),
        ("CBM-02", plants[0]),
        ("CBM-03", plants[1]),
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
    materials: list[Material] = []
    for code, name, material_type, uom in material_specs:
        material = existing_materials.get(code)
        if material is None:
            material = Material(
                organization_id=org_id,
                code=code,
                name=name,
                material_type=material_type,
                uom=uom,
                status="active",
            )
            db.add(material)
            db.flush()
            materials.append(material)
            continue

        material.organization_id = org_id
        material.name = name
        material.material_type = material_type
        material.uom = uom
        material.status = "active"
        db.add(material)
        db.flush()
        materials.append(material)

    product_specs = [
        ("M250", "Bê tông M250", 25),
        ("M300", "Bê tông M300", 30),
        ("M350", "Bê tông M350", 35),
    ]
    existing_products = {
        product.code: product for product in db.execute(select(ConcreteProduct)).scalars().all()
    }
    products: list[ConcreteProduct] = []
    for code, name, strength_mpa in product_specs:
        product = existing_products.get(code)
        if product is None:
            product = ConcreteProduct(
                organization_id=org_id,
                code=code,
                name=name,
                grade_code=code,
                strength_mpa=strength_mpa,
                is_pumpable=True,
                base_uom="m3",
                status="active",
            )
            db.add(product)
            db.flush()
            products.append(product)
            continue

        product.organization_id = org_id
        product.name = name
        product.grade_code = code
        product.strength_mpa = strength_mpa
        product.is_pumpable = True
        product.base_uom = "m3"
        product.status = "active"
        db.add(product)
        db.flush()
        products.append(product)

    return plants, materials, products


def _seed_real_sales_master(db, org_id: str, plants: list[Plant], products: list[ConcreteProduct]) -> None:
    customer_specs = [
        ("KH_HUNGTHINH", "Công ty CP Xây dựng Hưng Thịnh"),
        ("KH_MINHQUAN", "Công ty TNHH Minh Quân"),
        ("KH_DATPHAT", "Công ty CP Đạt Phát"),
    ]

    customers: dict[str, Customer] = {}
    for code, name in customer_specs:
        customer = db.execute(
            select(Customer).where(Customer.organization_id == org_id, Customer.code == code)
        ).scalar_one_or_none()
        if customer is None:
            customer = Customer(
                organization_id=org_id,
                code=code,
                name=name,
                status="active",
                customer_type="enterprise",
            )
            db.add(customer)
            db.flush()
        else:
            customer.name = name
            customer.status = "active"
            db.add(customer)
        customers[code] = customer

    site_specs = [
        ("CTR_ANPHU", "Dự án Chung cư An Phú", "88 Mai Chí Thọ, TP.Thủ Đức", "KH_HUNGTHINH", plants[0].id),
        ("CTR_RIVERSIDE", "Dự án Riverside Tower", "12 Nguyễn Văn Linh, Quận 7", "KH_MINHQUAN", plants[0].id),
        ("CTR_VANHANH", "Dự án Trung tâm Vận hành số", "25 Phạm Văn Đồng, TP.Thủ Đức", "KH_DATPHAT", plants[1].id),
    ]

    sites: dict[str, ProjectSite] = {}
    for code, site_name, address, customer_code, default_plant_id in site_specs:
        site = db.execute(
            select(ProjectSite).where(ProjectSite.organization_id == org_id, ProjectSite.code == code)
        ).scalar_one_or_none()
        customer = customers[customer_code]
        if site is None:
            site = ProjectSite(
                organization_id=org_id,
                customer_id=customer.id,
                code=code,
                site_name=site_name,
                address_line=address,
                default_plant_id=default_plant_id,
                status="active",
            )
            db.add(site)
            db.flush()
        else:
            site.customer_id = customer.id
            site.site_name = site_name
            site.address_line = address
            site.default_plant_id = default_plant_id
            site.status = "active"
            db.add(site)
        sites[code] = site

    product_m300 = next((item for item in products if item.code == "M300"), products[0])

    sales_specs = [
        ("DH-BT-2026-0001", "KH_HUNGTHINH", "CTR_ANPHU", "new", "YC-DO-2026-0001", 24),
        ("DH-BT-2026-0002", "KH_MINHQUAN", "CTR_RIVERSIDE", "new", "YC-DO-2026-0002", 18),
        ("DH-BT-2026-0003", "KH_DATPHAT", "CTR_VANHANH", "new", "YC-DO-2026-0003", 30),
    ]

    for order_no, customer_code, site_code, status_value, request_no, volume in sales_specs:
        customer = customers[customer_code]
        site = sites[site_code]

        order = db.execute(
            select(SalesOrder).where(SalesOrder.organization_id == org_id, SalesOrder.order_no == order_no)
        ).scalar_one_or_none()
        if order is None:
            order = SalesOrder(
                organization_id=org_id,
                customer_id=customer.id,
                site_id=site.id,
                order_no=order_no,
                status=status_value,
            )
            db.add(order)
            db.flush()
        else:
            order.customer_id = customer.id
            order.site_id = site.id
            order.status = status_value
            db.add(order)

        request = db.execute(
            select(PourRequest).where(PourRequest.organization_id == org_id, PourRequest.request_no == request_no)
        ).scalar_one_or_none()
        if request is None:
            request = PourRequest(
                organization_id=org_id,
                sales_order_id=order.id,
                request_no=request_no,
                customer_id=customer.id,
                site_id=site.id,
                concrete_product_id=product_m300.id,
                assigned_plant_id=site.default_plant_id,
                requested_volume_m3=volume,
                requires_pump=True,
                difficulty_level="normal",
                site_contact_name="Nguyễn Văn Nam",
                site_contact_phone="0909123456",
                status="new",
            )
            db.add(request)
            db.flush()
        else:
            request.sales_order_id = order.id
            request.customer_id = customer.id
            request.site_id = site.id
            request.concrete_product_id = product_m300.id
            request.assigned_plant_id = site.default_plant_id
            request.requested_volume_m3 = volume
            request.requires_pump = True
            request.difficulty_level = "normal"
            request.site_contact_name = "Nguyễn Văn Nam"
            request.site_contact_phone = "0909123456"
            request.status = "new"
            db.add(request)


def _seed_phase2_pricing(db, org_id: str) -> None:
    price_book = db.execute(
        select(PriceBook).where(PriceBook.code == "PB_STD", PriceBook.organization_id == org_id)
    ).scalar_one_or_none()
    if price_book is None:
        price_book = PriceBook(
            organization_id=org_id,
            code="PB_STD",
            name="Bảng giá tiêu chuẩn nội thành",
            status="active",
            priority=10,
            effective_from=datetime.now(tz=timezone.utc),
        )
        db.add(price_book)
        db.flush()

    desired_rules = [
        {
            "rule_type": "BasePrice",
            "rule_name": "Giá cơ bản theo mác",
            "priority": 100,
            "condition_json": {},
            "formula_json": {"mode": "fixed", "value": 1200000},
        },
        {
            "rule_type": "DistanceFee",
            "rule_name": "Phụ phí khoảng cách theo km",
            "priority": 90,
            "condition_json": {"field": "distance_km", "op": "gt", "value": 0},
            "formula_json": {"mode": "per_km", "field": "distance_km", "rate": 15000},
        },
        {
            "rule_type": "DifficultyFee",
            "rule_name": "Phụ phí độ khó công trình",
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
            "rule_name": "Phụ phí bơm",
            "priority": 70,
            "condition_json": {"field": "requires_pump", "op": "truthy", "value": True},
            "formula_json": {"mode": "boolean", "field": "requires_pump", "true_value": 180000, "false_value": 0},
        },
        {
            "rule_type": "Surcharge",
            "rule_name": "Phụ phí thủ công",
            "priority": 60,
            "condition_json": {},
            "formula_json": {"mode": "passthrough", "field": "surcharge_amount"},
        },
        {
            "rule_type": "Discount",
            "rule_name": "Chiết khấu thủ công",
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


def _seed_phase4_inventory_costing(
    db,
    org_id: str,
    bu_id: str,
    plants: list[Plant],
    materials: list[Material],
) -> None:
    warehouse_specs = [
        ("KHO_NVL_BTAN", "Kho nguyên vật liệu Bình Tân", plants[0].id),
        ("KHO_NVL_TDUC", "Kho nguyên vật liệu Thủ Đức", plants[1].id),
    ]

    warehouses: list[Warehouse] = []
    for code, name, plant_id in warehouse_specs:
        warehouse = db.execute(
            select(Warehouse).where(Warehouse.organization_id == org_id, Warehouse.code == code)
        ).scalar_one_or_none()
        if warehouse is None:
            warehouse = Warehouse(
                organization_id=org_id,
                business_unit_id=bu_id,
                plant_id=plant_id,
                code=code,
                name=name,
                status="active",
            )
            db.add(warehouse)
            db.flush()
        else:
            warehouse.business_unit_id = bu_id
            warehouse.plant_id = plant_id
            warehouse.name = name
            warehouse.status = "active"
            db.add(warehouse)
            db.flush()
        warehouses.append(warehouse)

    center_specs = [
        ("CC_NVL", "Trung tâm chi phí nguyên vật liệu", None),
        ("CC_SANXUAT", "Trung tâm chi phí sản xuất", None),
        ("CC_VANCHUYEN", "Trung tâm chi phí vận chuyển", None),
    ]

    centers: dict[str, CostCenter] = {}
    for code, name, parent_code in center_specs:
        center = db.execute(
            select(CostCenter).where(CostCenter.organization_id == org_id, CostCenter.code == code)
        ).scalar_one_or_none()
        parent_id = centers[parent_code].id if parent_code and parent_code in centers else None
        if center is None:
            center = CostCenter(
                organization_id=org_id,
                parent_id=parent_id,
                code=code,
                name=name,
                level_no=1,
                status="active",
            )
            db.add(center)
            db.flush()
        else:
            center.parent_id = parent_id
            center.name = name
            center.level_no = 1
            center.status = "active"
            db.add(center)
            db.flush()
        centers[code] = center

    object_specs = [
        ("CT_ANPHU", "Công trình Chung cư An Phú", "project", "CC_SANXUAT"),
        ("CT_RIVER", "Công trình Riverside Tower", "project", "CC_SANXUAT"),
        ("DOIXE_01", "Đội xe trộn số 01", "fleet", "CC_VANCHUYEN"),
    ]
    for code, name, object_type, center_code in object_specs:
        obj = db.execute(
            select(CostObject).where(CostObject.organization_id == org_id, CostObject.code == code)
        ).scalar_one_or_none()
        center_id = centers[center_code].id
        if obj is None:
            obj = CostObject(
                organization_id=org_id,
                cost_center_id=center_id,
                code=code,
                name=name,
                object_type=object_type,
                status="active",
            )
            db.add(obj)
            db.flush()
        else:
            obj.cost_center_id = center_id
            obj.name = name
            obj.object_type = object_type
            obj.status = "active"
            db.add(obj)

    today = date.today()
    period_code = f"KY-{today.strftime('%Y%m')}"
    first_day = date(today.year, today.month, 1)
    last_day = date(today.year, today.month, monthrange(today.year, today.month)[1])

    period = db.execute(
        select(CostPeriod).where(CostPeriod.organization_id == org_id, CostPeriod.period_code == period_code)
    ).scalar_one_or_none()
    if period is None:
        period = CostPeriod(
            organization_id=org_id,
            period_code=period_code,
            start_date=first_day,
            end_date=last_day,
            status="open",
            opened_at=datetime.now(tz=timezone.utc),
            note="Kỳ chi phí vận hành hiện tại",
        )
        db.add(period)
        db.flush()
    else:
        period.start_date = first_day
        period.end_date = last_day
        if period.status == "draft":
            period.status = "open"
            period.opened_at = datetime.now(tz=timezone.utc)
        db.add(period)
        db.flush()

    initial_receipts = [
        ("PN-KHO-2026-0001", warehouses[0], "XM40", 120000, 1350),
        ("PN-KHO-2026-0002", warehouses[0], "DA12", 180000, 420),
        ("PN-KHO-2026-0003", warehouses[1], "CATV", 150000, 310),
    ]
    material_map = {material.code: material for material in materials}

    for reference_no, warehouse, material_code, quantity, unit_cost in initial_receipts:
        entry = db.execute(
            select(InventoryLedgerEntry).where(
                InventoryLedgerEntry.organization_id == org_id,
                InventoryLedgerEntry.reference_no == reference_no,
                InventoryLedgerEntry.movement_type == "receipt",
            )
        ).scalar_one_or_none()
        material = material_map.get(material_code)
        if material is None:
            continue

        if entry is None:
            entry = InventoryLedgerEntry(
                organization_id=org_id,
                business_unit_id=warehouse.business_unit_id,
                plant_id=warehouse.plant_id,
                warehouse_id=warehouse.id,
                material_id=material.id,
                movement_type="receipt",
                quantity_in=quantity,
                quantity_out=0,
                unit_cost=unit_cost,
                total_cost=quantity * unit_cost,
                reference_no=reference_no,
                source_document_type="seed_receipt",
                note="Phiếu nhập tồn đầu kỳ",
                transaction_at=datetime.now(tz=timezone.utc),
                period_id=period.id,
            )
            db.add(entry)


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
                description="Thông số mặc định cho scheduler",
            )
        )


def run() -> None:
    db = SessionLocal()
    try:
        org = _get_or_create_organization(db)
        bu = _get_or_create_business_unit(db, org.id)
        role = _seed_permissions_and_role(db, org.id)
        _seed_admin_user(db, org.id, role.id, bu.id)
        plants, materials, products = _seed_assets(db, org.id, bu.id)
        _seed_real_sales_master(db, org.id, plants, products)
        _seed_phase2_pricing(db, org.id)
        _seed_phase4_inventory_costing(db, org.id, bu.id, plants, materials)
        _seed_settings(db, org.id)

        db.commit()
        print("Seed hoàn tất")
        print("Tài khoản quản trị: username=admin, password=Admin@123")
    except Exception:  # noqa: BLE001
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()
