import os
import sys
import csv
import asyncio
from datetime import datetime, timezone

# Add backend directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

db_url = os.environ.get("DATABASE_URL")
if not db_url or "postgresql" in db_url:
    sqlite_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "vitals.db")
    db_url = f"sqlite+aiosqlite:///{sqlite_path}"

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import text
from app.models import BloodBank, StockUpdate, StockCurrent, BloodGroup, BloodComponent, DataOrigin

engine = create_async_engine(db_url, echo=False)
AsyncSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

CSV_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data", "demo", "stock_updates_seed.csv")

COMPONENT_MAP = {
    "WHOLE BLOOD": BloodComponent.WHOLE_BLOOD,
    "PACKED RED CELLS": BloodComponent.PACKED_RED_CELLS,
    "PLASMA": BloodComponent.FRESH_FROZEN_PLASMA,
    "FRESH FROZEN PLASMA": BloodComponent.FRESH_FROZEN_PLASMA,
    "PLATELETS": BloodComponent.PLATELETS,
    "CRYOPRECIPITATE": BloodComponent.CRYOPRECIPITATE,
}

BLOOD_GROUP_MAP = {
    "A+": BloodGroup.A_PLUS,
    "A-": BloodGroup.A_MINUS,
    "B+": BloodGroup.B_PLUS,
    "B-": BloodGroup.B_MINUS,
    "AB+": BloodGroup.AB_PLUS,
    "AB-": BloodGroup.AB_MINUS,
    "O+": BloodGroup.O_PLUS,
    "O-": BloodGroup.O_MINUS,
}

async def seed_stock_updates():
    print("=" * 60)
    print("SEEDING STOCK UPDATES FROM CSV")
    print("=" * 60)
    print(f"Reading CSV from: {CSV_PATH}")

    if not os.path.exists(CSV_PATH):
        fallback = os.path.expanduser(r"~\Downloads\stock_updates_seed.csv")
        if os.path.exists(fallback):
            csv_file = fallback
        else:
            raise FileNotFoundError(f"Cannot find CSV at {CSV_PATH} or {fallback}")
    else:
        csv_file = CSV_PATH

    # Step 1: Ensure reference_id column exists in stock_updates table
    async with engine.begin() as conn:
        try:
            await conn.execute(text("ALTER TABLE stock_updates ADD COLUMN reference_id TEXT"))
            await conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_updates_ref_id ON stock_updates(reference_id)"))
            print("Added reference_id column and unique index to stock_updates table.")
        except Exception:
            # Column already exists
            print("reference_id column already exists in stock_updates table.")

    # Step 2: Build lookup map for existing blood banks
    async with AsyncSessionLocal() as session:
        banks_res = await session.execute(text("SELECT id, name, district FROM blood_banks"))
        db_banks = banks_res.fetchall()
        print(f"Loaded {len(db_banks)} blood bank records from database for matching.")

        bank_lookup = {}
        for b_id, name, dist in db_banks:
            norm_name = name.strip().lower() if name else ""
            norm_dist = dist.strip().lower() if dist else ""
            bank_lookup[(norm_name, norm_dist)] = b_id

        # Step 3: Parse CSV and match rows
        matched_updates = []
        unmatched_rows = []
        updated_bank_ids = set()

        with open(csv_file, mode="r", encoding="latin-1", errors="replace") as f:
            reader = csv.DictReader(f)
            for idx, row in enumerate(reader, start=1):
                ref_id = row["update_reference_id"].strip()
                bname = row["blood_bank_name"].strip()
                dist = row["district"].strip()
                bg_raw = row["blood_group"].strip()
                comp_raw = row["component"].strip()
                units_raw = row["units"].strip()
                source_raw = row["source"].strip()
                origin_raw = row["data_origin"].strip()
                demo_raw = row["is_demo_data"].strip()
                reported_at_raw = row["reported_at"].strip()

                key = (bname.lower(), dist.lower())
                if key not in bank_lookup:
                    unmatched_rows.append({
                        "row_number": idx,
                        "reference_id": ref_id,
                        "blood_bank_name": bname,
                        "district": dist,
                        "state": row.get("state", "").strip()
                    })
                    continue

                bank_id = bank_lookup[key]
                updated_bank_ids.add(bank_id)

                bg = BLOOD_GROUP_MAP.get(bg_raw, BloodGroup.A_PLUS)
                comp = COMPONENT_MAP.get(comp_raw.upper(), BloodComponent.WHOLE_BLOOD)
                units = int(units_raw) if units_raw.isdigit() else 0
                is_demo = demo_raw.lower() in ["true", "1", "yes"]

                try:
                    reported_at = datetime.fromisoformat(reported_at_raw)
                except ValueError:
                    reported_at = datetime.now(timezone.utc)

                stock_upd = StockUpdate(
                    reference_id=ref_id,
                    bank_id=bank_id,
                    blood_group=bg,
                    component=comp,
                    units=units,
                    reported_by=source_raw,
                    source=source_raw,
                    data_origin=DataOrigin.synthetic_demo if origin_raw == "synthetic_demo" else DataOrigin.partner_reported,
                    is_demo_data=is_demo,
                    created_at=reported_at
                )
                session.add(stock_upd)
                matched_updates.append(stock_upd)

                # Update current stock level and last_updated timestamp for the bank
                existing_stock = await session.execute(
                    text("SELECT id, units, last_updated FROM stock_current WHERE bank_id = :b_id AND blood_group = :bg AND component = :comp"),
                    {"b_id": bank_id, "bg": bg.value, "comp": comp.value}
                )
                stock_row = existing_stock.fetchone()

                if stock_row:
                    await session.execute(
                        text("UPDATE stock_current SET units = :units, last_updated = :last_upd WHERE id = :sid"),
                        {"units": units, "last_upd": reported_at, "sid": stock_row[0]}
                    )
                else:
                    new_item = StockCurrent(
                        bank_id=bank_id,
                        blood_group=bg,
                        component=comp,
                        units=units,
                        last_updated=reported_at
                    )
                    session.add(new_item)

        await session.commit()

    total_db_banks = len(db_banks)
    banks_with_updates = len(updated_bank_ids)
    banks_with_zero_updates = total_db_banks - banks_with_updates

    print("\n" + "=" * 60)
    print("VERIFICATION & SEED SUMMARY")
    print("=" * 60)
    print(f"Total CSV Rows Processed: {len(matched_updates) + len(unmatched_rows)}")
    print(f"Successfully Matched & Inserted: {len(matched_updates)}")
    print(f"Unmatched Rows (Bank not in DB): {len(unmatched_rows)}")
    print("-" * 60)
    print(f"Total Blood Banks in DB: {total_db_banks}")
    print(f"Distinct Banks with >=1 Stock Update: {banks_with_updates}")
    print(f"Distinct Banks with 0 Stock Updates:  {banks_with_zero_updates}")
    print("-" * 60)

    if unmatched_rows:
        print("Details of All Unmatched CSV Rows (due to skipped 0,0 coordinate banks):")
        for u in unmatched_rows:
            print(f"  • Row {u['row_number']} [{u['reference_id']}]: '{u['blood_bank_name']}' (District: {u['district']}, State: {u['state']})")

    print("=" * 60)
    print("[OK] Stock updates seed completed successfully.")

if __name__ == "__main__":
    asyncio.run(seed_stock_updates())
