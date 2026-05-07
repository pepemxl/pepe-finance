from datetime import date

from pydantic import BaseModel


class PositionOut(BaseModel):
    ticker: str
    name: str
    sector: str
    exchange: str
    isin: str
    qty: float
    avgCostUSD: float
    lastUSD: float
    dayPct: float
    weight: float


class TransactionOut(BaseModel):
    id: str
    date: date
    type: str
    ticker: str
    qty: float
    priceUSD: float
    fxRate: float
    feesMXN: float
    broker: str
    notes: str | None = None


class TransactionIn(BaseModel):
    external_id: str
    trade_date: date
    type: str
    ticker: str
    qty: float
    price_usd: float
    fx_rate: float
    commission_pct: float = 0.0025
    iva_pct: float = 0.16
    fees_mxn: float = 0.0
    broker_code: str | None = None
    account_number: str | None = None
    notes: str | None = None


class RealizedOut(BaseModel):
    closeDate: date
    openDate: date
    ticker: str
    qty: float
    proceedsMXN: float
    costMXN: float
    gainMXN: float
    days: int
    kind: str
    market: str


class AllocationOut(BaseModel):
    sector: str
    pct: float
    ret: float


class TaxBreakdownOut(BaseModel):
    year: int
    rateApplied: float
    shortTermGain: float
    longTermGain: float
    shortTermLoss: float
    longTermLoss: float
    carryForward: float


class FxOut(BaseModel):
    pair: str
    rate: float
    as_of: date
