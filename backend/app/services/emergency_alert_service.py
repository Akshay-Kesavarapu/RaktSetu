import uuid
from typing import List, Optional
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status

from app.models import BloodBank, EmergencyAlert, EmergencyAlertAcknowledgment, AlertStatus
from app.schemas import (
    EmergencyAlertCreate,
    EmergencyAlertRead,
    EmergencyAlertAcknowledgeResponse,
    EmergencyAlertResolveResponse,
)

def generate_alert_ref() -> str:
    """Generates unique reference ID for broadcast emergency alerts e.g. EMG-A1B2C3"""
    return f"EMG-{uuid.uuid4().hex[:6].upper()}"

def ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt

class EmergencyAlertService:
    @staticmethod
    def _map_to_read(alert: EmergencyAlert) -> EmergencyAlertRead:
        source_bank = alert.source_bank
        return EmergencyAlertRead(
            id=alert.id,
            reference_id=alert.reference_id,
            source_bank_id=alert.source_bank_id,
            source_bank_name=source_bank.name if source_bank else f"Bank #{alert.source_bank_id}",
            source_bank_city=source_bank.city if source_bank else None,
            source_bank_ref_code=source_bank.bank_ref_code if source_bank else None,
            source_bank_phone=source_bank.phone if source_bank else None,
            blood_group=alert.blood_group.value if hasattr(alert.blood_group, 'value') else str(alert.blood_group),
            component=alert.component.value if hasattr(alert.component, 'value') else str(alert.component),
            units=alert.units,
            note=alert.note,
            status=alert.status,
            created_at=ensure_utc(alert.created_at) or datetime.now(timezone.utc),
            resolved_at=ensure_utc(alert.resolved_at),
        )

    @staticmethod
    async def create_alert(
        db: AsyncSession,
        source_bank: BloodBank,
        data: EmergencyAlertCreate
    ) -> EmergencyAlertRead:
        """Broadcasts an emergency blood alert to all registered blood centres."""
        now = datetime.now(timezone.utc)
        ref_id = generate_alert_ref()

        blood_group_val = data.blood_group.value if hasattr(data.blood_group, 'value') else data.blood_group
        component_val = data.component.value if hasattr(data.component, 'value') else data.component

        new_alert = EmergencyAlert(
            reference_id=ref_id,
            source_bank_id=source_bank.id,
            blood_group=blood_group_val,
            component=component_val,
            units=data.units,
            note=data.note,
            status=AlertStatus.active,
            created_at=now,
            resolved_at=None,
        )
        db.add(new_alert)
        await db.commit()
        await db.refresh(new_alert)

        # Load source_bank relationship
        stmt = (
            select(EmergencyAlert)
            .options(selectinload(EmergencyAlert.source_bank))
            .where(EmergencyAlert.id == new_alert.id)
        )
        res = await db.execute(stmt)
        loaded = res.scalars().first()
        return EmergencyAlertService._map_to_read(loaded or new_alert)

    @staticmethod
    async def get_active_alerts_for_bank(
        db: AsyncSession,
        current_bank_id: int
    ) -> List[EmergencyAlertRead]:
        """
        Returns all active emergency alerts excluding:
        1. Alerts broadcast by the requesting bank itself.
        2. Alerts already acknowledged/dismissed by the requesting bank.
        """
        # Find all alert IDs acknowledged by current_bank_id
        ack_stmt = select(EmergencyAlertAcknowledgment.alert_id).where(
            EmergencyAlertAcknowledgment.bank_id == current_bank_id
        )
        ack_res = await db.execute(ack_stmt)
        ack_ids = set(ack_res.scalars().all())

        # Select active alerts not originating from this bank
        stmt = (
            select(EmergencyAlert)
            .options(selectinload(EmergencyAlert.source_bank))
            .where(
                EmergencyAlert.status == AlertStatus.active,
                EmergencyAlert.source_bank_id != current_bank_id
            )
            .order_by(EmergencyAlert.created_at.desc())
        )
        result = await db.execute(stmt)
        all_active = result.scalars().all()

        unacknowledged = [alert for alert in all_active if alert.id not in ack_ids]
        return [EmergencyAlertService._map_to_read(alert) for alert in unacknowledged]

    @staticmethod
    async def get_my_broadcast_alerts(
        db: AsyncSession,
        current_bank_id: int
    ) -> List[EmergencyAlertRead]:
        """Returns all alerts broadcast by the authenticated bank."""
        stmt = (
            select(EmergencyAlert)
            .options(selectinload(EmergencyAlert.source_bank))
            .where(EmergencyAlert.source_bank_id == current_bank_id)
            .order_by(EmergencyAlert.created_at.desc())
        )
        result = await db.execute(stmt)
        alerts = result.scalars().all()
        return [EmergencyAlertService._map_to_read(alert) for alert in alerts]

    @staticmethod
    async def acknowledge_alert(
        db: AsyncSession,
        current_bank_id: int,
        alert_id: int
    ) -> EmergencyAlertAcknowledgeResponse:
        """
        Records an acknowledgment/dismissal for this bank on the given alert.
        Does not alter the global alert status for other banks.
        """
        # Verify alert exists
        alert_res = await db.execute(select(EmergencyAlert).where(EmergencyAlert.id == alert_id))
        alert = alert_res.scalars().first()
        if not alert:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Emergency alert not found."
            )

        # Check if already acknowledged
        check_stmt = select(EmergencyAlertAcknowledgment).where(
            EmergencyAlertAcknowledgment.alert_id == alert_id,
            EmergencyAlertAcknowledgment.bank_id == current_bank_id
        )
        check_res = await db.execute(check_stmt)
        existing = check_res.scalars().first()

        if not existing:
            new_ack = EmergencyAlertAcknowledgment(
                alert_id=alert_id,
                bank_id=current_bank_id,
                acknowledged_at=datetime.now(timezone.utc)
            )
            db.add(new_ack)
            await db.commit()

        return EmergencyAlertAcknowledgeResponse(
            success=True,
            message="Emergency alert acknowledged",
            alert_id=alert_id
        )

    @staticmethod
    async def resolve_alert(
        db: AsyncSession,
        current_bank_id: int,
        alert_id: int
    ) -> EmergencyAlertResolveResponse:
        """
        Marks an alert as resolved.
        Enforces strict authorization: only the source_bank_id can resolve the alert.
        """
        stmt = (
            select(EmergencyAlert)
            .options(selectinload(EmergencyAlert.source_bank))
            .where(EmergencyAlert.id == alert_id)
        )
        res = await db.execute(stmt)
        alert = res.scalars().first()

        if not alert:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Emergency alert not found."
            )

        if alert.source_bank_id != current_bank_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the originating blood centre can resolve this broadcast alert."
            )

        alert.status = AlertStatus.resolved
        alert.resolved_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(alert)

        return EmergencyAlertResolveResponse(
            success=True,
            message="Emergency alert resolved",
            alert=EmergencyAlertService._map_to_read(alert)
        )
