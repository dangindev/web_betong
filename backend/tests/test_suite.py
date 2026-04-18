from __future__ import annotations

import os
import random
from datetime import date, datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import select

DB_PATH = Path("/tmp/web_betong_phase2_test.db")
os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{DB_PATH}"
os.environ["JWT_SECRET_KEY"] = "test-secret-key"

from app.application.pricing import evaluate_pricing
from app.core.auth import hash_password
from app.domain.models import (
    BusinessUnit,
    ConcreteProduct,
    Customer,
    Permission,
    Plant,
    PriceBook,
    PriceCalculationSnapshot,
    PriceRule,
    ProjectSite,
    Role,
    RolePermission,
    User,
    UserRole,
)
from app.infrastructure.db import Base, SessionLocal, engine
from app.main import app

TEST_ORG_ID: str = ""
TEST_BU_MAIN_ID: str = ""
TEST_BU_OTHER_ID: str = ""
TEST_CUSTOMER_ID: str = ""
TEST_SITE_ID: str = ""
TEST_PRODUCT_ID: str = ""
TEST_PRICE_BOOK_ID: str = ""


def setup_module() -> None:
    global TEST_ORG_ID, TEST_BU_MAIN_ID, TEST_BU_OTHER_ID, TEST_CUSTOMER_ID, TEST_SITE_ID, TEST_PRODUCT_ID, TEST_PRICE_BOOK_ID

    if DB_PATH.exists():
        DB_PATH.unlink()

    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        org = db.execute(select(User).limit(1)).first()
        if org:
            db.rollback()

        organization = db.execute(select(PriceBook).limit(1)).first()
        if organization:
            db.rollback()

        from app.domain.models import Organization

        org = Organization(code="ORG_TEST", name="Org Test", status="active")
        db.add(org)
        db.flush()
        TEST_ORG_ID = org.id

        bu_main = BusinessUnit(
            organization_id=org.id,
            code="BU_MAIN",
            name="BU Main",
            status="active",
        )
        db.add(bu_main)
        db.flush()
        TEST_BU_MAIN_ID = bu_main.id

        bu_other = BusinessUnit(
            organization_id=org.id,
            code="BU_OTHER",
            name="BU Other",
            status="active",
        )
        db.add(bu_other)
        db.flush()
        TEST_BU_OTHER_ID = bu_other.id

        role = Role(organization_id=org.id, code="SYS_ADMIN", name="System Admin", is_system=True)
        db.add(role)
        db.flush()

        user = User(
            organization_id=org.id,
            username="admin",
            email="admin@test.local",
            password_hash=hash_password("Admin@123"),
            full_name="Admin Test",
            status="active",
            locale="vi",
            timezone="Asia/Ho_Chi_Minh",
        )
        db.add(user)
        db.flush()

        db.add(
            UserRole(
                user_id=user.id,
                role_id=role.id,
                business_unit_id=bu_main.id,
                is_primary=True,
            )
        )

        customer = Customer(
            organization_id=org.id,
            code="CUST_BASE",
            name="Customer Base",
            status="active",
        )
        db.add(customer)
        db.flush()
        TEST_CUSTOMER_ID = customer.id

        plant = Plant(
            organization_id=org.id,
            business_unit_id=bu_main.id,
            code="PLANT_BASE",
            name="Plant Base",
            status="active",
        )
        db.add(plant)
        db.flush()

        site = ProjectSite(
            organization_id=org.id,
            customer_id=customer.id,
            code="SITE_BASE",
            site_name="Site Base",
            address_line="123 Test Street",
            default_plant_id=plant.id,
            status="active",
        )
        db.add(site)
        db.flush()
        TEST_SITE_ID = site.id

        product = ConcreteProduct(
            organization_id=org.id,
            code="M250",
            name="Concrete M250",
            grade_code="M250",
            strength_mpa=25,
            is_pumpable=True,
            status="active",
        )
        db.add(product)
        db.flush()
        TEST_PRODUCT_ID = product.id

        book = PriceBook(
            organization_id=org.id,
            code="PB_TEST",
            name="Price Book Test",
            status="active",
            priority=10,
        )
        db.add(book)
        db.flush()
        TEST_PRICE_BOOK_ID = book.id

        rules = [
            PriceRule(
                price_book_id=book.id,
                rule_type="BasePrice",
                rule_name="Base Rule",
                condition_json={},
                formula_json={"mode": "fixed", "value": 100},
                priority=100,
                is_active=True,
            ),
            PriceRule(
                price_book_id=book.id,
                rule_type="DistanceFee",
                rule_name="Distance Rule",
                condition_json={"field": "distance_km", "op": "gt", "value": 0},
                formula_json={"mode": "per_km", "field": "distance_km", "rate": 5},
                priority=90,
                is_active=True,
            ),
            PriceRule(
                price_book_id=book.id,
                rule_type="DifficultyFee",
                rule_name="Difficulty Rule",
                condition_json={},
                formula_json={
                    "mode": "difficulty_map",
                    "field": "difficulty_level",
                    "mapping": {"easy": 0, "normal": 10, "hard": 20},
                    "default": 0,
                },
                priority=80,
                is_active=True,
            ),
            PriceRule(
                price_book_id=book.id,
                rule_type="PumpFee",
                rule_name="Pump Rule",
                condition_json={"field": "requires_pump", "op": "truthy", "value": True},
                formula_json={"mode": "boolean", "field": "requires_pump", "true_value": 30, "false_value": 0},
                priority=70,
                is_active=True,
            ),
            PriceRule(
                price_book_id=book.id,
                rule_type="Surcharge",
                rule_name="Surcharge Rule",
                condition_json={},
                formula_json={"mode": "passthrough", "field": "surcharge_amount"},
                priority=60,
                is_active=True,
            ),
            PriceRule(
                price_book_id=book.id,
                rule_type="Discount",
                rule_name="Discount Rule",
                condition_json={},
                formula_json={"mode": "passthrough", "field": "discount_amount"},
                priority=50,
                is_active=True,
            ),
        ]
        for rule in rules:
            db.add(rule)

        db.commit()
    finally:
        db.close()


