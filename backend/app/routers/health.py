from fastapi import APIRouter, Depends
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas import HealthResponse, StatsResponse
from app.services.coverage_service import CoverageService

router = APIRouter(tags=["Health"])

@router.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(status="ok", timestamp=datetime.now(timezone.utc))

@router.get("/public-stats", response_model=StatsResponse)
async def get_public_stats(db: AsyncSession = Depends(get_db)):
    return await CoverageService.get_stats(db)
