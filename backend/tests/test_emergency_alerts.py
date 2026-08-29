import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.future import select
from datetime import datetime, timezone

from app.database import Base, get_db
from app.main import app
from app.models import BloodBank, EmergencyAlert, EmergencyAlertAcknowledgment, AlertStatus
from app.services.auth_service import create_access_token

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

@pytest_asyncio.fixture
async def async_engine():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()

@pytest_asyncio.fixture
async def db_session(async_engine):
    async_session = sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        yield session

@pytest_asyncio.fixture
async def client(db_session):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()

@pytest_asyncio.fixture
async def seed_three_banks(db_session):
    b1 = BloodBank(
        name="AIIMS Blood Centre Delhi",
        bank_ref_code="BB001",
        city="Delhi",
        state="Delhi",
        phone="011-26588500",
        created_at=datetime.now(timezone.utc)
    )
    b2 = BloodBank(
        name="Apollo Hospital Blood Bank Mumbai",
        bank_ref_code="BB002",
        city="Mumbai",
        state="Maharashtra",
        phone="022-28290000",
        created_at=datetime.now(timezone.utc)
    )
    b3 = BloodBank(
        name="Fortis Hospital Blood Bank Bangalore",
        bank_ref_code="BB003",
        city="Bangalore",
        state="Karnataka",
        phone="080-66214444",
        created_at=datetime.now(timezone.utc)
    )
    db_session.add_all([b1, b2, b3])
    await db_session.commit()
    await db_session.refresh(b1)
    await db_session.refresh(b2)
    await db_session.refresh(b3)
    return b1, b2, b3

def create_bank_token(bank: BloodBank) -> str:
    return create_access_token({
        "sub": str(bank.id),
        "bank_id": bank.id,
        "bank_ref_code": bank.bank_ref_code,
        "type": "bank",
        "name": bank.name,
        "city": bank.city
    })

def create_admin_token() -> str:
    return create_access_token({
        "sub": "admin",
        "username": "Akshay",
        "type": "admin"
    })

@pytest.mark.asyncio
async def test_broadcast_alert_creation_and_visibility(client: AsyncClient, seed_three_banks):
    b1, b2, b3 = seed_three_banks
    token_b1 = create_bank_token(b1)
    token_b2 = create_bank_token(b2)
    token_b3 = create_bank_token(b3)

    # 1. Bank 1 broadcasts an emergency alert
    payload = {
        "blood_group": "O-",
        "component": "Packed Red Cells",
        "units": 10,
        "note": "Urgent multi-trauma surgery in OT 3"
    }
    resp_create = await client.post(
        "/api/bank/emergency-alert",
        headers={"Authorization": f"Bearer {token_b1}"},
        json=payload
    )
    assert resp_create.status_code == 200, resp_create.text
    data_created = resp_create.json()
    assert data_created["reference_id"].startswith("EMG-")
    assert data_created["source_bank_id"] == b1.id
    assert data_created["source_bank_name"] == "AIIMS Blood Centre Delhi"
    assert data_created["units"] == 10
    assert data_created["status"] == "active"
    alert_id = data_created["id"]

    # 2. Bank 1 should NOT see its own broadcast in /active alerts
    resp_b1_active = await client.get(
        "/api/bank/emergency-alerts/active",
        headers={"Authorization": f"Bearer {token_b1}"}
    )
    assert resp_b1_active.status_code == 200
    b1_active_list = resp_b1_active.json()
    assert len(b1_active_list) == 0, "Source bank should not receive its own broadcast as incoming alert"

    # 3. Bank 1 CAN see its broadcast in /my-broadcasts
    resp_b1_my = await client.get(
        "/api/bank/emergency-alerts/my-broadcasts",
        headers={"Authorization": f"Bearer {token_b1}"}
    )
    assert resp_b1_my.status_code == 200
    b1_my_list = resp_b1_my.json()
    assert len(b1_my_list) == 1
    assert b1_my_list[0]["id"] == alert_id

    # 4. Bank 2 AND Bank 3 MUST see Bank 1's broadcast in their /active alerts
    resp_b2_active = await client.get(
        "/api/bank/emergency-alerts/active",
        headers={"Authorization": f"Bearer {token_b2}"}
    )
    assert resp_b2_active.status_code == 200
    b2_active_list = resp_b2_active.json()
    assert len(b2_active_list) == 1
    assert b2_active_list[0]["id"] == alert_id
    assert b2_active_list[0]["source_bank_ref_code"] == "BB001"
    assert b2_active_list[0]["note"] == "Urgent multi-trauma surgery in OT 3"

    resp_b3_active = await client.get(
        "/api/bank/emergency-alerts/active",
        headers={"Authorization": f"Bearer {token_b3}"}
    )
    assert resp_b3_active.status_code == 200
    b3_active_list = resp_b3_active.json()
    assert len(b3_active_list) == 1
    assert b3_active_list[0]["id"] == alert_id