def teardown_module() -> None:
    Base.metadata.drop_all(bind=engine)
    if DB_PATH.exists():
        DB_PATH.unlink()


def _login(client: TestClient, username: str, password: str) -> dict[str, str]:
    login_response = client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": password},
    )
    assert login_response.status_code == 200
    return login_response.json()


def _ensure_permission(db, module_code: str, action_code: str) -> Permission:
    permission = db.execute(
        select(Permission).where(
            Permission.module_code == module_code,
            Permission.action_code == action_code,
        )
    ).scalar_one_or_none()
    if permission is not None:
        return permission

    permission = Permission(
        module_code=module_code,
        action_code=action_code,
        description=f"{module_code}:{action_code}",
    )
    db.add(permission)
    db.flush()
    return permission


def test_healthz() -> None:
    with TestClient(app) as client:
        response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_readyz() -> None:
    with TestClient(app) as client:
        response = client.get("/readyz")
    assert response.status_code == 200
    assert response.json()["status"] == "ready"


def test_auth_login_refresh_logout_flow() -> None:
    with TestClient(app) as client:
        login_json = _login(client, "admin", "Admin@123")
        assert login_json["token_type"] == "bearer"
        assert login_json["user"]["username"] == "admin"

        access_token = login_json["access_token"]
        refresh_token = login_json["refresh_token"]

        me_response = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        assert me_response.status_code == 200
        assert me_response.json()["username"] == "admin"

        refresh_response = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": refresh_token},
        )
        assert refresh_response.status_code == 200
        refreshed = refresh_response.json()
        assert "access_token" in refreshed
        assert "refresh_token" in refreshed

        logout_response = client.post(
            "/api/v1/auth/logout",
            json={"refresh_token": refreshed["refresh_token"]},
        )
        assert logout_response.status_code == 200


