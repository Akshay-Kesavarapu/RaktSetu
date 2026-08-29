from fastapi import APIRouter, Depends, Query, HTTPException, status
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import get_db
from app.models import AdminUser
from app.schemas import (
    StatsResponse,
    CoverageResponse,
    ActivityEvent,
    AdminLoginRequest,
    AdminLoginResponse,
    FlagSilentBanksResponse
)
from app.services.coverage_service import CoverageService
from app.services.silent_alert_service import SilentAlertService
from app.services.auth_service import verify_password, create_access_token
from app.dependencies import get_current_admin

router = APIRouter(tags=["Admin"])

@router.post("/login", response_model=AdminLoginResponse)
async def admin_login(
    data: AdminLoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Authenticates an administrator using bcrypt password verification against stored database credentials.
    Returns a signed JWT access token valid for 4 hours.
    """
    result = await db.execute(select(AdminUser).where(AdminUser.username == data.username))
    user = result.scalars().first()
    
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
        
    token = create_access_token({"sub": user.username})
    return AdminLoginResponse(
        token=token,
        username=user.username,
        message="Login successful"
    )

@router.get("/stats", response_model=StatsResponse)
async def get_admin_stats(
    db: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(get_current_admin)
):
    """
    Protected endpoint: Returns aggregate stock and coverage statistics.
    Requires Authorization: Bearer <token>.
    """
    return await CoverageService.get_stats(db)

@router.get("/coverage", response_model=CoverageResponse)
async def get_admin_coverage(
    db: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(get_current_admin)
):
    """
    Protected endpoint: Returns regional state-by-state coverage breakdown.
    Requires Authorization: Bearer <token>.
    """
    return await CoverageService.get_coverage(db)

@router.get("/activity", response_model=List[ActivityEvent])
async def get_admin_activity(
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(get_current_admin)
):
    """
    Protected endpoint: Returns live audit stream of stock updates.
    Requires Authorization: Bearer <token>.
    """
    return await CoverageService.get_recent_activity(db, limit=limit)

@router.post("/flag-silent-banks", response_model=FlagSilentBanksResponse)
async def flag_silent_banks(
    db: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(get_current_admin)
):
    """
    Protected endpoint: Identifies all silent blood centres (>24h without updates)
    and records an in-app silent alert for centres that do not already have an unacknowledged alert.
    """
    return await SilentAlertService.flag_silent_banks(db)

