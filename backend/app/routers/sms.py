from fastapi import APIRouter, Depends, Request, Response, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from app.database import get_db
from app.schemas import SMSWebhookRequest, SMSWebhookResponse
from app.services.sms_service import SMSService

router = APIRouter(tags=["SMS"])

@router.post("/webhook", response_model=SMSWebhookResponse)
async def sms_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    from_number = ""
    message_body = ""
    message_id = ""

    # Check content type: JSON vs Form urlencoded
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        try:
            body_json = await request.json()
            from_number = body_json.get("from_number") or body_json.get("From") or ""
            message_body = body_json.get("message_body") or body_json.get("Body") or ""
            message_id = body_json.get("message_id") or body_json.get("MessageSid") or body_json.get("sms_id") or ""
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid JSON payload.")
    else:
        form_data = await request.form()
        from_number = str(form_data.get("from_number") or form_data.get("From") or "")
        message_body = str(form_data.get("message_body") or form_data.get("Body") or "")
        message_id = str(form_data.get("message_id") or form_data.get("MessageSid") or form_data.get("sms_id") or "")

    if not message_body or not str(message_body).strip():
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "success": False,
                "error": "Missing required field: 'message_body' (e.g., 'UPDATE BB007 APOS 5').",
                "message": "Bad request"
            }
        )

    # Process through SMSService with BANK_ID identification
    result = await SMSService.process_webhook(
        db=db,
        message_body=message_body,
        from_number=from_number or None,
        message_id=message_id or None
    )

    status_code = result.get("status_code", 200 if result.get("success") else 400)
    return JSONResponse(
        status_code=status_code,
        content=result
    )