def test_resources_customers_crud() -> None:
    with TestClient(app) as client:
        login_json = _login(client, "admin", "Admin@123")
        headers = {"Authorization": f"Bearer {login_json['access_token']}"}

        create_response = client.post(
            "/api/v1/resources/customers",
            headers=headers,
            json={
                "organization_id": TEST_ORG_ID,
                "code": "CUST_001",
                "name": "Customer One",
                "status": "active",
            },
        )
        assert create_response.status_code == 200
        customer_id = create_response.json()["id"]

        get_response = client.get(f"/api/v1/resources/customers/{customer_id}", headers=headers)
        assert get_response.status_code == 200
        assert get_response.json()["code"] == "CUST_001"

        patch_response = client.patch(
            f"/api/v1/resources/customers/{customer_id}",
            headers=headers,
            json={"name": "Customer One Updated"},
        )
        assert patch_response.status_code == 200
        assert patch_response.json()["name"] == "Customer One Updated"

        list_response = client.get("/api/v1/resources/customers", headers=headers)
        assert list_response.status_code == 200
        assert list_response.json()["total"] >= 1


def test_geocode_import_preview_and_export() -> None:
    with TestClient(app) as client:
        login_json = _login(client, "admin", "Admin@123")
        headers = {"Authorization": f"Bearer {login_json['access_token']}"}

        geocode_response = client.post(
            "/api/v1/geocode",
            headers=headers,
            json={"address": "123 Nguyen Hue, HCM"},
        )
        assert geocode_response.status_code == 200
        geo_json = geocode_response.json()
        assert "latitude" in geo_json and "longitude" in geo_json

        csv_bytes = (
            "organization_id,code,name,status\n"
            f"{TEST_ORG_ID},CUST_002,Customer Two,active\n"
            f"{TEST_ORG_ID},CUST_003,,active\n"
        ).encode("utf-8")

        preview_response = client.post(
            "/api/v1/io/import/customers?dry_run=true",
            headers=headers,
            files={"file": ("customers.csv", csv_bytes, "text/csv")},
        )
        assert preview_response.status_code == 200
        preview_json = preview_response.json()
        assert preview_json["dry_run"] is True
        assert preview_json["valid_rows"] == 1
        assert preview_json["invalid_rows"] == 1
        assert len(preview_json["errors"]) == 1

        import_response = client.post(
            "/api/v1/io/import/customers",
            headers=headers,
            files={"file": ("customers.csv", csv_bytes, "text/csv")},
        )
        assert import_response.status_code == 200
        import_json = import_response.json()
        assert import_json["created"] == 1
        assert import_json["skipped"] == 1

        export_response = client.get("/api/v1/io/export/customers", headers=headers)
        assert export_response.status_code == 200
        assert export_response.headers["content-type"].startswith(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )


def test_project_site_attachment_upload() -> None:
    with TestClient(app) as client:
        login_json = _login(client, "admin", "Admin@123")
        headers = {"Authorization": f"Bearer {login_json['access_token']}"}

        site_response = client.post(
            "/api/v1/resources/project_sites",
            headers=headers,
            json={
                "organization_id": TEST_ORG_ID,
                "customer_id": TEST_CUSTOMER_ID,
                "code": "SITE_ATTACH",
                "site_name": "Site Attachment",
                "address_line": "123 Site Address",
                "status": "active",
            },
        )
        assert site_response.status_code == 200
        site_id = site_response.json()["id"]

        upload_response = client.post(
            "/api/v1/attachments/upload",
            headers=headers,
            data={"entity_type": "project_sites", "entity_id": site_id},
            files={"file": ("site-photo.jpg", b"binary-image", "image/jpeg")},
        )
        assert upload_response.status_code == 200
        attachment_json = upload_response.json()
        assert attachment_json["entity_type"] == "project_sites"
        assert attachment_json["entity_id"] == site_id
        assert attachment_json["file_name"] == "site-photo.jpg"
        assert attachment_json["size_bytes"] == len(b"binary-image")


