import pytest
from app.services.search_service import SearchService

def test_haversine_distance():
    # Delhi: 28.6139, 77.2090
    # Mumbai: 19.0760, 72.8777
    dist = SearchService.haversine(28.6139, 77.2090, 19.0760, 72.8777)
    assert 1100 < dist < 1200

@pytest.mark.asyncio
async def test_search_returns_results(client, db_session):
    from app.models import BloodBank, StockCurrent
    from datetime import datetime, timezone
    
    bank1 = BloodBank(name="B1", city="C1", state="S1", address="A1", latitude=28.0, longitude=77.0)
    bank2 = BloodBank(name="B2", city="C2", state="S2", address="A2", latitude=19.0, longitude=72.0)
    db_session.add_all([bank1, bank2])
    await db_session.commit()
    
    stock = StockCurrent(bank_id=bank1.id, blood_group="A+", component="Whole Blood", units=10, last_updated=datetime.now(timezone.utc))
    db_session.add(stock)
    await db_session.commit()
    
    response = await client.get("/api/stock/search?lat=28.0&lon=77.0&radius_km=50")
    assert response.status_code == 200
    data = response.json()
    assert len(data["results"]) == 1
    assert data["results"][0]["bank"]["name"] == "B1"

@pytest.mark.asyncio
async def test_search_radius_filter(client, db_session):
    from app.models import BloodBank
    
    bank = BloodBank(name="B1", city="C1", state="S1", address="A1", latitude=19.0, longitude=72.0)
    db_session.add(bank)
    await db_session.commit()
    
    response = await client.get("/api/stock/search?lat=28.0&lon=77.0&radius_km=50")
    assert response.status_code == 200
    assert len(response.json()["results"]) == 0
