from fastapi import APIRouter, Depends, Query
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas import SearchResponse
from app.services.search_service import SearchService

router = APIRouter(tags=["Search"])

@router.get("/search", response_model=SearchResponse)
async def search_stock(
    lat: float = Query(..., description="Latitude"),
    lon: float = Query(..., description="Longitude"),
    blood_group: Optional[str] = Query(None, description="Blood Group"),
    component: Optional[str] = Query(None, description="Component"),
    radius_km: float = Query(50.0, description="Search radius in kilometers"),
    db: AsyncSession = Depends(get_db)
):
    return await SearchService.search(db, lat, lon, blood_group, component, radius_km)