def test_rbac_scope_by_business_unit() -> None:
    unique_suffix = uuid4().hex[:8]

    db = SessionLocal()
    try:
        role = Role(
            organization_id=TEST_ORG_ID,
            code=f"DISPATCHER_{unique_suffix}",
            name="Dispatcher Scoped",
            is_system=False,
        )
        db.add(role)
        db.flush()

        for action in ("read", "write"):
            permission = _ensure_permission(db, "plants", action)
            linked = db.execute(
                select(RolePermission).where(
                    RolePermission.role_id == role.id,
                    RolePermission.permission_id == permission.id,
                )
            ).scalar_one_or_none()
            if linked is None:
                db.add(RolePermission(role_id=role.id, permission_id=permission.id))

        scoped_user = User(
            organization_id=TEST_ORG_ID,
            username=f"dispatch_{unique_suffix}",
            email=f"dispatch_{unique_suffix}@test.local",
            password_hash=hash_password("Dispatch@123"),
            full_name="Dispatcher Scoped User",
            status="active",
            locale="vi",
            timezone="Asia/Ho_Chi_Minh",
        )
        db.add(scoped_user)
        db.flush()

        db.add(
            UserRole(
                user_id=scoped_user.id,
                role_id=role.id,
                business_unit_id=TEST_BU_MAIN_ID,
                is_primary=True,
            )
        )

        plant_in_scope = Plant(
            organization_id=TEST_ORG_ID,
            business_unit_id=TEST_BU_MAIN_ID,
            code=f"PLANT_IN_{unique_suffix}",
            name="Plant In Scope",
            status="active",
        )
        plant_out_scope = Plant(
            organization_id=TEST_ORG_ID,
            business_unit_id=TEST_BU_OTHER_ID,
            code=f"PLANT_OUT_{unique_suffix}",
            name="Plant Out Scope",
            status="active",
        )
        db.add(plant_in_scope)
        db.add(plant_out_scope)
        db.commit()

        scoped_username = scoped_user.username
        in_scope_id = plant_in_scope.id
        out_scope_id = plant_out_scope.id
    finally:
        db.close()

    with TestClient(app) as client:
        login_json = _login(client, scoped_username, "Dispatch@123")
        headers = {"Authorization": f"Bearer {login_json['access_token']}"}

        list_response = client.get("/api/v1/resources/plants", headers=headers)
        assert list_response.status_code == 200
        listed_ids = {item["id"] for item in list_response.json()["items"]}
        assert in_scope_id in listed_ids
        assert out_scope_id not in listed_ids

        get_in_scope_response = client.get(f"/api/v1/resources/plants/{in_scope_id}", headers=headers)
        assert get_in_scope_response.status_code == 200

        get_out_scope_response = client.get(f"/api/v1/resources/plants/{out_scope_id}", headers=headers)
        assert get_out_scope_response.status_code == 403

        create_out_scope_response = client.post(
            "/api/v1/resources/plants",
            headers=headers,
            json={
                "organization_id": TEST_ORG_ID,
                "business_unit_id": TEST_BU_OTHER_ID,
                "code": f"PLANT_CREATE_{uuid4().hex[:6]}",
                "name": "Denied Plant",
                "status": "active",
            },
        )
        assert create_out_scope_response.status_code == 403


def test_pricing_engine_rule_types_and_final_price() -> None:
    db = SessionLocal()
    try:
        result = evaluate_pricing(
            db=db,
            organization_id=TEST_ORG_ID,
            preferred_price_book_id=TEST_PRICE_BOOK_ID,
            pricing_context={
                "customer_id": TEST_CUSTOMER_ID,
                "site_id": TEST_SITE_ID,
                "concrete_product_id": TEST_PRODUCT_ID,
                "quoted_volume_m3": 10,
                "distance_km": 12,
                "difficulty_level": "hard",
                "requires_pump": True,
                "surcharge_amount": 15,
                "discount_amount": 5,
            },
        )
    finally:
        db.close()

    components = result["components"]
    assert components["base_price"] == 100
    assert components["distance_fee"] == 60
    assert components["difficulty_fee"] == 20
    assert components["pump_fee"] == 30
    assert components["surcharge_fee"] == 15
    assert components["discount_fee"] == 5
    assert result["final_unit_price"] == 220
    assert result["total_amount"] == 2200


