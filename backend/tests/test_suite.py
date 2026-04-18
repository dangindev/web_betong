from __future__ import annotations

import os
from pathlib import Path
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import select

DB_PATH = Path("/tmp/web_betong_phase1_test.db")
os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{DB_PATH}"
os.environ["JWT_SECRET_KEY"] = "test-secret-key"

from app.core.auth import hash_password
from app.domain.models import (
    BusinessUnit,
    Organization,
    Permission,
    Plant,
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


def setup_module() -> None:
    global TEST_ORG_ID, TEST_BU_MAIN_ID, TEST_BU_OTHER_ID

    if DB_PATH.exists():
        DB_PATH.unlink()

    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
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

        customer_response = client.post(
            "/api/v1/resources/customers",
            headers=headers,
            json={
                "organization_id": TEST_ORG_ID,
                "code": "CUST_SITE",
                "name": "Customer Site",
                "status": "active",
            },
        )
        assert customer_response.status_code == 200
        customer_id = customer_response.json()["id"]

        site_response = client.post(
            "/api/v1/resources/project_sites",
            headers=headers,
            json={
                "organization_id": TEST_ORG_ID,
                "customer_id": customer_id,
                "code": "SITE_001",
                "site_name": "Site 001",
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
