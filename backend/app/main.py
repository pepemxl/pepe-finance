from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .config import settings
from .database import SessionLocal, engine
from .fifo import recompute_realized_lots
from .routers import portfolio


@asynccontextmanager
async def lifespan(_: FastAPI):
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    # realized_lots is derived from the transactions ledger — rebuild it on boot
    # so tax reporting is consistent even if the table was seeded or edited.
    with SessionLocal() as db:
        recompute_realized_lots(db)
    yield


app = FastAPI(title="FinanceStocks API", version="0.1", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(portfolio.router, prefix="/api")
