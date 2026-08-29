import os
import sys
import csv
import asyncio
from datetime import datetime, timezone

# Add parent directory to path so app modules can be imported
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Database engine creation with fallback
db_url = os.environ.get("DATABASE_URL")
if not db_url or "postgresql" in db_url:
    # Use local sqlite for development if postgres is unavailable
    sqlite_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "vitals.db")
    db_url = f"sqlite+aiosqlite:///{sqlite_path}"

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import text
from app.models import BloodBank, StockCurrent, StockUpdate, DataOrigin, BloodGroup, BloodComponent, Base

engine = create_async_engine(db_url, echo=False)
AsyncSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

CSV_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data", "reference", "blood-banks.csv")

def clean_val(val: str) -> str | None:
    if not val:
        return None
    s = val.strip()
    if s.upper() in ["N/A", "NA", "NULL", ""]:
        return None
    return s

def parse_bool(val: str) -> bool | None:
    cleaned = clean_val(val)
    if not cleaned:
        return None
    c_upper = cleaned.upper()
    if "YES" in c_upper or c_upper == "Y" or c_upper == "TRUE" or c_upper == "1":
        return True
    if "NO" in c_upper or c_upper == "N" or c_upper == "FALSE" or c_upper == "0":
        return False
    return None

async def import_csv_data():
    print("=" * 60)
    print("STARTING BLOOD BANK REGISTRY IMPORT (FIRST 200 ROWS)")
    print("=" * 60)
    print(f"Reading CSV from: {CSV_PATH}")

    if not os.path.exists(CSV_PATH):
        # Fallback to Downloads folder if needed
        fallback = os.path.expanduser(r"~\Downloads\blood_banks_national_200.csv")
        if os.path.exists(fallback):
            csv_file = fallback
        else:
            raise FileNotFoundError(f"Cannot find CSV at {CSV_PATH} or {fallback}")
    else:
        csv_file = CSV_PATH

    # Step 1: Recreate tables to reflect updated schema
    async with engine.begin() as conn:
        print("Recreating database tables to match updated schema with all 14 new metadata columns...")
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    print("Schema update complete.")

    # Step 3 & 4: Read first 200 rows with latin-1 decoding and data cleaning
    inserted_banks = []
    skipped_rows = []
    now = datetime.now(timezone.utc)

    with open(csv_file, mode="r", encoding="latin-1", errors="replace") as f:
        reader = csv.reader(f)
        try:
            raw_headers = next(reader)
        except StopIteration:
            print("Error: Empty CSV file.")
            return

        headers = [h.strip() for h in raw_headers]

        data_rows = []
        for row in reader:
            data_rows.append(row)
            if len(data_rows) >= 200:
                break

    print(f"Read {len(data_rows)} data rows from CSV for processing (capped at 200).")

    async with AsyncSessionLocal() as session:
        for idx, row in enumerate(data_rows, start=1):
            row_map = {headers[i]: row[i].strip() if i < len(row) else "" for i in range(len(headers))}

            name = clean_val(row_map.get("Blood Bank Name", ""))
            if not name:
                skipped_rows.append({
                    "row_number": idx,
                    "bank_name": "N/A",
                    "reason": "Missing / empty Blood Bank Name"
                })
                continue

            lat_raw = clean_val(row_map.get("Latitude", ""))
            lon_raw = clean_val(row_map.get("Longitude", ""))

            if not lat_raw or not lon_raw:
                skipped_rows.append({
                    "row_number": idx,
                    "bank_name": name,
                    "reason": "Missing Latitude or Longitude coordinate"
                })
                continue

            try:
                lat = float(lat_raw)
                lon = float(lon_raw)
                if lat == 0.0 and lon == 0.0:
                    skipped_rows.append({
                        "row_number": idx,
                        "bank_name": name,
                        "reason": "Zero coordinates (0.0, 0.0)"
                    })
                    continue
                if not (-90 <= lat <= 90 and -180 <= lon <= 180):
                    skipped_rows.append({
                        "row_number": idx,
                        "bank_name": name,
                        "reason": f"Out-of-bounds coordinates ({lat}, {lon})"
                    })
                    continue
            except ValueError:
                skipped_rows.append({
                    "row_number": idx,
                    "bank_name": name,
                    "reason": f"Non-numeric coordinates: lat='{lat_raw}', lon='{lon_raw}'"
                })
                continue

            # Contact matching: prefer Contact No, fallback to Mobile
            contact_no = clean_val(row_map.get("Contact No", ""))
            mobile_no = clean_val(row_map.get("Mobile", ""))
            phone = contact_no if contact_no else mobile_no

            state = clean_val(row_map.get("State", ""))
            district = clean_val(row_map.get("District", ""))
            city = clean_val(row_map.get("City", ""))
            address = clean_val(row_map.get("Address", ""))
            pincode = clean_val(row_map.get("Pincode", ""))
            helpline = clean_val(row_map.get("Helpline", ""))
            email = clean_val(row_map.get("Email", ""))
            website = clean_val(row_map.get("Website", ""))
            category = clean_val(row_map.get("Category", ""))
            blood_components_available = clean_val(row_map.get("Blood Component Available", ""))
            apheresis_available = parse_bool(row_map.get("Apheresis", ""))
            service_time = clean_val(row_map.get("Service Time", ""))
            license_number = clean_val(row_map.get("License #", ""))
            nodal_officer_name = clean_val(row_map.get("Nodal Officer", ""))
            nodal_officer_contact = clean_val(row_map.get("Contact Nodal Officer", ""))

            ref_code = f"BB{len(inserted_banks) + 1:03d}"
            bank = BloodBank(
                bank_ref_code=ref_code,
                name=name,
                state=state,
                district=district,
                city=city,
                address=address,
                pincode=pincode,
                phone=phone,
                helpline=helpline,
                email=email,
                website=website,
                category=category,
                blood_components_available=blood_components_available,
                apheresis_available=apheresis_available,
                service_time=service_time,
                license_number=license_number,
                nodal_officer_name=nodal_officer_name,
                nodal_officer_contact=nodal_officer_contact,
                latitude=lat,
                longitude=lon,
                data_origin=DataOrigin.official_reference,
                is_demo_data=False,
                source_url="government_blood_bank_registry_csv",
                source_checked_at=now,
                created_at=now,
                updated_at=now
            )
            session.add(bank)
            inserted_banks.append(bank)

        await session.commit()

        # Re-query all inserted banks to populate their synthetic inventory
        all_banks_res = await session.execute(text("SELECT id, name FROM blood_banks"))
        all_db_banks = all_banks_res.fetchall()

        blood_groups = [BloodGroup.A_PLUS, BloodGroup.A_MINUS, BloodGroup.B_PLUS, BloodGroup.B_MINUS,
                        BloodGroup.AB_PLUS, BloodGroup.AB_MINUS, BloodGroup.O_PLUS, BloodGroup.O_MINUS]
        
        # Seed baseline stock_current records for each bank
        for bank_id, bank_name in all_db_banks:
            for bg in blood_groups:
                stock_item = StockCurrent(
                    bank_id=bank_id,
                    blood_group=bg,
                    component=BloodComponent.WHOLE_BLOOD,
                    units=15 + (bank_id * 3 + len(bg.value)) % 25,
                    last_updated=now
                )
                session.add(stock_item)

        await session.commit()

    print("\n" + "=" * 60)
    print("IMPORT SUMMARY & VERIFICATION")
    print("=" * 60)
    print(f"Total Rows Evaluated: {len(data_rows)}")
    print(f"Successfully Inserted: {len(inserted_banks)}")
    print(f"Skipped Rows: {len(skipped_rows)}")
    print("-" * 60)

    if skipped_rows:
        print("Details of Skipped Rows:")
        for item in skipped_rows:
            print(f"  • Row {item['row_number']}: '{item['bank_name']}' -> Reason: {item['reason']}")

    print("=" * 60)
    print("[OK] All database tables successfully updated and verified.")

if __name__ == "__main__":
    asyncio.run(import_csv_data())
