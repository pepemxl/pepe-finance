from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..database import get_db

router = APIRouter()


def _f(d: Decimal | None) -> float:
    return float(d) if d is not None else 0.0


@router.get("/positions", response_model=list[schemas.PositionOut])
def list_positions(db: Session = Depends(get_db)):
    """Compute current positions from transactions, joined with the latest price."""
    stmt = (
        select(
            models.Instrument,
            models.Price,
            func.coalesce(
                func.sum(
                    func.if_(models.Transaction.type == "BUY", models.Transaction.qty, 0)
                    - func.if_(models.Transaction.type == "SELL", models.Transaction.qty, 0)
                ),
                0,
            ).label("qty"),
            func.coalesce(
                func.sum(
                    func.if_(
                        models.Transaction.type == "BUY",
                        models.Transaction.qty * models.Transaction.price_usd,
                        0,
                    )
                ),
                0,
            ).label("buy_cost_usd"),
            func.coalesce(
                func.sum(
                    func.if_(models.Transaction.type == "BUY", models.Transaction.qty, 0)
                ),
                0,
            ).label("buy_qty"),
        )
        .select_from(models.Instrument)
        .outerjoin(models.Transaction, models.Transaction.instrument_id == models.Instrument.id)
        .outerjoin(models.Price, models.Price.instrument_id == models.Instrument.id)
        .group_by(models.Instrument.id, models.Price.instrument_id)
    )

    out: list[schemas.PositionOut] = []
    for instr, price, qty, buy_cost, buy_qty in db.execute(stmt).all():
        if not price or float(qty) <= 0:
            continue
        avg_cost = float(buy_cost) / float(buy_qty) if float(buy_qty) else 0.0
        out.append(
            schemas.PositionOut(
                ticker=instr.ticker,
                name=instr.name,
                sector=instr.sector,
                exchange=instr.exchange,
                isin=instr.isin,
                qty=float(qty),
                avgCostUSD=avg_cost,
                lastUSD=_f(price.last_usd),
                dayPct=_f(price.day_pct),
                weight=_f(instr.weight_pct),
            )
        )
    return out


@router.get("/transactions", response_model=list[schemas.TransactionOut])
def list_transactions(db: Session = Depends(get_db)):
    rows = (
        db.query(models.Transaction)
        .options(
            joinedload(models.Transaction.instrument),
            joinedload(models.Transaction.account).joinedload(models.Account.broker),
        )
        .order_by(desc(models.Transaction.trade_date), desc(models.Transaction.id))
        .all()
    )
    return [
        schemas.TransactionOut(
            id=t.external_id,
            date=t.trade_date,
            type=t.type,
            ticker=t.instrument.ticker,
            qty=_f(t.qty),
            priceUSD=_f(t.price_usd),
            fxRate=_f(t.fx_rate),
            feesMXN=_f(t.fees_mxn),
            broker=t.account.broker.name if t.account else "—",
            notes=t.notes,
        )
        for t in rows
    ]


@router.post("/transactions", response_model=schemas.TransactionOut, status_code=201)
def create_transaction(payload: schemas.TransactionIn, db: Session = Depends(get_db)):
    instr = db.scalar(select(models.Instrument).where(models.Instrument.ticker == payload.ticker))
    if not instr:
        raise HTTPException(404, f"Unknown ticker: {payload.ticker}")

    account_id = None
    if payload.broker_code and payload.account_number:
        account = db.scalar(
            select(models.Account)
            .join(models.Broker)
            .where(models.Broker.code == payload.broker_code)
            .where(models.Account.number == payload.account_number)
        )
        if account:
            account_id = account.id

    tx = models.Transaction(
        external_id=payload.external_id,
        trade_date=payload.trade_date,
        type=payload.type,
        instrument_id=instr.id,
        account_id=account_id,
        qty=Decimal(str(payload.qty)),
        price_usd=Decimal(str(payload.price_usd)),
        fx_rate=Decimal(str(payload.fx_rate)),
        commission_pct=Decimal(str(payload.commission_pct)),
        iva_pct=Decimal(str(payload.iva_pct)),
        fees_mxn=Decimal(str(payload.fees_mxn)),
        notes=payload.notes,
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)

    broker_name = "—"
    if tx.account_id:
        broker_name = (
            db.scalar(
                select(models.Broker.name)
                .join(models.Account)
                .where(models.Account.id == tx.account_id)
            )
            or "—"
        )

    return schemas.TransactionOut(
        id=tx.external_id,
        date=tx.trade_date,
        type=tx.type,
        ticker=instr.ticker,
        qty=_f(tx.qty),
        priceUSD=_f(tx.price_usd),
        fxRate=_f(tx.fx_rate),
        feesMXN=_f(tx.fees_mxn),
        broker=broker_name,
        notes=tx.notes,
    )


