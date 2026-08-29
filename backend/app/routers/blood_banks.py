from fastapi import APIRouter, Depends, Query
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from sqlalchemy.future import select
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import BloodBank, StockCurrent
from app.schemas import BloodBankRead
from app.services.silent_alert_service import SilentAlertService

router = APIRouter(tags=["Blood Banks"])

@router.get("/blood-banks", response_model=List[BloodBankRead])
async def get_blood_banks(
    city: Optional[str] = None,
    state: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    query = (
        select(
            BloodBank,
            func.max(StockCurrent.last_updated).label("latest_stock_time")
        )
        .outerjoin(StockCurrent, BloodBank.id == StockCurrent.bank_id)
        .group_by(BloodBank.id)
    )
    if city:
        query = query.where(BloodBank.city == city)
    if state:
        query = query.where(BloodBank.state == state)
        
    result = await db.execute(query)
    alerts_status_map = await SilentAlertService.get_alerts_status_map(db)
    cutoff_aware = datetime.now(timezone.utc) - timedelta(hours=24)
    banks: List[BloodBankRead] = []
    
    for bank, latest_time in result.all():
        if latest_time:
            time_aware = latest_time.replace(tzinfo=timezone.utc) if latest_time.tzinfo is None else latest_time
            is_active = time_aware >= cutoff_aware
        else:
            time_aware = None
            is_active = False

        banks.append(
            BloodBankRead(
                id=bank.id,
                bank_ref_code=bank.bank_ref_code,
                name=bank.name,
                state=bank.state,
                district=bank.district,
                city=bank.city,
                address=bank.address,
                pincode=bank.pincode,
                phone=bank.phone,
                helpline=bank.helpline,
                email=bank.email,
                website=bank.website,
                category=bank.category,
                blood_components_available=bank.blood_components_available,
                apheresis_available=bank.apheresis_available,
                service_time=bank.service_time,
                license_number=bank.license_number,
                nodal_officer_name=bank.nodal_officer_name,
                nodal_officer_contact=bank.nodal_officer_contact,
                latitude=float(bank.latitude) if bank.latitude is not None else None,
                longitude=float(bank.longitude) if bank.longitude is not None else None,
                data_origin=bank.data_origin,
                is_demo_data=bank.is_demo_data,
                created_at=bank.created_at,
                last_updated=latest_time,
                is_active=is_active,
                silent_alert_status=alerts_status_map.get(bank.id)
            )
        )
    return banks
