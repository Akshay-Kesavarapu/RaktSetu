import math
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models import BloodBank, StockCurrent
from app.schemas import SearchResponse, SearchResult, BloodBankRead, StockCurrentRead

class SearchService:
    @staticmethod
    def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        R = 6371.0
        lat1_rad = math.radians(lat1)
        lon1_rad = math.radians(lon1)
        lat2_rad = math.radians(lat2)
        lon2_rad = math.radians(lon2)
        
        dlat = lat2_rad - lat1_rad
        dlon = lon2_rad - lon1_rad
        
        a = math.sin(dlat / 2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c

    @staticmethod
    async def search(
        db: AsyncSession,
        lat: float,
        lon: float,
        blood_group: str = None,
        component: str = None,
        radius_km: float = 50
    ) -> SearchResponse:
        banks_result = await db.execute(select(BloodBank))
        banks = banks_result.scalars().all()
        
        results = []
        for bank in banks:
            if bank.latitude is None or bank.longitude is None:
                continue
            
            distance = SearchService.haversine(lat, lon, float(bank.latitude), float(bank.longitude))
            if distance <= radius_km:
                stock_query = select(StockCurrent).where(StockCurrent.bank_id == bank.id)
                if blood_group:
                    stock_query = stock_query.where(StockCurrent.blood_group == blood_group, StockCurrent.units > 0)
                if component:
                    stock_query = stock_query.where(StockCurrent.component == component)
                    
                stock_result = await db.execute(stock_query)
                stocks = stock_result.scalars().all()
                
                if (blood_group or component) and not stocks:
                    continue
                    
                last_updated = max((s.last_updated for s in stocks if s.last_updated), default=None)
                
                results.append(SearchResult(
                    bank=BloodBankRead.model_validate(bank),
                    stock=[StockCurrentRead.model_validate(s) for s in stocks],
                    distance_km=distance,
                    last_updated=last_updated
                ))
                
        results.sort(key=lambda x: x.distance_km)
        
        return SearchResponse(
            results=results,
            total=len(results),
            disclaimer="PROTOTYPE DATA — Always verify availability directly with the blood bank before visiting."
        )
