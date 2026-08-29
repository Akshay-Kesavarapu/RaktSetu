from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select, and_
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List

from app.models import BloodBank, StockCurrent, SilentBankAlert
from app.schemas import FlagSilentBanksResponse, BankSilentAlertResponse, AcknowledgeAlertResponse

class SilentAlertService:
    @staticmethod
    async def flag_silent_banks(db: AsyncSession) -> FlagSilentBanksResponse:
        """
        Identifies all silent banks (no stock update within the last 24 hours or never reported).
        For each silent bank that does not already have an unacknowledged alert, creates a new record in silent_bank_alerts.
        Returns summary with count of newly flagged, already pending, and total silent banks.
        """
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        
        # 1. Find all active bank ids in last 24 hours
        active_banks_result = await db.execute(
            select(func.distinct(StockCurrent.bank_id)).where(StockCurrent.last_updated >= cutoff)
        )
        active_bank_ids = set(r[0] for r in active_banks_result.all())

        # 2. Get all blood banks
        all_banks_result = await db.execute(select(BloodBank.id))
        all_bank_ids = [r[0] for r in all_banks_result.all()]

        # 3. Silent banks are those not active in last 24h
        silent_bank_ids = [bid for bid in all_bank_ids if bid not in active_bank_ids]
        total_silent = len(silent_bank_ids)

        if not silent_bank_ids:
            return FlagSilentBanksResponse(flagged=0, already_pending=0, total_silent=0)

        # 4. Check which silent banks already have an unacknowledged alert
        pending_alerts_result = await db.execute(
            select(SilentBankAlert.bank_id).where(
                and_(
                    SilentBankAlert.bank_id.in_(silent_bank_ids),
                    SilentBankAlert.acknowledged == False
                )
            )
        )
        already_pending_bank_ids = set(r[0] for r in pending_alerts_result.all())

        now_utc = datetime.now(timezone.utc)
        flagged_count = 0
        already_pending_count = len(already_pending_bank_ids)

        for bid in silent_bank_ids:
            if bid not in already_pending_bank_ids:
                new_alert = SilentBankAlert(
                    bank_id=bid,
                    triggered_at=now_utc,
                    acknowledged=False
                )
                db.add(new_alert)
                flagged_count += 1

        if flagged_count > 0:
            await db.commit()

        return FlagSilentBanksResponse(
            flagged=flagged_count,
            already_pending=already_pending_count,
            total_silent=total_silent
        )

    @staticmethod
    async def get_bank_pending_alert(db: AsyncSession, bank_id: int) -> BankSilentAlertResponse:
        """
        Returns the authenticated bank's most recent unacknowledged silent-bank alert, if any.
        """
        query = (
            select(SilentBankAlert)
            .where(
                and_(
                    SilentBankAlert.bank_id == bank_id,
                    SilentBankAlert.acknowledged == False
                )
            )
            .order_by(SilentBankAlert.triggered_at.desc())
        )
        result = await db.execute(query)
        alert = result.scalars().first()

        if not alert:
            return BankSilentAlertResponse(has_alert=False)

        trig_at = alert.triggered_at
        if trig_at and trig_at.tzinfo is None:
            trig_at = trig_at.replace(tzinfo=timezone.utc)

        return BankSilentAlertResponse(
            has_alert=True,
            alert_id=alert.id,
            triggered_at=trig_at
        )

    @staticmethod
    async def acknowledge_alert(db: AsyncSession, bank_id: int) -> AcknowledgeAlertResponse:
        """
        Marks all pending unacknowledged alerts for the authenticated bank as acknowledged.
        """
        query = (
            select(SilentBankAlert)
            .where(
                and_(
                    SilentBankAlert.bank_id == bank_id,
                    SilentBankAlert.acknowledged == False
                )
            )
        )
        result = await db.execute(query)
        alerts = result.scalars().all()

        if not alerts:
            return AcknowledgeAlertResponse(success=True, message="No pending alerts to acknowledge")

        now_utc = datetime.now(timezone.utc)
        for a in alerts:
            a.acknowledged = True
            a.acknowledged_at = now_utc

        await db.commit()
        return AcknowledgeAlertResponse(success=True, message="Alert acknowledged")

    @staticmethod
    async def get_alerts_status_map(db: AsyncSession) -> Dict[int, str]:
        """
        Returns a mapping of bank_id -> status ('pending' or 'acknowledged') for the latest alert of each bank.
        """
        query = select(SilentBankAlert).order_by(SilentBankAlert.triggered_at.desc())
        result = await db.execute(query)
        all_alerts = result.scalars().all()
        status_map: Dict[int, str] = {}
        for a in all_alerts:
            if a.bank_id not in status_map:
                status_map[a.bank_id] = "pending" if not a.acknowledged else "acknowledged"
        return status_map
