import pytest
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient
from app.models import BloodBank, StockCurrent, AdminUser, BloodGroup, BloodComponent
from app.services.auth_service import hash_password, create_access_token

@pytest.mark.asyncio
async def test_flag_silent_banks_workflow_and_deduplication(client: AsyncClient, db_session):
    # Setup Admin
    admin = AdminUser(username="AdminAkshay", password_hash=hash_password("12345"), created_at=datetime.now(timezone.utc))
    
    # Setup 3 Banks:
    # Bank 1: Active (stock updated 1 hour ago)
    # Bank 2: Stale (stock updated 30 hours ago)
    # Bank 3: Never reported (no stock current records)
    bank_active = BloodBank(name="Active Blood Centre", bank_ref_code="BB_ACT", city="Mumbai", state="Maharashtra")
    bank_stale = BloodBank(name="Stale Blood Centre", bank_ref_code="BB_STL", city="Delhi", state="Delhi")
    bank_silent = BloodBank(name="Silent Blood Centre", bank_ref_code="BB_SLN", city="Pune", state="Maharashtra")

    db_session.add_all([admin, bank_active, bank_stale, bank_silent])
    await db_session.commit()

    now_utc = datetime.now(timezone.utc)
    stock_active = StockCurrent(
        bank_id=bank_active.id,
        blood_group=BloodGroup.O_PLUS,
        component=BloodComponent.WHOLE_BLOOD,
        units=15,
        last_updated=now_utc - timedelta(hours=1)
    )
    stock_stale = StockCurrent(
        bank_id=bank_stale.id,
        blood_group=BloodGroup.A_PLUS,
        component=BloodComponent.WHOLE_BLOOD,
        units=8,
        last_updated=now_utc - timedelta(hours=30)
    )
    db_session.add_all([stock_active, stock_stale])
    await db_session.commit()

    admin_token = create_access_token({"sub": admin.username})
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Admin triggers flag-silent-banks
    # Total silent should be 2 (bank_stale and bank_silent), bank_active should NOT be flagged
    res = await client.post("/api/admin/flag-silent-banks", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total_silent"] == 2
    assert data["flagged"] == 2
    assert data["already_pending"] == 0

    # 2. Click button again -> No duplicates should be inserted
    res_repeat = await client.post("/api/admin/flag-silent-banks", headers=admin_headers)
    assert res_repeat.status_code == 200
    repeat_data = res_repeat.json()
    assert repeat_data["total_silent"] == 2
    assert repeat_data["flagged"] == 0
    assert repeat_data["already_pending"] == 2

    # 3. Check Bank Portal alert check for Bank 2 (stale/flagged)
    bank_stale_token = create_access_token({"sub": str(bank_stale.id), "bank_id": bank_stale.id, "type": "bank"})
    stale_headers = {"Authorization": f"Bearer {bank_stale_token}"}

    alert_check = await client.get("/api/bank/silent-alert", headers=stale_headers)
    assert alert_check.status_code == 200
    alert_data = alert_check.json()
    assert alert_data["has_alert"] is True
    assert alert_data["alert_id"] is not None
    assert alert_data["triggered_at"] is not None

    # 4. Check Bank Portal alert check for Bank 1 (active -> not flagged)
    bank_active_token = create_access_token({"sub": str(bank_active.id), "bank_id": bank_active.id, "type": "bank"})
    active_headers = {"Authorization": f"Bearer {bank_active_token}"}

    active_alert_check = await client.get("/api/bank/silent-alert", headers=active_headers)
    assert active_alert_check.status_code == 200
    assert active_alert_check.json()["has_alert"] is False

    # 5. Bank 2 acknowledges the alert
    ack_res = await client.post("/api/bank/silent-alert/acknowledge", headers=stale_headers)
    assert ack_res.status_code == 200
    assert ack_res.json()["success"] is True

    # 6. Subsequent check for Bank 2 returns has_alert: False
    post_ack_check = await client.get("/api/bank/silent-alert", headers=stale_headers)
    assert post_ack_check.status_code == 200
    assert post_ack_check.json()["has_alert"] is False

    # 7. Check blood banks list reflects status
    banks_res = await client.get("/api/blood-banks")
    assert banks_res.status_code == 200
    banks_list = banks_res.json()
    stale_item = next(b for b in banks_list if b["id"] == bank_stale.id)
    assert stale_item["silent_alert_status"] == "acknowledged"

@pytest.mark.asyncio
async def test_silent_alerts_auth_and_cross_token_isolation(client: AsyncClient, db_session):
    admin = AdminUser(username="AuthAdmin", password_hash=hash_password("12345"))
    bank = BloodBank(name="Isolated Bank", bank_ref_code="BB_ISO", city="Jaipur")
    db_session.add_all([admin, bank])
    await db_session.commit()

    admin_token = create_access_token({"sub": admin.username})
    bank_token = create_access_token({"sub": str(bank.id), "bank_id": bank.id, "type": "bank"})

    # 1. Unauthenticated requests should return 401
    assert (await client.post("/api/admin/flag-silent-banks")).status_code == 401
    assert (await client.get("/api/bank/silent-alert")).status_code == 401
    assert (await client.post("/api/bank/silent-alert/acknowledge")).status_code == 401

    # 2. Bank JWT cannot access admin endpoint
    assert (await client.post("/api/admin/flag-silent-banks", headers={"Authorization": f"Bearer {bank_token}"})).status_code == 401

    # 3. Admin JWT cannot access bank silent alert endpoints
    assert (await client.get("/api/bank/silent-alert", headers={"Authorization": f"Bearer {admin_token}"})).status_code == 401
    assert (await client.post("/api/bank/silent-alert/acknowledge", headers={"Authorization": f"Bearer {admin_token}"})).status_code == 401
