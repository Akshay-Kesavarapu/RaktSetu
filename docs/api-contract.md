# API Contract

## GET /api/health
- **Response**: `{"status": "ok", "timestamp": "ISO8601"}`

## GET /api/blood-banks
- **Query params**: `city` (optional, string), `state` (optional, string)
- **Response**: Array of BloodBank objects with current stock summary.

## POST /api/stock/update
- **Body**: 
  ```json
  {
    "bank_id": "int",
    "blood_group": "enum",
    "component": "enum",
    "units": "int",
    "reported_by": "string (optional)"
  }
  ```
- **Response**: `{"success": true, "update_id": "int", "message": "string"}`

## GET /api/stock/{bank_id}
- **Response**: `{"bank": "BloodBank object", "stock": ["StockItem objects"]}`

## GET /api/stock/search
- **Query params**: `lat` (float), `lon` (float), `blood_group` (string), `component` (string, optional), `radius_km` (int, default 50)
- **Response**: 
  ```json
  {
    "results": ["SearchResult objects"],
    "total": "int",
    "disclaimer": "string"
  }
  ```
- *SearchResult includes*: bank info, matching stock, `distance_km`, `last_updated`.

## GET /api/admin/stats
- **Response**: 
  ```json
  {
    "total_banks": "int",
    "reporting_today": "int",
    "stale_banks": "int",
    "coverage_pct": "float",
    "last_updated": "ISO8601"
  }
  ```

## GET /api/admin/coverage
- **Response**: `{"regions": ["RegionCoverage objects"], "total_coverage_pct": "float"}`
- *RegionCoverage*: `{"state": "string", "total_banks": "int", "reporting_banks": "int", "coverage_pct": "float"}`

## POST /api/sms/webhook
- **Body**: Form-encoded Twilio format: `From, To, Body`
- **SMS Body format**: `BLOODGROUP COMPONENT_CODE UNITS` (e.g. `O+ WB 12`)
- **Component codes**: WB=Whole Blood, PRC=Packed Red Cells, FFP=Fresh Frozen Plasma, PLT=Platelets, CRYO=Cryoprecipitate
- **Response**: TwiML XML with confirmation message.
