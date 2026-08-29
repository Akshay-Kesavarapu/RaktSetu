import pytest
from httpx import AsyncClient
from datetime import datetime, timezone, timedelta
from app.models import BloodBank, StockUpdate, StockCurrent
from sqlalchemy.future import select

@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    response = await client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

@pytest.mark.asyncio
async def test_create_stock_update(client: AsyncClient, db_session):
    bank = BloodBank(name="Test Bank", bank_ref_code="BB001", city="City", state="State", address="123")
    db_session.add(bank)
    await db_session.commit()
    
    response = await client.post("/api/stock/update", json={
        "bank_id": bank.id,
        "bank_identifier": "BB001",
        "blood_group": "A+",
        "component": "Whole Blood",
        "units": 10
    })
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "reference_id" in data
    assert data["reference_id"].startswith("UPD-")

@pytest.mark.asyncio
async def test_create_stock_update_mismatched_id_rejected_403(client: AsyncClient, db_session):
    bank = BloodBank(name="Secure Bank", bank_ref_code="BB007", city="Delhi", state="Delhi", address="123")
    db_session.add(bank)
    await db_session.commit()
    
    response = await client.post("/api/stock/update", json={
        "bank_id": bank.id,
        "bank_identifier": "BB999", # Wrong ID
        "blood_group": "A+",
        "component": "Whole Blood",
        "units": 10
    })
    assert response.status_code == 403
    assert response.json()["detail"] == "Bank identifier does not match the selected centre. Update rejected."

@pytest.mark.asyncio
async def test_create_stock_update_normalized_variations(client: AsyncClient, db_session):
    bank = BloodBank(name="Normalized Bank", bank_ref_code="BB042", city="Pune", state="Maharashtra", address="789")
    db_session.add(bank)
    await db_session.commit()
    
    # Test lowercase, hyphenated variation
    response = await client.post("/api/stock/update", json={
        "bank_id": bank.id,
        "bank_identifier": " bb-042 ",
        "blood_group": "B+",
        "component": "Whole Blood",
        "units": 8
    })
    assert response.status_code == 200
    assert response.json()["success"] is True

@pytest.mark.asyncio
async def test_create_stock_update_missing_identifier_422(client: AsyncClient, db_session):
    bank = BloodBank(name="Missing ID Bank", bank_ref_code="BB010", city="City", state="State", address="123")
    db_session.add(bank)
    await db_session.commit()
    
    response = await client.post("/api/stock/update", json={
        "bank_id": bank.id,
        "blood_group": "O+",
        "component": "Whole Blood",
        "units": 5
    })
    assert response.status_code == 422

@pytest.mark.asyncio
async def test_lookup_stock_update_valid(client: AsyncClient, db_session):
    bank = BloodBank(name="Lookup Bank", bank_ref_code="BB002", city="Delhi", state="Delhi", address="123")
    db_session.add(bank)
    await db_session.commit()

    update_res = await client.post("/api/stock/update", json={
        "bank_id": bank.id,
        "bank_identifier": "BB002",
        "blood_group": "O+",
        "component": "Whole Blood",
        "units": 15
    })
    ref_id = update_res.json()["reference_id"]

    lookup_res = await client.get(f"/api/stock/lookup/{ref_id}")
    assert lookup_res.status_code == 200
    data = lookup_res.json()
    assert data["success"] is True
    assert data["reference_id"] == ref_id
    assert data["blood_group"] == "O+"
    assert data["units"] == 15
    assert data["is_editable"] is True
    assert data["is_superseded"] is False
    assert data["remaining_seconds"] > 0