@router.get("/realized", response_model=list[schemas.RealizedOut])
def list_realized(db: Session = Depends(get_db)):
    rows = (
        db.query(models.RealizedLot)
        .options(joinedload(models.RealizedLot.instrument))
        .order_by(desc(models.RealizedLot.close_date))
        .all()
    )
    return [
        schemas.RealizedOut(
            closeDate=r.close_date,
            openDate=r.open_date,
            ticker=r.instrument.ticker,
            qty=_f(r.qty),
            proceedsMXN=_f(r.proceeds_mxn),
            costMXN=_f(r.cost_mxn),
            gainMXN=_f(r.gain_mxn),
            days=r.holding_days,
            kind=r.kind,
            market=r.market,
        )
        for r in rows
    ]


@router.get("/allocation", response_model=list[schemas.AllocationOut])
def allocation(db: Session = Depends(get_db)):
    rows = (
        db.query(models.Instrument.sector, func.sum(models.Instrument.weight_pct))
        .group_by(models.Instrument.sector)
        .all()
    )
    sample_returns = {
        "Technology": 12.4, "Semiconductors": 24.1, "Communication": 6.2,
        "Consumer Disc.": -1.8, "Automotive": -10.4, "Financials": -2.1,
        "Consumer Stap.": 3.2, "ETF": 5.4,
    }
    return [
        schemas.AllocationOut(sector=sector, pct=float(weight or 0), ret=sample_returns.get(sector, 0.0))
        for sector, weight in rows
    ]


@router.get("/performance")
def performance():
    """Synthetic 6-month equity curve. Replace with real EOD valuation series."""
    import math
    import random

    points = 60
    start = 1_240_000
    out: list[int] = []
    for i in range(points):
        drift = 4200 * math.sin(i / 6) + i * 800
        noise = (random.random() - 0.5) * 8000
        out.append(round(start + drift + noise))
    out[-1] = 1_524_318
    return out


@router.get("/tax/breakdown", response_model=schemas.TaxBreakdownOut)
def tax_breakdown(year: int | None = None, db: Session = Depends(get_db)):
    target_year = year or 2026

    setting = db.get(models.TaxSetting, target_year)
    rate = float(setting.rate_applied) if setting else 0.30

    realized = db.scalars(
        select(models.RealizedLot).where(func.year(models.RealizedLot.close_date) == target_year)
    ).all()

    short_gain = sum(_f(r.gain_mxn) for r in realized if r.kind == "short" and r.gain_mxn >= 0)
    long_gain  = sum(_f(r.gain_mxn) for r in realized if r.kind == "long"  and r.gain_mxn >= 0)
    short_loss = -sum(_f(r.gain_mxn) for r in realized if r.kind == "short" and r.gain_mxn < 0)
    long_loss  = -sum(_f(r.gain_mxn) for r in realized if r.kind == "long"  and r.gain_mxn < 0)

    open_balance = db.scalar(
        select(func.coalesce(func.sum(models.LossCarryForward.loss_mxn - models.LossCarryForward.used_mxn), 0))
    )

    return schemas.TaxBreakdownOut(
        year=target_year,
        rateApplied=rate,
        shortTermGain=short_gain,
        longTermGain=long_gain,
        shortTermLoss=short_loss,
        longTermLoss=long_loss,
        carryForward=-float(open_balance or 0),
    )


@router.get("/fx/usd-mxn", response_model=schemas.FxOut)
def fx_rate(db: Session = Depends(get_db)):
    row = db.scalar(
        select(models.FxRate).where(models.FxRate.pair == "USD/MXN").order_by(desc(models.FxRate.as_of))
    )
    if not row:
        return schemas.FxOut(pair="USD/MXN", rate=17.42, as_of=date.today())
    return schemas.FxOut(pair=row.pair, rate=float(row.rate), as_of=row.as_of)
