import asyncio
import sys
import os
from sqlalchemy import select, func

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.database import AsyncSessionLocal
from app.models import BloodBank, StockCurrent

async def main():
    async with AsyncSessionLocal() as session:
        banks_count = await session.scalar(select(func.count()).select_from(BloodBank))
        stock_count = await session.scalar(select(func.count()).select_from(StockCurrent))
        
        print("========================================")
        print("     VITALS Demo Data Verification")
        print("========================================")
        print(f"Blood Banks in Database : {banks_count}")
        print(f"Stock Records in Database: {stock_count}")
        print("========================================")
        
        if not banks_count or not stock_count:
            print("[FAIL] Verification failed! Please run seed_data.py first.")
            sys.exit(1)
            
        print("[OK] All checks passed! Seed data is verified and ready.")

if __name__ == '__main__':
    asyncio.run(main())
