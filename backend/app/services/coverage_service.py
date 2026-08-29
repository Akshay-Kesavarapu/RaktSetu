from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select
from app.models import BloodBank, StockCurrent, StockUpdate
from app.schemas import StatsResponse, CoverageResponse, RegionCoverage, ActivityEvent
from datetime import datetime, timezone, timedelta
from typing import List, Dict

class CoverageService:
    @staticmethod
    async def get_stats(db: AsyncSession) -> StatsResponse:
        total_banks = await db.scalar(select(func.count()).select_from(BloodBank))
        
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        recent_banks_query = select(func.count(func.distinct(StockCurrent.bank_id))).where(StockCurrent.last_updated >= cutoff)
        reporting_today = await db.scalar(recent_banks_query) or 0
        
        stale_banks = (total_banks or 0) - reporting_today
        coverage_pct = (reporting_today / total_banks * 100) if total_banks and total_banks > 0 else 0
        
        total_units = await db.scalar(select(func.sum(StockCurrent.units))) or 0
        total_updates = await db.scalar(select(func.count()).select_from(StockUpdate)) or 0

        last_updated = await db.scalar(select(func.max(StockCurrent.last_updated)))
        if last_updated and last_updated.tzinfo is None:
            last_updated = last_updated.replace(tzinfo=timezone.utc)
        
        return StatsResponse(
            total_banks=total_banks or 0,
            reporting_today=reporting_today,
            stale_banks=stale_banks,
            coverage_pct=coverage_pct,
            total_units=int(total_units),
            total_updates=int(total_updates),
            last_updated=last_updated
        )

    @staticmethod
    async def get_coverage(db: AsyncSession) -> CoverageResponse:
        banks_result = await db.execute(select(BloodBank.id, BloodBank.state))
        banks = banks_result.all()
        
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        active_banks_result = await db.execute(
            select(func.distinct(StockCurrent.bank_id)).where(StockCurrent.last_updated >= cutoff)
        )
        active_bank_ids = set(r[0] for r in active_banks_result.all())
        
        state_stats: Dict[str, dict] = {}
        for bank_id, state in banks:
            if state not in state_stats:
                state_stats[state] = {"total": 0, "active": 0}
            state_stats[state]["total"] += 1
            if bank_id in active_bank_ids:
                state_stats[state]["active"] += 1
                
        regions: List[RegionCoverage] = []
        total_b = 0
        active_b = 0
        for state, stats in state_stats.items():
            total = stats["total"]
            active = stats["active"]
            total_b += total
            active_b += active
            cov_pct = (active / total * 100) if total > 0 else 0
            regions.append(RegionCoverage(
                state=state,
                total_banks=total,
                reporting_today=active,
                coverage_pct=cov_pct
            ))
            
        regions.sort(key=lambda x: x.state)
        total_cov = (active_b / total_b * 100) if total_b > 0 else 0
        
        return CoverageResponse(
            regions=regions,
            total_coverage_pct=total_cov
        )

    @staticmethod
    async def get_recent_activity(db: AsyncSession, limit: int = 50) -> List[ActivityEvent]:
        query = (
            select(StockUpdate, BloodBank)
            .join(BloodBank, StockUpdate.bank_id == BloodBank.id)
            .order_by(StockUpdate.id.desc())
            .limit(limit)
        )
        result = await db.execute(query)
        rows = result.all()

        events: List[ActivityEvent] = []
        for update, bank in rows:
            bg_val = update.blood_group.value if hasattr(update.blood_group, 'value') else str(update.blood_group)
            comp_val = update.component.value if hasattr(update.component, 'value') else str(update.component)
            origin_val = update.data_origin.value if hasattr(update.data_origin, 'value') else str(update.data_origin)

            created_time = update.created_at
            if created_time and created_time.tzinfo is None:
                created_time = created_time.replace(tzinfo=timezone.utc)
            elif not created_time:
                created_time = datetime.now(timezone.utc)

            events.append(
                ActivityEvent(
                    id=update.id,
                    bank_id=bank.id,
                    bank_name=bank.name,
                    city=bank.city,
                    state=bank.state,
                    blood_group=bg_val,
                    component=comp_val,
                    units=update.units,
                    source=update.source or "web",
                    data_origin=origin_val or "partner_reported",
                    created_at=created_time
                )
            )
        return events
