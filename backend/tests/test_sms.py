import pytest
from httpx import AsyncClient
from app.services.sms_service import SMSService, normalize_bank_ref
from app.models import BloodBank, StockCurrent, StockUpdate
from sqlalchemy.future import select

def test_normalize_bank_ref():
    assert normalize_bank_ref("BB007") == "BB007"
    assert normalize_bank_ref("BB-007") == "BB007"
    assert normalize_bank_ref(" bb007 ") == "BB007"
    assert normalize_bank_ref("bb-007") == "BB007"
    assert normalize_bank_ref("BB_007") == "BB007"

def test_parse_sms_command_valid():
    parsed = SMSService.parse_sms_command("UPDATE BB007 APOS 5")
    assert parsed["valid"] is True
    assert parsed["raw_bank_id"] == "BB007"
    assert parsed["normalized_bank_id"] == "BB007"
    assert parsed["blood_group_code"] == "APOS"
    assert parsed["units"] == 5

def test_parse_sms_command_case_insensitive():
    parsed = SMSService.parse_sms_command("update bb-007 apos 10")
    assert parsed["valid"] is True
    assert parsed["raw_bank_id"] == "bb-007"
    assert parsed["normalized_bank_id"] == "BB007"
    assert parsed["blood_group_code"] == "APOS"
    assert parsed["units"] == 10

def test_parse_sms_command_invalid_keyword():
    parsed = SMSService.parse_sms_command("ADD BB007 APOS 5")
    assert parsed["valid"] is False
    assert parsed["status_code"] == 400
    assert "Invalid command" in parsed["error"]

def test_parse_sms_command_missing_field():
    parsed = SMSService.parse_sms_command("UPDATE BB007 APOS")
    assert parsed["valid"] is False
    assert parsed["status_code"] == 400
    assert "Missing required fields" in parsed["error"]

def test_parse_sms_command_extra_field():
    parsed = SMSService.parse_sms_command("UPDATE BB007 APOS 5 EXTRA")
    assert parsed["valid"] is False
    assert parsed["status_code"] == 400
    assert "Too many parameters" in parsed["error"]

def test_parse_sms_command_invalid_blood_group():
    parsed = SMSService.parse_sms_command("UPDATE BB007 XYZ 5")
    assert parsed["valid"] is False
    assert parsed["status_code"] == 400
    assert "Invalid blood group" in parsed["error"]

def test_parse_sms_command_invalid_units():
    for bad_units in ["-5", "abc", "1.5", "0", "5units"]:
        parsed = SMSService.parse_sms_command(f"UPDATE BB007 APOS {bad_units}")
        assert parsed["valid"] is False
        assert parsed["status_code"] == 400

@pytest.mark.asyncio
async def test_sms_webhook_valid_bank(client: AsyncClient, db_session):
    bank = BloodBank(
        bank_ref_code="BB007",
        name="AIIMS Blood Bank",
        city="Delhi",
        state="Delhi",
        address="Ansari Nagar"
    )
    db_session.add(bank)
    await db_session.commit()

    response = await client.post("/api/sms/webhook", json={
        "message_body": "UPDATE BB007 APOS 5"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["bank_ref_code"] == "BB007"
    assert data["bank_id"] == bank.id
    assert data["blood_group"] == "APOS"
    assert data["units"] == 5

@pytest.mark.asyncio
async def test_sms_webhook_hyphen_normalization(client: AsyncClient, db_session):
    bank = BloodBank(
        bank_ref_code="BB007",
        name="Apollo Hospital Blood Bank",
        city="Bangalore",
        state="Karnataka",
        address="Bannerghatta Road"
    )
    db_session.add(bank)
    await db_session.commit()

    response = await client.post("/api/sms/webhook", json={
        "message_body": "UPDATE BB-007 APOS 5"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["bank_id"] == bank.id

@pytest.mark.asyncio
async def test_sms_webhook_invalid_bank_no_db_modification(client: AsyncClient, db_session):
    count_updates_before = (await db_session.execute(select(StockUpdate))).scalars().all()
    
    response = await client.post("/api/sms/webhook", json={
        "message_body": "UPDATE BB999 APOS 5"
    })
    assert response.status_code == 404
    data = response.json()
    assert data["success"] is False
    assert "Invalid blood bank ID: BB999" in data["error"]

    count_updates_after = (await db_session.execute(select(StockUpdate))).scalars().all()
    assert len(count_updates_before) == len(count_updates_after)

@pytest.mark.asyncio
async def test_sms_webhook_invalid_blood_group(client: AsyncClient, db_session):
    bank = BloodBank(
        bank_ref_code="BB007",
        name="Apollo Hospital Blood Bank",
        city="Bangalore",
        state="Karnataka",
        address="Bannerghatta Road"
    )
    db_session.add(bank)
    await db_session.commit()

    response = await client.post("/api/sms/webhook", json={
        "message_body": "UPDATE BB007 XYZ 5"
    })
    assert response.status_code == 400
    data = response.json()
    assert data["success"] is False
    assert "Invalid blood group" in data["error"]

@pytest.mark.asyncio
async def test_sms_webhook_invalid_units_negative(client: AsyncClient, db_session):
    response = await client.post("/api/sms/webhook", json={
        "message_body": "UPDATE BB007 APOS -5"
    })
    assert response.status_code == 400
    data = response.json()
    assert data["success"] is False

@pytest.mark.asyncio
async def test_sms_webhook_invalid_units_text(client: AsyncClient, db_session):
    response = await client.post("/api/sms/webhook", json={
        "message_body": "UPDATE BB007 APOS abc"
    })
    assert response.status_code == 400
    data = response.json()
    assert data["success"] is False

@pytest.mark.asyncio
async def test_sms_webhook_invalid_command_keyword(client: AsyncClient, db_session):
    response = await client.post("/api/sms/webhook", json={
        "message_body": "ADD BB007 APOS 5"
    })
    assert response.status_code == 400
    data = response.json()
    assert data["success"] is False

@pytest.mark.asyncio
async def test_sms_webhook_missing_field(client: AsyncClient, db_session):
    response = await client.post("/api/sms/webhook", json={
        "message_body": "UPDATE BB007 APOS"
    })
    assert response.status_code == 400
    data = response.json()
    assert data["success"] is False

@pytest.mark.asyncio
async def test_sms_webhook_extra_field(client: AsyncClient, db_session):
    response = await client.post("/api/sms/webhook", json={
        "message_body": "UPDATE BB007 APOS 5 EXTRA"
    })
    assert response.status_code == 400
    data = response.json()
    assert data["success"] is False
