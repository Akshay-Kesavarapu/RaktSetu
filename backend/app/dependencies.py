from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
import jwt

from app.database import get_db
from app.models import AdminUser, BloodBank
from app.services.auth_service import decode_access_token

DbSession = Depends(get_db)
security = HTTPBearer(auto_error=False)

async def get_current_admin(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> AdminUser:
    """
    Authenticates an administrator.
    Rejects any token that is missing, expired, invalid, or issued for a bank portal session.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token required"
        )
    token = credentials.credentials
    try:
        payload = decode_access_token(token)
        # Prevent bank tokens from accessing admin endpoints
        if payload.get("type") == "bank":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Admin token required. Bank credentials not authorized for admin endpoints."
            )
        username = payload.get("sub")
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token"
            )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token"
        )
        
    result = await db.execute(select(AdminUser).where(AdminUser.username == username))
    user = result.scalars().first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    return user

async def get_current_bank(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> BloodBank:
    """
    Authenticates a blood bank portal session.
    Rejects any token that is missing, expired, invalid, or issued for an admin user.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bank authentication token required"
        )
    token = credentials.credentials
    try:
        payload = decode_access_token(token)
        # Ensure token is explicitly issued for a bank portal session
        if payload.get("type") != "bank" or not payload.get("bank_id"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Bank token required. Admin credentials not authorized for bank portal endpoints."
            )
        bank_id = payload.get("bank_id")
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired bank authentication token"
        )
        
    result = await db.execute(select(BloodBank).where(BloodBank.id == bank_id))
    bank = result.scalars().first()
    if not bank:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Blood bank not found"
        )
    return bank
