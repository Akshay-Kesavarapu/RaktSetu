from fastapi import APIRouter, Depends, HTTPException
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas import (
    StockUpdateCreate,
    StockUpdateResponse,
    StockCurrentRead,
    StockCorrectionCreate,
    StockCorrectionResponse,
    StockLookupResponse
)
from app.services.stock_service import StockService
from app.services.sms_service import normalize_bank_ref

router = APIRouter(tags=["Stock"])

@router.post("/update", response_model=StockUpdateResponse)
async def update_stock(data: StockUpdateCreate, db: AsyncSession = Depends(get_db)):
    bank = await StockService.get_bank_or_404(db, data.bank_id)
    
    input_identifier = normalize_bank_ref(data.bank_identifier)
    stored_ref_code = normalize_bank_ref(bank.bank_ref_code)

    if not input_identifier or input_identifier != stored_ref_code:
        raise HTTPException(
            status_code=403,
            detail="Bank identifier does not match the selected centre. Update rejected."
        )

    update = await StockService.update_stock(
        db=db,
        bank_id=data.bank_id,
        blood_group=data.blood_group.value if hasattr(data.blood_group, 'value') else data.blood_group,
        component=data.component.value if hasattr(data.component, 'value') else data.component,
        units=data.units,
        reported_by=data.reported_by
    )
    return StockUpdateResponse(
        success=True,
        update_id=update.id,
        reference_id=update.reference_id,
        message="Stock updated successfully"
    )

@router.get("/lookup/{reference_id}", response_model=StockLookupResponse)
async def lookup_stock(reference_id: str, db: AsyncSession = Depends(get_db)):
    """
    Lookup a previous stock update by reference ID and verify 24-hour correction window.
    """
    return await StockService.lookup_update_by_ref(db=db, reference_id=reference_id)

@router.post("/correct", response_model=StockCorrectionResponse)
async def correct_stock(data: StockCorrectionCreate, db: AsyncSession = Depends(get_db)):
    """
    Atomically corrects a previously submitted stock update within 24 hours of original submission.
    """
    return await StockService.correct_stock_update(
        db=db,
        reference_id=data.reference_id,
        blood_group=data.blood_group.value if hasattr(data.blood_group, 'value') else data.blood_group,
        component=data.component.value if hasattr(data.component, 'value') else data.component,
        units=data.units,
        reported_by=data.reported_by
    )

@router.get("/{bank_id}", response_model=List[StockCurrentRead])
async def get_stock(bank_id: int, db: AsyncSession = Depends(get_db)):
    return await StockService.get_current_stock(db, bank_id)