def test_pricing_preview_property_random_inputs_do_not_crash() -> None:
    with TestClient(app) as client:
        login_json = _login(client, "admin", "Admin@123")
        headers = {"Authorization": f"Bearer {login_json['access_token']}"}

        for _ in range(30):
            payload = {
                "organization_id": TEST_ORG_ID,
                "price_book_id": TEST_PRICE_BOOK_ID,
                "customer_id": TEST_CUSTOMER_ID,
                "site_id": TEST_SITE_ID,
                "concrete_product_id": TEST_PRODUCT_ID,
                "quoted_volume_m3": random.uniform(0, 80),
                "distance_km": random.uniform(0, 40),
                "difficulty_level": random.choice(["easy", "normal", "hard", None]),
                "requires_pump": random.choice([True, False]),
                "surcharge_amount": random.uniform(0, 50),
                "discount_amount": random.uniform(0, 30),
            }
            response = client.post("/api/v1/pricing/preview", headers=headers, json=payload)
            assert response.status_code == 200
            preview = response.json()
            assert preview["final_unit_price"] >= 0


def test_integration_quotation_snapshot_sales_order_pour_request_flow() -> None:
    with TestClient(app) as client:
        login_json = _login(client, "admin", "Admin@123")
        headers = {"Authorization": f"Bearer {login_json['access_token']}"}

        quotation_response = client.post(
            "/api/v1/resources/quotations",
            headers=headers,
            json={
                "organization_id": TEST_ORG_ID,
                "customer_id": TEST_CUSTOMER_ID,
                "site_id": TEST_SITE_ID,
                "quotation_no": f"QT-{uuid4().hex[:8]}",
                "price_book_id": TEST_PRICE_BOOK_ID,
                "status": "draft",
            },
        )
        assert quotation_response.status_code == 200
        quotation_id = quotation_response.json()["id"]

        item_response = client.post(
            "/api/v1/resources/quotation_items",
            headers=headers,
            json={
                "quotation_id": quotation_id,
                "concrete_product_id": TEST_PRODUCT_ID,
                "quoted_volume_m3": 15,
                "distance_km": 10,
                "difficulty_level": "normal",
                "requires_pump": True,
            },
        )
        assert item_response.status_code == 200
        item_id = item_response.json()["id"]

        confirm_response = client.post(
            f"/api/v1/pricing/quotations/{quotation_id}/confirm",
            headers=headers,
            json={
                "price_book_id": TEST_PRICE_BOOK_ID,
                "surcharge_amount": 10,
                "discount_amount": 5,
                "final_status": "confirmed",
            },
        )
        assert confirm_response.status_code == 200
        assert confirm_response.json()["quotation"]["status"] == "confirmed"

        db = SessionLocal()
        try:
            snapshots = (
                db.execute(
                    select(PriceCalculationSnapshot).where(
                        PriceCalculationSnapshot.source_type == "quotation_item",
                        PriceCalculationSnapshot.source_id == item_id,
                    )
                )
                .scalars()
                .all()
            )
            assert len(snapshots) >= 1
        finally:
            db.close()

        sales_order_response = client.post(
            "/api/v1/resources/sales_orders",
            headers=headers,
            json={
                "organization_id": TEST_ORG_ID,
                "customer_id": TEST_CUSTOMER_ID,
                "site_id": TEST_SITE_ID,
                "quotation_id": quotation_id,
                "order_no": f"SO-{uuid4().hex[:8]}",
                "status": "new",
            },
        )
        assert sales_order_response.status_code == 200
        sales_order_id = sales_order_response.json()["id"]

        pour_request_response = client.post(
            "/api/v1/resources/pour_requests",
            headers=headers,
            json={
                "organization_id": TEST_ORG_ID,
                "sales_order_id": sales_order_id,
                "request_no": f"PR-{uuid4().hex[:8]}",
                "customer_id": TEST_CUSTOMER_ID,
                "site_id": TEST_SITE_ID,
                "concrete_product_id": TEST_PRODUCT_ID,
                "requested_volume_m3": 15,
                "status": "new",
            },
        )
        assert pour_request_response.status_code == 200


