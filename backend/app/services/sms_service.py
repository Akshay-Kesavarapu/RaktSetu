import re
import logging
import httpx
from typing import Tuple, Optional, Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models import BloodGroup, BloodComponent, BloodBank, StockUpdate
from app.services.stock_service import StockService
from app.config import settings

logger = logging.getLogger("sms_webhook")

# Map of supported blood group codes
SMS_BLOOD_GROUP_MAP: Dict[str, BloodGroup] = {
    # Standard alphanumeric codes
    "APOS": BloodGroup.A_PLUS,
    "ANEG": BloodGroup.A_MINUS,
    "BPOS": BloodGroup.B_PLUS,
    "BNEG": BloodGroup.B_MINUS,
    "OPOS": BloodGroup.O_PLUS,
    "ONEG": BloodGroup.O_MINUS,
    "ABPOS": BloodGroup.AB_PLUS,
    "ABNEG": BloodGroup.AB_MINUS,
    # Standard symbols
    "A+": BloodGroup.A_PLUS,
    "A-": BloodGroup.A_MINUS,
    "B+": BloodGroup.B_PLUS,
    "B-": BloodGroup.B_MINUS,
    "O+": BloodGroup.O_PLUS,
    "O-": BloodGroup.O_MINUS,
    "AB+": BloodGroup.AB_PLUS,
    "AB-": BloodGroup.AB_MINUS,
}

def normalize_bank_ref(code: Optional[str]) -> str:
    """
    Normalizes bank reference code:
    - Trims whitespace
    - Converts to uppercase
    - Strips hyphens, underscores, and internal spaces
    Example: 'BB-007' -> 'BB007', ' bb007 ' -> 'BB007'
    """
    if not code:
        return ""
    return re.sub(r'[\s\-_]', '', str(code).strip()).upper()

async def send_sms_confirmation(blood_group: str, component: str, units: int, bank_name: str) -> dict:
    """
    Sends a real SMS via SMS Gateway for Android's local server API.
    Only works when this backend process is running on the same
    Wi-Fi network as the phone running SMS Gateway for Android.
    """
    url = f"{settings.sms_gateway_local_url}/message"
    payload = {
        "textMessage": {
            "text": f"Stock update: {bank_name} reported {units} units of {blood_group} {component}."
        },
        "phoneNumbers": [settings.sms_confirmation_recipient]
    }
    
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(
                url,
                json=payload,
                auth=(settings.sms_gateway_username, settings.sms_gateway_password)
            )
            if response.status_code in (200, 201, 202):
                logger.info(f"SMS confirmation sent successfully to {settings.sms_confirmation_recipient}")
                return {"sms_sent": True}
            else:
                error_msg = f"SMS Gateway returned HTTP {response.status_code}: {response.text}"
                logger.warning(f"Failed to send SMS confirmation: {error_msg}")
                return {"sms_sent": False, "error": error_msg}
    except Exception as e:
        error_msg = f"Error sending SMS confirmation via {url}: {str(e)}"
        logger.warning(f"Failed to send SMS confirmation: {error_msg}")
        return {"sms_sent": False, "error": error_msg}

