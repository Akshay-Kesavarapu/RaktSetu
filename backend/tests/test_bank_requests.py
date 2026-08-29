import pytest
from httpx import AsyncClient
from app.models import BloodBank, AdminUser
from app.services.auth_service import hash_password, create_access_token

@pytest.mark.asyncio
async def test_bank_login_valid_id_success(client: AsyncClient, db_session):
    bank = BloodBank(
        name="Apollo Hospital Blood Bank",
        bank_ref_code="BB007",
        city="Mumbai",
        state="Maharashtra"
    )
    db_session.add(bank)
    await db_session.commit()

    # Test exact ID
    res = await client.post("/api/bank/login", json={"bank_identifier": "BB007"})
    assert res.status_code == 200
    data = res.json()
    assert "token" in data
    assert data["bank_id"] == bank.id
    assert data["bank_ref_code"] == "BB007"
    assert data["bank_name"] == "Apollo Hospital Blood Bank"

    # Test normalized variation (lowercase with hyphen)
    res_norm = await client.post("/api/bank/login", json={"bank_identifier": " bb-007 "})
    assert res_norm.status_code == 200
    assert res_norm.json()["bank_id"] == bank.id

@pytest.mark.asyncio
async def test_bank_login_invalid_id_rejected_401(client: AsyncClient):
    res = await client.post("/api/bank/login", json={"bank_identifier": "NONEXISTENT999"})
    assert res.status_code == 401
    assert res.json()["detail"] == "Invalid identifier"

@pytest.mark.asyncio
async def test_bank_requests_workflow_and_isolation(client: AsyncClient, db_session):
    # Setup Bank A, Bank B, Bank C
    bank_a = BloodBank(name="AIIMS Blood Bank", bank_ref_code="BB101", city="Delhi", state="Delhi", phone="011-22223333")
    bank_b = BloodBank(name="Fortis Blood Centre", bank_ref_code="BB102", city="Noida", state="UP", phone="0120-44445555")
    bank_c = BloodBank(name="Max Healthcare", bank_ref_code="BB103", city="Gurugram", state="Haryana", phone="0124-66667777")
    db_session.add_all([bank_a, bank_b, bank_c])
    await db_session.commit()

    # Login Bank A and Bank B
    token_a = create_access_token({"sub": str(bank_a.id), "bank_id": bank_a.id, "bank_ref_code": bank_a.bank_ref_code, "type": "bank"})
    token_b = create_access_token({"sub": str(bank_b.id), "bank_id": bank_b.id, "bank_ref_code": bank_b.bank_ref_code, "type": "bank"})
    token_c = create_access_token({"sub": str(bank_c.id), "bank_id": bank_c.id, "bank_ref_code": bank_c.bank_ref_code, "type": "bank"})

    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}
    headers_c = {"Authorization": f"Bearer {token_c}"}

    # 1. Bank A creates an emergency request to Bank B
    req_res = await client.post("/api/bank/requests", headers=headers_a, json={
        "target_bank_id": bank_b.id,
        "blood_group": "O+",
        "component": "Whole Blood",
        "units": 4,
        "note": "Urgent trauma surgery needed within 1 hour"
    })
    assert req_res.status_code == 200
    req_data = req_res.json()
    assert req_data["reference_id"].startswith("REQ-")
    assert req_data["requesting_bank_id"] == bank_a.id
    assert req_data["target_bank_id"] == bank_b.id
    assert req_data["status"] == "pending"
    assert req_data["units"] == 4
    request_id = req_data["id"]

    # 2. Bank A cannot request from itself
    self_res = await client.post("/api/bank/requests", headers=headers_a, json={
        "target_bank_id": bank_a.id,
        "blood_group": "A+",
        "component": "Whole Blood",
        "units": 2
    })
    assert self_res.status_code == 400

    # 3. Bank B views incoming requests -> sees Bank A's request
    incoming_b = await client.get("/api/bank/requests/incoming", headers=headers_b)
    assert incoming_b.status_code == 200
    b_items = incoming_b.json()
    assert len(b_items) >= 1
    assert any(item["id"] == request_id and item["requesting_bank_name"] == "AIIMS Blood Bank" for item in b_items)

    # 4. Bank A views outgoing requests -> sees request to Bank B
    outgoing_a = await client.get("/api/bank/requests/outgoing", headers=headers_a)
    assert outgoing_a.status_code == 200
    a_items = outgoing_a.json()
    assert len(a_items) >= 1
    assert any(item["id"] == request_id and item["target_bank_name"] == "Fortis Blood Centre" for item in a_items)

    # 5. Bank C (unauthorized third party) attempts to respond to Bank B's request -> 403 Forbidden
    resp_c = await client.post(f"/api/bank/requests/{request_id}/respond", headers=headers_c, json={
        "status": "accepted"
    })
    assert resp_c.status_code == 403

    # 6. Bank B accepts the request
    accept_res = await client.post(f"/api/bank/requests/{request_id}/respond", headers=headers_b, json={
        "status": "accepted"
    })
    assert accept_res.status_code == 200
    assert accept_res.json()["status"] == "accepted"
    assert accept_res.json()["responded_at"] is not None

    # 7. Check Bank A's outgoing list now reflects accepted status
    outgoing_a_after = await client.get("/api/bank/requests/outgoing", headers=headers_a)
    updated_item = next(i for i in outgoing_a_after.json() if i["id"] == request_id)
    assert updated_item["status"] == "accepted"

@pytest.mark.asyncio
async def test_cross_token_isolation(client: AsyncClient, db_session):
    # Setup Admin and Bank
    admin = AdminUser(username="AdminSec", password_hash=hash_password("Pass123"))
    bank = BloodBank(name="Cross Bank", bank_ref_code="BB200", city="Chennai", state="TN")
    db_session.add_all([admin, bank])
    await db_session.commit()

    admin_token = create_access_token({"sub": "AdminSec"})
    bank_token = create_access_token({"sub": str(bank.id), "bank_id": bank.id, "bank_ref_code": bank.bank_ref_code, "type": "bank"})

    # 1. Bank token trying to access Admin endpoint -> Rejected 401
    bank_on_admin = await client.get("/api/admin/stats", headers={"Authorization": f"Bearer {bank_token}"})
    assert bank_on_admin.status_code == 401
    assert "Admin token required" in bank_on_admin.json()["detail"]

    # 2. Admin token trying to access Bank endpoint -> Rejected 401
    admin_on_bank = await client.get("/api/bank/requests/incoming", headers={"Authorization": f"Bearer {admin_token}"})
    assert admin_on_bank.status_code == 401
    assert "Bank token required" in admin_on_bank.json()["detail"]
