"""FIFO matching engine.

realized_lots is a fully derived table: every SELL is matched first-in-first-out
against prior BUYs of the same instrument. Call recompute_realized_lots() after
any change to the transactions ledger to keep realized gains / tax reporting in
sync.
"""

from collections import deque
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import models

_LONG_TERM_DAYS = 365
_CENT = Decimal("0.01")


def _d(value) -> Decimal:
    return Decimal(str(value)) if value is not None else Decimal("0")


def recompute_realized_lots(db: Session) -> int:
    """Rebuild realized_lots from scratch via FIFO matching. Returns row count."""
    markets = dict(
        db.execute(select(models.Instrument.id, models.Instrument.market)).all()
    )
    txs = db.scalars(
        select(models.Transaction)
        .where(models.Transaction.type.in_(("BUY", "SELL")))
        .order_by(models.Transaction.trade_date, models.Transaction.id)
    ).all()

    open_lots: dict[int, deque] = {}
    realized: list[models.RealizedLot] = []

    for tx in txs:
        qty = _d(tx.qty)
        if qty <= 0:
            continue
        unit_native = _d(tx.price_usd) * _d(tx.fx_rate)  # MXN per unit, before fees
        fee_per_unit = _d(tx.fees_mxn) / qty
        lots = open_lots.setdefault(tx.instrument_id, deque())

        if tx.type == "BUY":
            # Fees on a buy add to cost basis.
            lots.append({
                "tx_id": tx.id,
                "date": tx.trade_date,
                "qty": qty,
                "unit_cost": unit_native + fee_per_unit,
            })
            continue

        # SELL — fees on a sell reduce proceeds.
        unit_proceeds = unit_native - fee_per_unit
        remaining = qty
        while remaining > 0 and lots:
            lot = lots[0]
            matched = min(remaining, lot["qty"])
            cost = (matched * lot["unit_cost"]).quantize(_CENT)
            proceeds = (matched * unit_proceeds).quantize(_CENT)
            days = (tx.trade_date - lot["date"]).days
            realized.append(models.RealizedLot(
                instrument_id=tx.instrument_id,
                open_tx_id=lot["tx_id"],
                close_tx_id=tx.id,
                open_date=lot["date"],
                close_date=tx.trade_date,
                qty=matched,
                proceeds_mxn=proceeds,
                cost_mxn=cost,
                gain_mxn=proceeds - cost,
                holding_days=days,
                kind="long" if days > _LONG_TERM_DAYS else "short",
                market=markets.get(tx.instrument_id, "foreign"),
            ))
            lot["qty"] -= matched
            remaining -= matched
            if lot["qty"] <= 0:
                lots.popleft()
        # remaining > 0 here means an oversold position (SELL without a matching
        # BUY); the unmatched quantity is intentionally skipped.

    db.query(models.RealizedLot).delete(synchronize_session=False)
    db.add_all(realized)
    db.commit()
    return len(realized)