def test_regression_snapshot_immutability_after_rule_change() -> None:
    with TestClient(app) as client:
        login_json = _login(client, "admin", "Admin@123")
        headers = {"Authorization": f"Bearer {login_json['access_token']}"}

        quotation_response = client.post(
            "/api/v1/resources/quotations",
            headers=headers,
            json={
                "organization_id": TEST_ORG_ID,
                "customer_id": TEST_CUSTOMER_ID,
                "site_id": TEST_SITE_ID,
                "quotation_no": f"QT-RG-{uuid4().hex[:8]}",
                "price_book_id": TEST_PRICE_BOOK_ID,
                "status": "draft",
            },
        )
        quotation_id = quotation_response.json()["id"]

        item_response = client.post(
            "/api/v1/resources/quotation_items",
            headers=headers,
            json={
                "quotation_id": quotation_id,
                "concrete_product_id": TEST_PRODUCT_ID,
                "quoted_volume_m3": 8,
                "distance_km": 7,
                "difficulty_level": "normal",
                "requires_pump": False,
            },
        )
        item_id = item_response.json()["id"]

        confirm_response = client.post(
            f"/api/v1/pricing/quotations/{quotation_id}/confirm",
            headers=headers,
            json={"price_book_id": TEST_PRICE_BOOK_ID},
        )
        assert confirm_response.status_code == 200

        db = SessionLocal()
        try:
            snapshot = db.execute(
                select(PriceCalculationSnapshot).where(
                    PriceCalculationSnapshot.source_type == "quotation_item",
                    PriceCalculationSnapshot.source_id == item_id,
                )
            ).scalar_one()
            frozen_price = float(snapshot.final_unit_price or 0)

            base_rule = db.execute(
                select(PriceRule).where(
                    PriceRule.price_book_id == TEST_PRICE_BOOK_ID,
                    PriceRule.rule_type == "BasePrice",
                )
            ).scalar_one()
            base_rule.formula_json = {"mode": "fixed", "value": 999}
            db.add(base_rule)
            db.commit()

            snapshot_after = db.get(PriceCalculationSnapshot, snapshot.id)
            assert float(snapshot_after.final_unit_price or 0) == frozen_price
        finally:
            db.close()


