# Architecture

## System Diagram

```mermaid
graph TD
    Browser[Browser / PWA]
    SW[Service Worker]
    IDB[(IndexedDB)]
    NextJS[Next.js Frontend]
    FastAPI[FastAPI Backend]
    PG[(PostgreSQL)]
    SMS[SMS / Twilio]
    Webhook[/api/sms/webhook]
    StockService[Stock Service]

    Browser -->|Network request| NextJS
    Browser <-->|Offline data| SW
    SW <--> IDB
    NextJS -->|REST API| FastAPI
    FastAPI <-->|SQLAlchemy| PG
    SMS --> Webhook
    Webhook --> StockService
    StockService --> PG
```

## Layers
- **Frontend (Next.js 14)**: Handles routing, UI, and theming. Uses Tailwind CSS for styling. Light theme for public pages, Dark theme for dashboard.
- **Offline / PWA**: Service Worker intercepts requests. Stock updates are queued in IndexedDB when offline and synced when online.
- **Backend (FastAPI)**: Provides RESTful endpoints for frontend and a webhook for SMS updates. Handles business logic and data validation.
- **Database (PostgreSQL)**: Stores blood bank metadata, current stock, and update history.

## Data Flow
1. **Web Report**: User submits form -> Next.js -> FastAPI `/api/stock/update` -> `StockService` -> DB.
2. **SMS Report**: Twilio webhook -> FastAPI `/api/sms/webhook` -> `StockService` -> DB.
3. **Public Search**: User searches -> Next.js -> FastAPI `/api/stock/search` -> Query DB with spatial/filtering logic -> Next.js renders results.

## Key Design Decisions
- **Unified Stock Service**: Both Web and SMS updates go through a single `StockService` to ensure consistent validation and processing.
- **Forced Theme Per Route**: Using `data-theme="light"` for public pages and `data-theme="dark"` for the dashboard guarantees visual separation and adherence to the design system.
- **Offline-First Queue**: The IndexedDB queue ensures blood bank staff can continue working even with spotty internet connectivity.