@pytest.mark.asyncio
async def test_broadcast_alert_acknowledgment_isolation(client: AsyncClient, seed_three_banks):
    b1, b2, b3 = seed_three_banks
    token_b1 = create_bank_token(b1)
    token_b2 = create_bank_token(b2)
    token_b3 = create_bank_token(b3)

    # Bank 1 creates alert
    resp_create = await client.post(
        "/api/bank/emergency-alert",
        headers={"Authorization": f"Bearer {token_b1}"},
        json={"blood_group": "AB-", "component": "Platelets", "units": 4, "note": "Emergency request"}
    )
    assert resp_create.status_code == 200
    alert_id = resp_create.json()["id"]

    # Bank 2 acknowledges/dismisses the alert
    resp_ack_b2 = await client.post(
        f"/api/bank/emergency-alert/{alert_id}/acknowledge",
        headers={"Authorization": f"Bearer {token_b2}"}
    )
    assert resp_ack_b2.status_code == 200
    assert resp_ack_b2.json()["success"] is True

    # Bank 2 should now have 0 active alerts
    resp_b2_after = await client.get(
        "/api/bank/emergency-alerts/active",
        headers={"Authorization": f"Bearer {token_b2}"}
    )
    assert resp_b2_after.status_code == 200
    assert len(resp_b2_after.json()) == 0

    # Bank 3 did NOT acknowledge, so Bank 3 STILL sees the active alert
    resp_b3_after = await client.get(
        "/api/bank/emergency-alerts/active",
        headers={"Authorization": f"Bearer {token_b3}"}
    )
    assert resp_b3_after.status_code == 200
    b3_active = resp_b3_after.json()
    assert len(b3_active) == 1
    assert b3_active[0]["id"] == alert_id

@pytest.mark.asyncio
async def test_broadcast_alert_resolve_permission_enforcement(client: AsyncClient, seed_three_banks):
    b1, b2, b3 = seed_three_banks
    token_b1 = create_bank_token(b1)
    token_b2 = create_bank_token(b2)
    token_b3 = create_bank_token(b3)

    # Bank 1 creates alert
    resp_create = await client.post(
        "/api/bank/emergency-alert",
        headers={"Authorization": f"Bearer {token_b1}"},
        json={"blood_group": "B+", "component": "Fresh Frozen Plasma", "units": 6}
    )
    assert resp_create.status_code == 200
    alert_id = resp_create.json()["id"]

    # Bank 2 attempts to resolve Bank 1's alert -> MUST FAIL with 403 Forbidden
    resp_b2_resolve = await client.post(
        f"/api/bank/emergency-alert/{alert_id}/resolve",
        headers={"Authorization": f"Bearer {token_b2}"}
    )
    assert resp_b2_resolve.status_code == 403, "Non-source bank cannot resolve someone else's broadcast alert"

    # Source Bank 1 resolves its own alert -> MUST SUCCEED with 200
    resp_b1_resolve = await client.post(
        f"/api/bank/emergency-alert/{alert_id}/resolve",
        headers={"Authorization": f"Bearer {token_b1}"}
    )
    assert resp_b1_resolve.status_code == 200
    resolve_data = resp_b1_resolve.json()
    assert resolve_data["success"] is True
    assert resolve_data["alert"]["status"] == "resolved"

    # Now, neither Bank 2 nor Bank 3 should see the resolved alert in /active
    resp_b2_active = await client.get(
        "/api/bank/emergency-alerts/active",
        headers={"Authorization": f"Bearer {token_b2}"}
    )
    assert len(resp_b2_active.json()) == 0

    resp_b3_active = await client.get(
        "/api/bank/emergency-alerts/active",
        headers={"Authorization": f"Bearer {token_b3}"}
    )
    assert len(resp_b3_active.json()) == 0

@pytest.mark.asyncio
async def test_emergency_alert_auth_and_token_isolation(client: AsyncClient, seed_three_banks):
    b1, _, _ = seed_three_banks
    admin_token = create_admin_token()

    # 1. Unauthenticated request to /emergency-alert -> 401
    resp_unauth = await client.post(
        "/api/bank/emergency-alert",
        json={"blood_group": "O+", "component": "Whole Blood", "units": 5}
    )
    assert resp_unauth.status_code == 401

    # 2. Admin token used on bank emergency-alert endpoint -> 401 (wrong token type)
    resp_admin = await client.post(
        "/api/bank/emergency-alert",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"blood_group": "O+", "component": "Whole Blood", "units": 5}
    )
    assert resp_admin.status_code == 401