class SMSService:
    @staticmethod
    def parse_sms_command(body: str) -> Dict[str, Any]:
        """
        Validates and parses SMS command in expected format:
        UPDATE <BANK_ID> <BLOODGROUP> <UNITS>
        Example: UPDATE BB007 APOS 5
        """
        clean_body = body.strip()
        if not clean_body:
            return {
                "valid": False,
                "status_code": 400,
                "error": "Empty SMS body. Expected format: UPDATE <BANK_ID> <BLOODGROUP> <UNITS> (e.g., UPDATE BB007 APOS 5)."
            }

        tokens = clean_body.split()

        # 1. Validate Command Keyword
        if tokens[0].upper() != "UPDATE":
            return {
                "valid": False,
                "status_code": 400,
                "error": f"Invalid command '{tokens[0]}'. Command must start with 'UPDATE' (e.g., UPDATE BB007 APOS 5)."
            }

        # 2. Validate Token Count (Must have exactly 4 tokens)
        if len(tokens) < 4:
            return {
                "valid": False,
                "status_code": 400,
                "error": f"Missing required fields. Expected format: UPDATE <BANK_ID> <BLOODGROUP> <UNITS> (e.g., UPDATE BB007 APOS 5)."
            }
        
        if len(tokens) > 4:
            return {
                "valid": False,
                "status_code": 400,
                "error": f"Too many parameters in command. Expected exactly: UPDATE <BANK_ID> <BLOODGROUP> <UNITS>."
            }

        raw_bank_id = tokens[1]
        raw_bg = tokens[2]
        raw_units = tokens[3]

        # 3. Validate Blood Group
        bg_code = raw_bg.upper()
        if bg_code not in SMS_BLOOD_GROUP_MAP:
            return {
                "valid": False,
                "status_code": 400,
                "raw_bank_id": raw_bank_id,
                "error": f"Invalid blood group '{raw_bg}'. Supported groups are APOS, ANEG, BPOS, BNEG, ABPOS, ABNEG, OPOS, ONEG (or A+, A-, B+, B-, AB+, AB-, O+, O-)."
            }

        blood_group = SMS_BLOOD_GROUP_MAP[bg_code]

        # 4. Validate Units (Must be positive integer > 0)
        if not raw_units.isdigit():
            return {
                "valid": False,
                "status_code": 400,
                "raw_bank_id": raw_bank_id,
                "blood_group": bg_code,
                "error": f"Invalid units value '{raw_units}'. Units must be a positive integer greater than 0."
            }

        try:
            units = int(raw_units)
            if units <= 0:
                return {
                    "valid": False,
                    "status_code": 400,
                    "raw_bank_id": raw_bank_id,
                    "blood_group": bg_code,
                    "error": f"Units must be greater than 0, received {units}."
                }
        except ValueError:
            return {
                "valid": False,
                "status_code": 400,
                "raw_bank_id": raw_bank_id,
                "blood_group": bg_code,
                "error": f"Invalid units value '{raw_units}'. Units must be a positive integer."
            }

        return {
            "valid": True,
            "raw_bank_id": raw_bank_id,
            "normalized_bank_id": normalize_bank_ref(raw_bank_id),
            "blood_group_code": bg_code,
            "blood_group": blood_group,
            "component": BloodComponent.WHOLE_BLOOD,
            "units": units
        }

    @staticmethod
    async def process_webhook(
        db: AsyncSession,
        message_body: str,
        from_number: Optional[str] = None,
        message_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Processes SMS webhook request with strict bank identification:
        1. Validates SMS syntax (UPDATE <BANK_ID> <BLOODGROUP> <UNITS>)
        2. Normalizes BANK_ID
        3. Identifies blood bank via bank_ref_code exclusively
        4. Validates blood group & units
        5. Updates stock scoped ONLY to the identified blood bank
        6. Sends real SMS confirmation via local Android SMS Gateway API
        7. Returns structured response with standard HTTP status code
        """
        logger.info(f"Incoming SMS webhook request | from='{from_number}' | body='{message_body}'")

        # Step 1: Parse and validate SMS command syntax
        parsed = SMSService.parse_sms_command(message_body)
        if not parsed.get("valid"):
            logger.warning(f"SMS validation failed: {parsed.get('error')} | status={parsed.get('status_code')}")
            return {
                "success": False,
                "status_code": parsed.get("status_code", 400),
                "error": parsed.get("error"),
                "message": "Validation failed"
            }

        raw_bank_id = parsed["raw_bank_id"]
        target_norm_code = parsed["normalized_bank_id"]
        bg_code = parsed["blood_group_code"]
        blood_group = parsed["blood_group"]
        component = parsed["component"]
        units = parsed["units"]

        # Step 2: Idempotency Check (if provider message ID is supplied)
        if message_id:
            dup_check = await db.execute(
                select(StockUpdate).where(StockUpdate.reference_id == message_id)
            )
            existing_update = dup_check.scalars().first()
            if existing_update:
                logger.info(f"Duplicate SMS message_id '{message_id}' detected. Returning idempotent success.")
                return {
                    "success": True,
                    "status_code": 200,
                    "message": f"SMS message '{message_id}' has already been processed.",
                    "bank_ref_code": raw_bank_id,
                    "bank_id": existing_update.bank_id,
                    "blood_group": bg_code,
                    "units": existing_update.units,
                    "source": "sms",
                    "update_id": existing_update.id
                }

        # Step 3: Bank Identification Lookup exclusively via bank_ref_code
        banks_result = await db.execute(select(BloodBank))
        all_banks = banks_result.scalars().all()

        matched_banks: List[BloodBank] = []
        for bank in all_banks:
            # Check bank_ref_code column if populated
            if bank.bank_ref_code:
                if normalize_bank_ref(bank.bank_ref_code) == target_norm_code:
                    matched_banks.append(bank)
                    continue

            # Fallback to standard generated BB{id:03d} / BB{id}
            std_ref = f"BB{bank.id:03d}"
            if std_ref == target_norm_code or f"BB{bank.id}" == target_norm_code:
                matched_banks.append(bank)

        # 4. Check for Invalid Bank (0 matches)
        if len(matched_banks) == 0:
            logger.warning(f"Bank identification failed: No matching blood bank for BANK_ID '{raw_bank_id}' (normalized: '{target_norm_code}')")
            return {
                "success": False,
                "status_code": 404,
                "error": f"Invalid blood bank ID: {raw_bank_id}. No matching blood bank was found.",
                "message": "Blood bank not found"
            }

        # 5. Check for Ambiguous Matches (>1 matches)
        if len(matched_banks) > 1:
            matched_ids = [b.id for b in matched_banks]
            logger.error(f"Ambiguous bank reference '{raw_bank_id}' (normalized: '{target_norm_code}') matched multiple bank IDs: {matched_ids}")
            return {
                "success": False,
                "status_code": 409,
                "error": f"Ambiguous blood bank reference: '{raw_bank_id}' matches multiple blood banks. Administrative correction required.",
                "message": "Ambiguous blood bank reference"
            }

        resolved_bank = matched_banks[0]
        logger.info(f"Bank resolved successfully: ID={resolved_bank.id}, Name='{resolved_bank.name}', RefCode='{resolved_bank.bank_ref_code}'")

        # Step 6: Execute stock update scoped exclusively to resolved_bank.id
        update = await StockService.update_stock(
            db=db,
            bank_id=resolved_bank.id,
            blood_group=blood_group.value,
            component=component.value,
            units=units,
            source="sms",
            reported_by=from_number or resolved_bank.bank_ref_code or f"BB{resolved_bank.id:03d}",
            data_origin="synthetic_demo",
            is_demo_data=True
        )

        # If a message_id was provided, record it in stock_updates.reference_id
        if message_id:
            update.reference_id = message_id
            await db.commit()

        logger.info(f"Stock update completed: UpdateID={update.id}, BankID={resolved_bank.id}, Group={blood_group.value}, AddedUnits={units}")

        # Step 7: Send real SMS confirmation via local Android SMS Gateway API
        sms_conf = await send_sms_confirmation(
            blood_group=bg_code,
            component=component.value,
            units=units,
            bank_name=resolved_bank.name
        )

        return {
            "success": True,
            "status_code": 200,
            "message": f"Blood stock updated successfully for {resolved_bank.name}",
            "bank_ref_code": resolved_bank.bank_ref_code or raw_bank_id,
            "bank_id": resolved_bank.id,
            "bank_name": resolved_bank.name,
            "blood_group": bg_code,
            "component": component.value,
            "units": units,
            "source": "sms",
            "update_id": update.id,
            "sms_confirmation": sms_conf
        }

    @staticmethod
    def make_twiml_response(message: str) -> str:
        """Returns standard TwiML XML string for telecom gateway compatibility."""
        return f'<?xml version="1.0"?><Response><Message>{message}</Message></Response>'
