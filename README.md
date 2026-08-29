# VITALS — Verified Inventory Tracking and Availability Logistics System

VITALS is a real-time blood inventory tracking PWA for blood banks across India. Staff report stock via web or SMS; the public searches nearby banks; NGOs monitor coverage.

## ⚠️ Data Disclosure
This repository contains **two categories of data**:
- `data/reference/` — Real publicly-listed blood centre metadata from the National Blood Transfusion Council (NBTC) public registry. Name, city, state, contact only. No patient data.
- `data/demo/` — Fully **synthetic** inventory numbers and reporting history generated for demonstration purposes. Marked `is_demo_data = true` in the database.

**Do not treat demo inventory as real availability.** Always verify with the blood bank directly.

## Stack
- **Backend**: FastAPI + SQLAlchemy (async) + PostgreSQL
- **Frontend**: Next.js 14 (App Router) + Tailwind CSS + Leaflet
- **Offline**: Dexie/IndexedDB + Service Worker
- **SMS**: Twilio webhook

## Quick Start

### 1. Database
```bash
docker compose up -d
```

### 2. Backend
```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env   # fill in your values
python scripts/seed_data.py
uvicorn app.main:app --reload
```
API runs at http://localhost:8000
Docs at http://localhost:8000/docs

### 3. Frontend
```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```
App runs at http://localhost:3000

## Milestone 1 Verification
1. `GET /api/health` → `{"status": "ok"}`
2. `GET /api/blood-banks` → 25–30 seeded banks
3. `POST /api/stock/update` → submit O+ Whole Blood: 5 units
4. `GET /api/stock/search?blood_group=O%2B` → returns updated bank
5. `GET /api/admin/stats` → reporting count changed
6. Visit `/report` → submit form → see "Synced ✓"
7. Visit `/search` → find the bank
8. Visit `/dashboard` → updated metrics

## License
MIT