@pytest.mark.asyncio
async def test_correct_stock_update_within_24h(client: AsyncClient, db_session):
    bank = BloodBank(name="Correction Bank", bank_ref_code="BB003", city="Mumbai", state="Maharashtra", address="456")
    db_session.add(bank)
    await db_session.commit()

    # 1. Normal submission: 10 units of A+ Whole Blood
    update_res = await client.post("/api/stock/update", json={
        "bank_id": bank.id,
        "bank_identifier": "BB003",
        "blood_group": "A+",
        "component": "Whole Blood",
        "units": 10
    })
    orig_ref = update_res.json()["reference_id"]

    # Verify initial stock is 10 units
    stock_res1 = await client.get(f"/api/stock/{bank.id}")
    a_plus_units = next(item["units"] for item in stock_res1.json() if item["blood_group"] == "A+")
    assert a_plus_units == 10

    # 2. Correct submission to 5 units (mistake: reported 10 instead of 5)
    correct_res = await client.post("/api/stock/correct", json={
        "reference_id": orig_ref,
        "blood_group": "A+",
        "component": "Whole Blood",
        "units": 5
    })
    assert correct_res.status_code == 200
    corr_data = correct_res.json()
    assert corr_data["success"] is True
    assert corr_data["original_reference_id"] == orig_ref
    assert corr_data["new_reference_id"].startswith("UPD-")
    assert corr_data["new_reference_id"] != orig_ref
    assert corr_data["units"] == 5

    # 3. Check stock_current: should reflect 5 units (10 - 10 + 5 = 5)
    stock_res2 = await client.get(f"/api/stock/{bank.id}")
    a_plus_units_after = next(item["units"] for item in stock_res2.json() if item["blood_group"] == "A+")
    assert a_plus_units_after == 5

    # 4. Check database records: original is superseded, new correction links to original
    orig_record = (await db_session.execute(select(StockUpdate).where(StockUpdate.reference_id == orig_ref))).scalars().first()
    assert orig_record.is_superseded is True

    new_record = (await db_session.execute(select(StockUpdate).where(StockUpdate.reference_id == corr_data["new_reference_id"]))).scalars().first()
    assert new_record.is_superseded is False
    assert new_record.corrected_from_reference_id == orig_ref

@pytest.mark.asyncio
async def test_correct_stock_update_older_than_24h_rejected(client: AsyncClient, db_session):
    bank = BloodBank(name="Old Bank", bank_ref_code="BB004", city="Chennai", state="TN", address="789")
    db_session.add(bank)
    await db_session.commit()

    old_time = datetime.now(timezone.utc) - timedelta(hours=25)
    old_update = StockUpdate(
        reference_id="UPD-OLD001",
        bank_id=bank.id,
        blood_group="B+",
        component="Whole Blood",
        units=20,
        is_superseded=False,
        created_at=old_time
    )
    db_session.add(old_update)
    await db_session.commit()

    correct_res = await client.post("/api/stock/correct", json={
        "reference_id": "UPD-OLD001",
        "blood_group": "B+",
        "component": "Whole Blood",
        "units": 10
    })
    assert correct_res.status_code == 400
    assert "Corrections are only allowed within 24 hours" in correct_res.json()["detail"]

    # Verify original remains unchanged
    orig = (await db_session.execute(select(StockUpdate).where(StockUpdate.reference_id == "UPD-OLD001"))).scalars().first()
    assert orig.is_superseded is False

@pytest.mark.asyncio
async def test_correct_stock_update_already_superseded_rejected(client: AsyncClient, db_session):
    bank = BloodBank(name="Superseded Bank", bank_ref_code="BB005", city="Kolkata", state="WB", address="101")
    db_session.add(bank)
    await db_session.commit()

    recent_time = datetime.now(timezone.utc) - timedelta(hours=2)
    superseded_update = StockUpdate(
        reference_id="UPD-SUP001",
        bank_id=bank.id,
        blood_group="AB+",
        component="Whole Blood",
        units=8,
        is_superseded=True,
        created_at=recent_time
    )
    db_session.add(superseded_update)
    await db_session.commit()

    correct_res = await client.post("/api/stock/correct", json={
        "reference_id": "UPD-SUP001",
        "blood_group": "AB+",
        "component": "Whole Blood",
        "units": 4
    })
    assert correct_res.status_code == 400
    assert "already been corrected once" in correct_res.json()["detail"]

@pytest.mark.asyncio
async def test_correct_nonexistent_reference_id_rejected(client: AsyncClient):
    response = await client.post("/api/stock/correct", json={
        "reference_id": "UPD-999999",
        "blood_group": "A+",
        "component": "Whole Blood",
        "units": 5
    })
    assert response.status_code == 404

@pytest.mark.asyncio
async def test_invalid_units(client: AsyncClient, db_session):
    bank = BloodBank(name="Validation Bank", bank_ref_code="BB006", city="Jaipur", state="RJ", address="222")
    db_session.add(bank)
    await db_session.commit()

    response = await client.post("/api/stock/update", json={
        "bank_id": bank.id,
        "bank_identifier": "BB006",
        "blood_group": "A+",
        "component": "Whole Blood",
        "units": -1
    })
    assert response.status_code == 422

@pytest.mark.asyncio
async def test_invalid_blood_group(client: AsyncClient, db_session):
    bank = BloodBank(name="Group Bank", bank_ref_code="BB007", city="Lucknow", state="UP", address="333")
    db_session.add(bank)
    await db_session.commit()

    response = await client.post("/api/stock/update", json={
        "bank_id": bank.id,
        "bank_identifier": "BB007",
        "blood_group": "Z+",
        "component": "Whole Blood",
        "units": 10
    })
    assert response.status_code == 422
