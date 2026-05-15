"""Shared test helpers for building Instrument/Transaction fixtures."""

from datetime import date
from decimal import Decimal

from app import models


def make_instrument(db, ticker="AAPL", market="foreign"):
    instr = models.Instrument(
        ticker=ticker,
        name=ticker,
        sector="Technology",
        exchange="BMV" if market == "domestic" else "NASDAQ",
        isin=ticker.ljust(12, "X")[:12],
        currency="USD",
        market=market,
        weight_pct=Decimal("0"),
    )
    db.add(instr)
    db.flush()
    return instr


def make_tx(db, instr, trade_date, type_, qty, price_usd, fx_rate="17", fees_mxn="0"):
    # Per-session counter on the db object, so external_id stays unique within a test.
    n = getattr(db, "_seq", 0) + 1
    db._seq = n
    tx = models.Transaction(
        external_id=f"TX-{n:04d}",
        trade_date=date.fromisoformat(trade_date),
        type=type_,
        instrument_id=instr.id,
        qty=Decimal(str(qty)),
        price_usd=Decimal(str(price_usd)),
        fx_rate=Decimal(str(fx_rate)),
        commission_pct=Decimal("0"),
        iva_pct=Decimal("0"),
        fees_mxn=Decimal(str(fees_mxn)),
    )
    db.add(tx)
    db.flush()
    return tx


def list_lots(db):
    return db.query(models.RealizedLot).order_by(models.RealizedLot.id).all()
