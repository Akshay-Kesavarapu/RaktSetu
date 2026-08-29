import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from fastapi import HTTPException
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from app.models import BloodBank, StockUpdate, StockCurrent, DataOrigin

def generate_reference_id() -> str:
    """Generates unique standard reference ID e.g. UPD-A1B2C3"""
    return f"UPD-{uuid.uuid4().hex[:6].upper()}"

class StockService:
    @staticmethod
    async def get_bank_or_404(db: AsyncSession, bank_id: int) -> BloodBank:
        result = await db.execute(select(BloodBank).where(BloodBank.id == bank_id))
        bank = result.scalars().first()
        if not bank:
            raise HTTPException(status_code=404, detail="Blood bank not found")
        return bank

    @staticmethod
    async def update_stock(
        db: AsyncSession,
        bank_id: int,
        blood_group: str,
        component: str,
        units: int,
        source: str = "web",
        reported_by: Optional[str] = None,
        data_origin: str = "partner_reported",
        is_demo_data: bool = False,
        reference_id: Optional[str] = None
    ) -> StockUpdate:
        await StockService.get_bank_or_404(db, bank_id)
        
        now = datetime.now(timezone.utc)
        ref_id = reference_id or generate_reference_id()
        
        # Normalize DataOrigin enum if string passed
        origin_val = DataOrigin(data_origin) if isinstance(data_origin, str) and data_origin in DataOrigin.__members__.values() else DataOrigin.partner_reported
        if data_origin == "synthetic_demo":
            origin_val = DataOrigin.synthetic_demo
        elif data_origin == "official_reference":
            origin_val = DataOrigin.official_reference

        stock_update = StockUpdate(
            reference_id=ref_id,
            bank_id=bank_id,
            blood_group=blood_group,
            component=component,
            units=units,
            reported_by=reported_by,
            source=source,
            data_origin=origin_val,
            is_demo_data=is_demo_data,
            is_superseded=False,
            created_at=now
        )
        db.add(stock_update)
        
        existing_result = await db.execute(
            select(StockCurrent).where(
                StockCurrent.bank_id == bank_id,
                StockCurrent.blood_group == blood_group,
                StockCurrent.component == component
            )
        )
        existing_stock = existing_result.scalars().first()
        if existing_stock:
            existing_stock.units = (existing_stock.units or 0) + units
            existing_stock.last_updated = now
        else:
            new_stock = StockCurrent(
                bank_id=bank_id,
                blood_group=blood_group,
                component=component,
                units=units,
                last_updated=now
            )
            db.add(new_stock)
            
        await db.commit()
        await db.refresh(stock_update)
        return stock_update

    @staticmethod
    async def lookup_update_by_ref(db: AsyncSession, reference_id: str) -> Dict[str, Any]:
        """
        Looks up a stock update by reference_id and computes 24-hour correction window eligibility.
        """
        clean_ref = reference_id.strip().upper()
        result = await db.execute(
            select(StockUpdate, BloodBank)
            .join(BloodBank, StockUpdate.bank_id == BloodBank.id)
            .where(StockUpdate.reference_id == clean_ref)
        )
        row = result.first()
        if not row:
            raise HTTPException(status_code=404, detail=f"Stock update not found with reference ID '{clean_ref}'.")

        update, bank = row
        
        reported_time = update.created_at
        if reported_time and reported_time.tzinfo is None:
            reported_time = reported_time.replace(tzinfo=timezone.utc)
        elif not reported_time:
            reported_time = datetime.now(timezone.utc)

        now = datetime.now(timezone.utc)
        elapsed_seconds = (now - reported_time).total_seconds()
        window_seconds = 24.0 * 3600.0
        remaining_seconds = max(0.0, window_seconds - elapsed_seconds)
        is_within_24h = elapsed_seconds <= window_seconds

        if update.is_superseded:
            message = "This update has already been corrected once. Contact support for further changes."
            is_editable = False
        elif not is_within_24h:
            message = "This update is no longer editable. Corrections are only allowed within 24 hours of the original submission."
            is_editable = False
        else:
            message = "Update is eligible for correction within the 24-hour window."
            is_editable = True

        bg_val = update.blood_group.value if hasattr(update.blood_group, 'value') else str(update.blood_group)
        comp_val = update.component.value if hasattr(update.component, 'value') else str(update.component)

        return {
            "success": True,
            "reference_id": update.reference_id,
            "bank_id": bank.id,
            "bank_name": bank.name,
            "blood_group": bg_val,
            "component": comp_val,
            "units": update.units,
            "reported_at": reported_time,
            "is_superseded": bool(update.is_superseded),
            "is_editable": is_editable,
            "remaining_seconds": remaining_seconds,
            "message": message
        }

    @staticmethod
    async def correct_stock_update(
        db: AsyncSession,
        reference_id: str,
        blood_group: str,
        component: str,
        units: int,
        reported_by: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Executes an atomic correction on a previous stock update within 24 hours:
        1. Validates original record existence
        2. Validates 24-hour correction window
        3. Validates that original has not already been superseded
        4. Reverses original delta on StockCurrent
        5. Applies corrected delta on StockCurrent
        6. Marks original update is_superseded = True
        7. Inserts new correction update linked via corrected_from_reference_id
        """
        clean_ref = reference_id.strip().upper()
        result = await db.execute(
            select(StockUpdate, BloodBank)
            .join(BloodBank, StockUpdate.bank_id == BloodBank.id)
            .where(StockUpdate.reference_id == clean_ref)
        )
        row = result.first()
        if not row:
            raise HTTPException(status_code=404, detail="Stock update not found.")

        original_update, bank = row

        # Step 2: Validate 24-hour window
        orig_time = original_update.created_at
        if orig_time and orig_time.tzinfo is None:
            orig_time = orig_time.replace(tzinfo=timezone.utc)
        elif not orig_time:
            orig_time = datetime.now(timezone.utc)

        now = datetime.now(timezone.utc)
        elapsed_seconds = (now - orig_time).total_seconds()
        if elapsed_seconds > 24 * 3600:
            raise HTTPException(
                status_code=400,
                detail="This update is no longer editable. Corrections are only allowed within 24 hours of the original submission."
            )

        # Step 3: Validate not already superseded
        if original_update.is_superseded:
            raise HTTPException(
                status_code=400,
                detail="This update has already been corrected once. Contact support for further changes."
            )

        # Step 4: Reversal of original update's units on StockCurrent
        orig_bg = original_update.blood_group.value if hasattr(original_update.blood_group, 'value') else str(original_update.blood_group)
        orig_comp = original_update.component.value if hasattr(original_update.component, 'value') else str(original_update.component)

        orig_stock_res = await db.execute(
            select(StockCurrent).where(
                StockCurrent.bank_id == original_update.bank_id,
                StockCurrent.blood_group == orig_bg,
                StockCurrent.component == orig_comp
            )
        )
        orig_stock = orig_stock_res.scalars().first()
        if orig_stock:
            orig_stock.units = max(0, (orig_stock.units or 0) - original_update.units)
            orig_stock.last_updated = now

        # Step 5: Application of corrected units on StockCurrent
        corr_stock_res = await db.execute(
            select(StockCurrent).where(
                StockCurrent.bank_id == original_update.bank_id,
                StockCurrent.blood_group == blood_group,
                StockCurrent.component == component
            )
        )
        corr_stock = corr_stock_res.scalars().first()
        if corr_stock:
            corr_stock.units = (corr_stock.units or 0) + units
            corr_stock.last_updated = now
        else:
            new_stock = StockCurrent(
                bank_id=original_update.bank_id,
                blood_group=blood_group,
                component=component,
                units=units,
                last_updated=now
            )
            db.add(new_stock)

        # Step 6: Mark original as superseded
        original_update.is_superseded = True

        # Step 7: Create new correction record
        new_ref_id = generate_reference_id()
        correction_update = StockUpdate(
            reference_id=new_ref_id,
            corrected_from_reference_id=original_update.reference_id,
            is_superseded=False,
            bank_id=original_update.bank_id,
            blood_group=blood_group,
            component=component,
            units=units,
            reported_by=reported_by or original_update.reported_by,
            source=original_update.source or "web",
            data_origin=original_update.data_origin,
            is_demo_data=original_update.is_demo_data,
            created_at=now
        )
        db.add(correction_update)

        await db.commit()
        await db.refresh(correction_update)

        return {
            "success": True,
            "message": f"Stock update corrected successfully for {bank.name}.",
            "original_reference_id": original_update.reference_id,
            "new_reference_id": correction_update.reference_id,
            "new_update_id": correction_update.id,
            "bank_id": bank.id,
            "bank_name": bank.name,
            "blood_group": blood_group,
            "component": component,
            "units": units,
            "reported_at": now
        }

    @staticmethod
    async def get_current_stock(db: AsyncSession, bank_id: int) -> List[StockCurrent]:
        result = await db.execute(select(StockCurrent).where(StockCurrent.bank_id == bank_id))
        return list(result.scalars().all())

    @staticmethod
    async def get_stale_banks(db: AsyncSession, hours: int = 24) -> List[BloodBank]:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
        banks_with_recent_stock = select(StockCurrent.bank_id).where(StockCurrent.last_updated >= cutoff).distinct()
        result = await db.execute(select(BloodBank).where(BloodBank.id.not_in(banks_with_recent_stock)))
        return list(result.scalars().all())
