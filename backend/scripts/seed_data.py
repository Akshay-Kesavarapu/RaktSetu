import asyncio
import csv
import sys
import os
from datetime import datetime, timezone
from sqlalchemy import select, func

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.database import init_db, AsyncSessionLocal
from app.models import BloodBank, StockCurrent, DataOrigin, BloodGroup, BloodComponent, AdminUser
from app.config import settings
from app.services.auth_service import hash_password

async def main():
    # Ensure database tables exist
    await init_db()
    
    csv_path_banks = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'reference', 'blood_centres_verified.csv')
    csv_path_stock = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'demo', 'inventory_simulated.csv')
    
    banks_inserted = 0
    stock_inserted = 0
    now = datetime.now(timezone.utc)

    async with AsyncSessionLocal() as session:
        if os.path.exists(csv_path_banks):
            with open(csv_path_banks, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    bank_id = int(row['id'])
                    existing = await session.get(BloodBank, bank_id)
                    if not existing:
                        bank = BloodBank(
                            id=bank_id,
                            name=row['name'],
                            city=row['city'],
                            state=row['state'],
                            address=row.get('address', ''),
                            phone=row.get('phone', ''),
                            latitude=float(row['latitude']) if row.get('latitude') else None,
                            longitude=float(row['longitude']) if row.get('longitude') else None,
                            data_origin=DataOrigin.official_reference,
                            is_demo_data=False,
                            source_url=row.get('source_url', 'https://nbtc.nic.in/BloodBanks'),
                            source_checked_at=now,
                            created_at=now,
                            updated_at=now
                        )
                        session.add(bank)
                        banks_inserted += 1
            await session.commit()
            
        if os.path.exists(csv_path_stock):
            with open(csv_path_stock, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    b_id = int(row['bank_id'])
                    bg = row['blood_group']
                    comp = row['component']
                    units = int(row['units'])
                    
                    q = select(StockCurrent).where(
                        StockCurrent.bank_id == b_id,
                        StockCurrent.blood_group == bg,
                        StockCurrent.component == comp
                    )
                    res = await session.execute(q)
                    item = res.scalars().first()
                    if item:
                        item.units = units
                        item.last_updated = now
                    else:
                        item = StockCurrent(
                            bank_id=b_id,
                            blood_group=bg,
                            component=comp,
                            units=units,
                            last_updated=now
                        )
                        session.add(item)
            await session.commit()
            
        # Seed Admin User from Environment Variables
        admin_user = os.environ.get("ADMIN_USERNAME", settings.admin_username)
        admin_pass = os.environ.get("ADMIN_PASSWORD_PLAINTEXT", settings.admin_password_plaintext)
        if admin_user and admin_pass:
            pw_hash = hash_password(admin_pass)
            q_user = select(AdminUser).where(AdminUser.username == admin_user)
            user_res = await session.execute(q_user)
            existing_user = user_res.scalars().first()
            if existing_user:
                existing_user.password_hash = pw_hash
            else:
                session.add(AdminUser(
                    username=admin_user,
                    password_hash=pw_hash,
                    created_at=now
                ))
            await session.commit()
            print(f"[OK] Admin user '{admin_user}' seeded successfully in database.")

    print(f"[OK] Seeded {banks_inserted} blood banks, {stock_inserted} stock records successfully.")

if __name__ == '__main__':
    asyncio.run(main())
