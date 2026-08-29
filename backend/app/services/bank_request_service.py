import uuid
from typing import List, Optional
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status

from app.models import BloodBank, BloodRequest, RequestStatus, BloodGroup, BloodComponent
from app.schemas import BloodRequestCreate, BloodRequestRespond, BloodRequestRead

def generate_request_ref() -> str:
    """Generates unique reference ID for emergency blood requests e.g. REQ-A1B2C3"""
    return f"REQ-{uuid.uuid4().hex[:6].upper()}"

def ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt

class BankRequestService:
    @staticmethod
    def _map_to_read(req: BloodRequest) -> BloodRequestRead:
        req_bank = req.requesting_bank
        target_bank = req.target_bank
        
        return BloodRequestRead(
            id=req.id,
            reference_id=req.reference_id,
            requesting_bank_id=req.requesting_bank_id,
            target_bank_id=req.target_bank_id,
            requesting_bank_name=req_bank.name if req_bank else f"Bank #{req.requesting_bank_id}",
            requesting_bank_city=req_bank.city if req_bank else None,
            requesting_bank_ref_code=req_bank.bank_ref_code if req_bank else None,
            requesting_bank_phone=req_bank.phone if req_bank else None,
            target_bank_name=target_bank.name if target_bank else f"Bank #{req.target_bank_id}",
            target_bank_city=target_bank.city if target_bank else None,
            target_bank_ref_code=target_bank.bank_ref_code if target_bank else None,
            target_bank_phone=target_bank.phone if target_bank else None,
            blood_group=req.blood_group.value if hasattr(req.blood_group, 'value') else str(req.blood_group),
            component=req.component.value if hasattr(req.component, 'value') else str(req.component),
            units=req.units,
            note=req.note,
            status=req.status,
            created_at=ensure_utc(req.created_at) or datetime.now(timezone.utc),
            responded_at=ensure_utc(req.responded_at),
        )

    @staticmethod
    async def create_request(
        db: AsyncSession,
        requesting_bank: BloodBank,
        data: BloodRequestCreate
    ) -> BloodRequestRead:
        if data.target_bank_id == requesting_bank.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot send emergency blood request to your own centre."
            )
            
        target_result = await db.execute(select(BloodBank).where(BloodBank.id == data.target_bank_id))
        target_bank = target_result.scalars().first()
        if not target_bank:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Target blood bank not found."
            )

        now = datetime.now(timezone.utc)
        ref_id = generate_request_ref()

        blood_group_val = data.blood_group.value if hasattr(data.blood_group, 'value') else data.blood_group
        component_val = data.component.value if hasattr(data.component, 'value') else data.component

        new_request = BloodRequest(
            reference_id=ref_id,
            requesting_bank_id=requesting_bank.id,
            target_bank_id=target_bank.id,
            blood_group=blood_group_val,
            component=component_val,
            units=data.units,
            note=data.note,
            status=RequestStatus.pending,
            created_at=now,
            responded_at=None,
        )
        db.add(new_request)
        await db.commit()
        await db.refresh(new_request)

        # Load relationships for response mapping
        stmt = (
            select(BloodRequest)
            .options(
                selectinload(BloodRequest.requesting_bank),
                selectinload(BloodRequest.target_bank)
            )
            .where(BloodRequest.id == new_request.id)
        )
        res = await db.execute(stmt)
        full_req = res.scalars().first()
        return BankRequestService._map_to_read(full_req)

    @staticmethod
    async def get_incoming_requests(
        db: AsyncSession,
        target_bank: BloodBank
    ) -> List[BloodRequestRead]:
        stmt = (
            select(BloodRequest)
            .options(
                selectinload(BloodRequest.requesting_bank),
                selectinload(BloodRequest.target_bank)
            )
            .where(BloodRequest.target_bank_id == target_bank.id)
            .order_by(BloodRequest.created_at.desc())
        )
        result = await db.execute(stmt)
        requests = result.scalars().all()
        return [BankRequestService._map_to_read(r) for r in requests]

    @staticmethod
    async def get_outgoing_requests(
        db: AsyncSession,
        requesting_bank: BloodBank
    ) -> List[BloodRequestRead]:
        stmt = (
            select(BloodRequest)
            .options(
                selectinload(BloodRequest.requesting_bank),
                selectinload(BloodRequest.target_bank)
            )
            .where(BloodRequest.requesting_bank_id == requesting_bank.id)
            .order_by(BloodRequest.created_at.desc())
        )
        result = await db.execute(stmt)
        requests = result.scalars().all()
        return [BankRequestService._map_to_read(r) for r in requests]

    @staticmethod
    async def respond_to_request(
        db: AsyncSession,
        request_id: int,
        current_bank: BloodBank,
        data: BloodRequestRespond
    ) -> BloodRequestRead:
        stmt = (
            select(BloodRequest)
            .options(
                selectinload(BloodRequest.requesting_bank),
                selectinload(BloodRequest.target_bank)
            )
            .where(BloodRequest.id == request_id)
        )
        result = await db.execute(stmt)
        req = result.scalars().first()
        
        if not req:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Blood request not found."
            )
            
        if req.target_bank_id != current_bank.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to respond to blood requests addressed to another centre."
            )

        req.status = data.status
        req.responded_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(req)

        return BankRequestService._map_to_read(req)