def _create_phase3_dispatch_context(
    client: TestClient,
    headers: dict[str, str],
    *,
    requires_pump: bool,
) -> dict[str, str]:
    db = SessionLocal()
    try:
        plant_id = db.execute(select(Plant.id)).scalars().first()
        from app.domain.models import Pump

        pump_id = db.execute(select(Pump.id)).scalars().first()
    finally:
        db.close()

    assert plant_id

    vehicles_response = client.get("/api/v1/resources/vehicles?skip=0&limit=10", headers=headers)
    assert vehicles_response.status_code == 200
    vehicle_items = vehicles_response.json()["items"]
    if not vehicle_items:
        create_vehicle_response = client.post(
            "/api/v1/resources/vehicles",
            headers=headers,
            json={
                "organization_id": TEST_ORG_ID,
                "home_plant_id": plant_id,
                "plate_no": f"51D-PH3-{uuid4().hex[:4]}",
                "capacity_m3": 7,
                "effective_capacity_m3": 7,
                "status": "active",
            },
        )
        assert create_vehicle_response.status_code == 200

    if requires_pump and not pump_id:
        create_pump_response = client.post(
            "/api/v1/resources/pumps",
            headers=headers,
            json={
                "organization_id": TEST_ORG_ID,
                "home_plant_id": plant_id,
                "code": f"PUMP-PH3-{uuid4().hex[:4]}",
                "pump_type": "line",
                "capacity_m3_per_hour": 45,
                "status": "active",
            },
        )
        assert create_pump_response.status_code == 200
        pump_id = create_pump_response.json()["id"]

    sales_order_response = client.post(
        "/api/v1/resources/sales_orders",
        headers=headers,
        json={
            "organization_id": TEST_ORG_ID,
            "customer_id": TEST_CUSTOMER_ID,
            "site_id": TEST_SITE_ID,
            "order_no": f"SO-PH3-{uuid4().hex[:8]}",
            "status": "draft",
        },
    )
    assert sales_order_response.status_code == 200
    sales_order_id = sales_order_response.json()["id"]

    pour_request_response = client.post(
        "/api/v1/resources/pour_requests",
        headers=headers,
        json={
            "organization_id": TEST_ORG_ID,
            "sales_order_id": sales_order_id,
            "request_no": f"PR-PH3-{uuid4().hex[:8]}",
            "customer_id": TEST_CUSTOMER_ID,
            "site_id": TEST_SITE_ID,
            "concrete_product_id": TEST_PRODUCT_ID,
            "assigned_plant_id": plant_id,
            "requested_volume_m3": 14,
            "requires_pump": requires_pump,
            "status": "draft",
        },
    )
    assert pour_request_response.status_code == 200
    pour_request_id = pour_request_response.json()["id"]

    approval_payload: dict[str, object] = {
        "organization_id": TEST_ORG_ID,
        "action": "approve",
        "assigned_plant_id": plant_id,
        "target_truck_rhythm_minutes": 30,
    }
    if requires_pump and pump_id:
        approval_payload["assigned_pump_id"] = pump_id

    approval_response = client.post(
        f"/api/v1/dispatch/pour-requests/{pour_request_id}/approval",
        headers=headers,
        json=approval_payload,
    )
    assert approval_response.status_code == 200
    dispatch_order_id = approval_response.json()["dispatch_order"]["id"]

    run_response = client.post(
        "/api/v1/dispatch/schedule-runs",
        headers=headers,
        json={"organization_id": TEST_ORG_ID},
    )
    assert run_response.status_code == 200
    run_payload = run_response.json()
    schedule_run_id = run_payload["schedule_run"]["id"]

    trips_response = client.get(
        "/api/v1/resources/trips?skip=0&limit=1000",
        headers=headers,
    )
    assert trips_response.status_code == 200
    trip_items = [item for item in trips_response.json()["items"] if item.get("pour_request_id") == pour_request_id]
    assert trip_items
    trip_id = trip_items[0]["id"]

    pump_session_id = ""
    if requires_pump:
        pump_sessions_response = client.get(
            "/api/v1/resources/pump_sessions?skip=0&limit=1000",
            headers=headers,
        )
        assert pump_sessions_response.status_code == 200
        pump_items = [item for item in pump_sessions_response.json()["items"] if item.get("trip_id") == trip_id]
        assert pump_items
        pump_session_id = pump_items[0]["id"]

    return {
        "pour_request_id": pour_request_id,
        "dispatch_order_id": dispatch_order_id,
        "schedule_run_id": schedule_run_id,
        "trip_id": trip_id,
        "pump_session_id": pump_session_id,
    }


def test_phase3_dispatch_scheduler_flow() -> None:
    with TestClient(app) as client:
        tokens = _login(client, "admin", "Admin@123")
        headers = {"Authorization": f"Bearer {tokens['access_token']}"}

        context = _create_phase3_dispatch_context(client, headers, requires_pump=False)

        schedule_response = client.get(f"/api/v1/dispatch/schedule-runs/{context['schedule_run_id']}", headers=headers)
        assert schedule_response.status_code == 200
        assert len(schedule_response.json()["scheduled_trips"]) >= 1

        conflicts_response = client.get(
            f"/api/v1/dispatch/schedule-runs/{context['schedule_run_id']}/conflicts",
            headers=headers,
        )
        assert conflicts_response.status_code == 200
        assert isinstance(conflicts_response.json()["items"], list)

        dispatch_orders_response = client.get("/api/v1/resources/dispatch_orders?skip=0&limit=100", headers=headers)
        assert dispatch_orders_response.status_code == 200
        assert any(item["id"] == context["dispatch_order_id"] for item in dispatch_orders_response.json()["items"])


