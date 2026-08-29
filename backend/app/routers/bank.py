from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import get_db
from app.models import BloodBank
from app.schemas import (
    BankLoginRequest,
    BankLoginResponse,
    BloodRequestCreate,
    BloodRequestRespond,
    BloodRequestRead,
    BloodBankRead,
    BankSilentAlertResponse,
    AcknowledgeAlertResponse,
    EmergencyAlertCreate,
    EmergencyAlertRead,
    EmergencyAlertAcknowledgeResponse,
    EmergencyAlertResolveResponse,
)
from app.services.sms_service import normalize_bank_ref
from app.services.auth_service import create_access_token
from app.services.bank_request_service import BankRequestService
from app.services.silent_alert_service import SilentAlertService
from app.services.emergency_alert_service import EmergencyAlertService
from app.dependencies import get_current_bank

router = APIRouter(tags=["Bank Portal"])

@router.post("/login", response_model=BankLoginResponse)
async def bank_login(
    data: BankLoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Identifies a blood bank using its unique bank identifier code (e.g. BB007).
    Issues a signed bank-portal JWT token valid for 4 hours with claim type: 'bank'.
    """
    normalized_input = normalize_bank_ref(data.bank_identifier)
    if not normalized_input:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid identifier"
        )

    # Search for matching bank reference code in database
    result = await db.execute(select(BloodBank))
    all_banks = result.scalars().all()
    
    matched_bank = None
    for b in all_banks:
        if b.bank_ref_code and normalize_bank_ref(b.bank_ref_code) == normalized_input:
            matched_bank = b
            break
            
    if not matched_bank:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid identifier"
        )

    token = create_access_token({
        "sub": str(matched_bank.id),
        "bank_id": matched_bank.id,
        "bank_ref_code": matched_bank.bank_ref_code,
        "type": "bank",
        "name": matched_bank.name,
        "city": matched_bank.city
    })

    return BankLoginResponse(
        token=token,
        bank_id=matched_bank.id,
        bank_ref_code=matched_bank.bank_ref_code or f"BB{str(matched_bank.id).padStart(3, '0')}",
        bank_name=matched_bank.name,
        city=matched_bank.city,
        message="Bank identification successful"
    )

@router.get("/me")
async def get_current_bank_info(
    current_bank: BloodBank = Depends(get_current_bank)
):
    """Returns the authenticated bank's profile details."""
    return {
        "id": current_bank.id,
        "name": current_bank.name,
        "bank_ref_code": current_bank.bank_ref_code,
        "city": current_bank.city,
        "state": current_bank.state,
        "phone": current_bank.phone,
        "address": current_bank.address
    }

@router.post("/requests", response_model=BloodRequestRead)
async def create_blood_request(
    data: BloodRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_bank: BloodBank = Depends(get_current_bank)
):
    """
    Creates an emergency blood request from the authenticated bank to a target bank.
    """
    return await BankRequestService.create_request(
        db=db,
        requesting_bank=current_bank,
        data=data
    )

@router.get("/requests/incoming", response_model=List[BloodRequestRead])
async def get_incoming_requests(
    db: AsyncSession = Depends(get_db),
    current_bank: BloodBank = Depends(get_current_bank)
):
    """
    Returns all emergency blood requests directed to the authenticated target bank.
    """
    return await BankRequestService.get_incoming_requests(
        db=db,
        target_bank=current_bank
    )

@router.get("/requests/outgoing", response_model=List[BloodRequestRead])
async def get_outgoing_requests(
    db: AsyncSession = Depends(get_db),
    current_bank: BloodBank = Depends(get_current_bank)
):
    """
    Returns all emergency blood requests sent by the authenticated requesting bank.
    """
    return await BankRequestService.get_outgoing_requests(
        db=db,
        requesting_bank=current_bank
    )

@router.post("/requests/{request_id}/respond", response_model=BloodRequestRead)
async def respond_to_blood_request(
    request_id: int,
    data: BloodRequestRespond,
    db: AsyncSession = Depends(get_db),
    current_bank: BloodBank = Depends(get_current_bank)
):
    """
    Accepts or declines an incoming emergency blood request.
    Only authorized if the authenticated bank is the recipient (target_bank_id) on the request.
    """
    return await BankRequestService.respond_to_request(
        db=db,
        request_id=request_id,
        current_bank=current_bank,
        data=data
    )

@router.get("/silent-alert", response_model=BankSilentAlertResponse)
async def get_bank_silent_alert(
    db: AsyncSession = Depends(get_db),
    current_bank: BloodBank = Depends(get_current_bank)
):
    """
    Returns the authenticated bank's pending unacknowledged silent-bank alert, if any.
    """
    return await SilentAlertService.get_bank_pending_alert(db, current_bank.id)

@router.post("/silent-alert/acknowledge", response_model=AcknowledgeAlertResponse)
async def acknowledge_bank_silent_alert(
    db: AsyncSession = Depends(get_db),
    current_bank: BloodBank = Depends(get_current_bank)
):
    """
    Marks all pending silent-bank alerts for the authenticated bank as acknowledged.
    """
    return await SilentAlertService.acknowledge_alert(db, current_bank.id)

@router.post("/emergency-alert", response_model=EmergencyAlertRead)
async def create_emergency_alert(
    data: EmergencyAlertCreate,
    db: AsyncSession = Depends(get_db),
    current_bank: BloodBank = Depends(get_current_bank)
):
    """
    Broadcasts an emergency blood requirement alert to all registered blood centres.
    """
    return await EmergencyAlertService.create_alert(
        db=db,
        source_bank=current_bank,
        data=data
    )

@router.get("/emergency-alerts/active", response_model=List[EmergencyAlertRead])
async def get_active_emergency_alerts(
    db: AsyncSession = Depends(get_db),
    current_bank: BloodBank = Depends(get_current_bank)
):
    """
    Fetches all active broadcast alerts excluding the bank's own alerts
    and any alerts already acknowledged/dismissed by this bank.
    """
    return await EmergencyAlertService.get_active_alerts_for_bank(
        db=db,
        current_bank_id=current_bank.id
    )

@router.get("/emergency-alerts/my-broadcasts", response_model=List[EmergencyAlertRead])
async def get_my_broadcast_alerts(
    db: AsyncSession = Depends(get_db),
    current_bank: BloodBank = Depends(get_current_bank)
):
    """
    Fetches all broadcast alerts originated by the authenticated bank.
    """
    return await EmergencyAlertService.get_my_broadcast_alerts(
        db=db,
        current_bank_id=current_bank.id
    )

@router.post("/emergency-alert/{alert_id}/acknowledge", response_model=EmergencyAlertAcknowledgeResponse)
async def acknowledge_emergency_alert(
    alert_id: int,
    db: AsyncSession = Depends(get_db),
    current_bank: BloodBank = Depends(get_current_bank)
):
    """
    Dismisses/acknowledges an active emergency broadcast alert for the authenticated bank.
    Does not affect the alert status for other registered centres.
    """
    return await EmergencyAlertService.acknowledge_alert(
        db=db,
        current_bank_id=current_bank.id,
        alert_id=alert_id
    )

@router.post("/emergency-alert/{alert_id}/resolve", response_model=EmergencyAlertResolveResponse)
async def resolve_emergency_alert(
    alert_id: int,
    db: AsyncSession = Depends(get_db),
    current_bank: BloodBank = Depends(get_current_bank)
):
    """
    Resolves an emergency broadcast alert.
    Enforces authorization: only the originating (source) blood centre can resolve the alert.
    """
    return await EmergencyAlertService.resolve_alert(
        db=db,
        current_bank_id=current_bank.id,
        alert_id=alert_id
    )


