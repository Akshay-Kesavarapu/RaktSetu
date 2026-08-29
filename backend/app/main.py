from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.database import init_db
from app.config import settings
from app.routers import health, stock, search, blood_banks, dashboard, sms, bank

@asynccontextmanager
async def lifespan(app: FastAPI):
    if not settings.secret_key or not settings.secret_key.strip():
        raise RuntimeError(
            "CRITICAL SECURITY ERROR: SECRET_KEY is not set. A non-empty secret key must be provided via the .env file or environment variables before starting the application."
        )
    await init_db()
    yield

app = FastAPI(
    title="VITALS API",
    version="1.0.0",
    description="Blood inventory tracking system",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(search.router, prefix="/api/stock")
app.include_router(stock.router, prefix="/api/stock")
app.include_router(blood_banks.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api/admin")
app.include_router(sms.router, prefix="/api/sms")
app.include_router(bank.router, prefix="/api/bank")

@app.get("/")
async def root():
    return {"message": "VITALS API", "docs": "/docs"}
