import pytest
from httpx import AsyncClient
from app.models import AdminUser
from app.services.auth_service import hash_password, create_access_token

@pytest.mark.asyncio
async def test_admin_login_success(client: AsyncClient, db_session):
    # Seed admin user
    admin = AdminUser(
        username="TestAdmin",
        password_hash=hash_password("Secret123"),
    )
    db_session.add(admin)
    await db_session.commit()

    response = await client.post("/api/admin/login", json={
        "username": "TestAdmin",
        "password": "Secret123"
    })
    assert response.status_code == 200
    data = response.json()
    assert "token" in data
    assert data["username"] == "TestAdmin"
    assert len(data["token"]) > 20

@pytest.mark.asyncio
async def test_admin_login_wrong_password_rejected_401(client: AsyncClient, db_session):
    admin = AdminUser(
        username="SecurityAdmin",
        password_hash=hash_password("ValidPassword"),
    )
    db_session.add(admin)
    await db_session.commit()

    response = await client.post("/api/admin/login", json={
        "username": "SecurityAdmin",
        "password": "WrongPassword"
    })
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid username or password"

@pytest.mark.asyncio
async def test_admin_login_unknown_username_rejected_401(client: AsyncClient):
    response = await client.post("/api/admin/login", json={
        "username": "NonExistentAdmin",
        "password": "AnyPassword"
    })
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid username or password"

@pytest.mark.asyncio
async def test_protected_admin_stats_without_token_rejected_401(client: AsyncClient):
    response = await client.get("/api/admin/stats")
    assert response.status_code == 401
    assert "Authentication token required" in response.json()["detail"]

@pytest.mark.asyncio
async def test_protected_admin_coverage_without_token_rejected_401(client: AsyncClient):
    response = await client.get("/api/admin/coverage")
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_protected_admin_activity_without_token_rejected_401(client: AsyncClient):
    response = await client.get("/api/admin/activity")
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_protected_admin_endpoints_with_valid_token_success(client: AsyncClient, db_session):
    admin = AdminUser(
        username="BearerAdmin",
        password_hash=hash_password("TokenPass"),
    )
    db_session.add(admin)
    await db_session.commit()

    token = create_access_token({"sub": "BearerAdmin"})
    headers = {"Authorization": f"Bearer {token}"}

    stats_res = await client.get("/api/admin/stats", headers=headers)
    assert stats_res.status_code == 200
    assert "total_banks" in stats_res.json()

    cov_res = await client.get("/api/admin/coverage", headers=headers)
    assert cov_res.status_code == 200
    assert "regions" in cov_res.json()

    act_res = await client.get("/api/admin/activity", headers=headers)
    assert act_res.status_code == 200

@pytest.mark.asyncio
async def test_protected_admin_endpoints_with_invalid_token_rejected_401(client: AsyncClient):
    headers = {"Authorization": "Bearer invalid.jwt.token"}
    response = await client.get("/api/admin/stats", headers=headers)
    assert response.status_code == 401
    assert "Invalid or expired authentication token" in response.json()["detail"]

@pytest.mark.asyncio
async def test_startup_check_fails_on_empty_secret_key():
    from app.main import lifespan
    from app.config import settings
    from fastapi import FastAPI

    test_app = FastAPI()
    original_key = settings.secret_key
    try:
        settings.secret_key = ""
        with pytest.raises(RuntimeError) as exc_info:
            async with lifespan(test_app):
                pass
        assert "CRITICAL SECURITY ERROR: SECRET_KEY is not set" in str(exc_info.value)
    finally:
        settings.secret_key = original_key