def test_phase3_trip_and_pump_event_state_machine_idempotent() -> None:
    with TestClient(app) as client:
        tokens = _login(client, "admin", "Admin@123")
        headers = {"Authorization": f"Bearer {tokens['access_token']}"}

        context = _create_phase3_dispatch_context(client, headers, requires_pump=True)
        trip_id = context["trip_id"]

        trip_events = [
            "accepted",
            "check_in_plant",
            "load_start",
            "load_end",
            "depart_plant",
            "arrive_site",
            "pour_start",
            "pour_end",
            "leave_site",
            "return_plant",
        ]

        first_key = None
        for event_name in trip_events:
            key = f"trip-{trip_id}-{event_name}"
            if first_key is None:
                first_key = key
            response = client.post(
                f"/api/v1/dispatch/trips/{trip_id}/events",
                headers=headers,
                json={
                    "organization_id": TEST_ORG_ID,
                    "event_type": event_name,
                    "event_time": datetime.now(tz=timezone.utc).isoformat(),
                    "idempotency_key": key,
                    "payload": {"actual_volume_m3": 7 if event_name == "pour_end" else None},
                },
            )
            assert response.status_code == 200

        # duplicate idempotency key should be accepted and not create duplicate effect
        duplicate_response = client.post(
            f"/api/v1/dispatch/trips/{trip_id}/events",
            headers=headers,
            json={
                "organization_id": TEST_ORG_ID,
                "event_type": "accepted",
                "event_time": datetime.now(tz=timezone.utc).isoformat(),
                "idempotency_key": first_key,
                "payload": {},
            },
        )
        assert duplicate_response.status_code == 200

        out_of_order = client.post(
            f"/api/v1/dispatch/trips/{trip_id}/events",
            headers=headers,
            json={
                "organization_id": TEST_ORG_ID,
                "event_type": "load_start",
                "event_time": datetime.now(tz=timezone.utc).isoformat(),
                "idempotency_key": f"trip-invalid-{uuid4().hex}",
                "payload": {},
            },
        )
        assert out_of_order.status_code == 400

        pump_session_id = context["pump_session_id"]
        assert pump_session_id
        pump_events = ["moving", "setup_start", "pump_start", "pump_end", "teardown_end"]
        for event_name in pump_events:
            response = client.post(
                f"/api/v1/dispatch/pump-sessions/{pump_session_id}/events",
                headers=headers,
                json={
                    "organization_id": TEST_ORG_ID,
                    "event_type": event_name,
                    "event_time": datetime.now(tz=timezone.utc).isoformat(),
                    "idempotency_key": f"pump-{pump_session_id}-{event_name}",
                    "payload": {"actual_volume_m3": 8 if event_name == "pump_end" else None},
                },
            )
            assert response.status_code == 200


def test_phase3_reconciliation_and_kpi_snapshot() -> None:
    with TestClient(app) as client:
        tokens = _login(client, "admin", "Admin@123")
        headers = {"Authorization": f"Bearer {tokens['access_token']}"}

        context = _create_phase3_dispatch_context(client, headers, requires_pump=False)

        reconcile_response = client.post(
            f"/api/v1/dispatch/reconciliation/{context['pour_request_id']}",
            headers=headers,
            json={
                "organization_id": TEST_ORG_ID,
                "actual_volume_m3": 13.5,
                "actual_trip_count": 2,
                "reason_code": "normal",
                "note": "phase3 test close",
            },
        )
        assert reconcile_response.status_code == 200
        assert reconcile_response.json()["reconciliation"]["reason_code"] == "normal"

        kpi_response = client.post(
            "/api/v1/dispatch/kpi/snapshot",
            headers=headers,
            json={
                "organization_id": TEST_ORG_ID,
                "snapshot_date": date.today().isoformat(),
            },
        )
        assert kpi_response.status_code == 200
        assert kpi_response.json()["daily_kpi_snapshot"]["organization_id"] == TEST_ORG_ID
