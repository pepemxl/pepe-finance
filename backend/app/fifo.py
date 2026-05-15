"""Realized-lot matching engines.

realized_lots is a fully derived table: every SELL is matched against prior
BUYs of the same instrument. Two strategies are supported:

- ``fifo``: each SELL consumes BUY lots first-in-first-out, with each match
  recording the cost basis from that specific lot.
- ``average``: each SELL is costed at the running weighted-average cost of the
  open position; one realized row per SELL. The realized lot's ``open_date`` is
  the earliest still-open BUY date at sell time, so the holding period stays
  defensible.

Call ``recompute_realized_lots(db, method)`` after any change to the
transactions ledger to keep realized gains / tax reporting in sync.
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


def recompute_realized_lots(db: Session, method: str = "fifo") -> int:
    """Rebuild realized_lots from the transactions ledger using ``method``."""
    markets = dict(
        db.execute(select(models.Instrument.id, models.Instrument.market)).all()
    )
    txs = db.scalars(
        select(models.Transaction)
        .where(models.Transaction.type.in_(("BUY", "SELL")))
        .order_by(models.Transaction.trade_date, models.Transaction.id)
    ).all()

    if method == "average":
        realized = _match_average(txs, markets)
    elif method == "fifo":
        realized = _match_fifo(txs, markets)
    else:
        raise ValueError(f"Unknown matching method: {method!r}")

    db.query(models.RealizedLot).delete(synchronize_session=False)
    db.add_all(realized)
    db.commit()
    return len(realized)


def _match_fifo(txs, markets):
    open_lots: dict[int, deque] = {}
    realized: list[models.RealizedLot] = []

    for tx in txs:
        qty = _d(tx.qty)
        if qty <= 0:
            continue
        unit_native = _d(tx.price_usd) * _d(tx.fx_rate)  # MXN per unit, pre-fee
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
        # remaining > 0 here means an oversold position; unmatched qty is skipped.

    return realized


def _match_average(txs, markets):
    # Per instrument: a FIFO queue of open BUYs (just for date tracking), plus
    # running totals (qty + cost MXN) used to compute the weighted average.
    open_buys: dict[int, deque] = {}
    totals: dict[int, dict[str, Decimal]] = {}
    realized: list[models.RealizedLot] = []

    for tx in txs:
        qty = _d(tx.qty)
        if qty <= 0:
            continue
        unit_native = _d(tx.price_usd) * _d(tx.fx_rate)

        if tx.type == "BUY":
            buy_cost = qty * unit_native + _d(tx.fees_mxn)  # fees add to cost basis
            open_buys.setdefault(tx.instrument_id, deque()).append(
                {"date": tx.trade_date, "qty": qty}
            )
            t = totals.setdefault(
                tx.instrument_id, {"qty": Decimal("0"), "cost": Decimal("0")}
            )
            t["qty"] += qty
            t["cost"] += buy_cost
            continue

        # SELL — costed at the running average; oversold qty is skipped.
        t = totals.setdefault(
            tx.instrument_id, {"qty": Decimal("0"), "cost": Decimal("0")}
        )
        if t["qty"] <= 0:
            continue
        sell_qty = min(qty, t["qty"])
        avg = t["cost"] / t["qty"]
        cost_basis = (sell_qty * avg).quantize(_CENT)
        unit_proceeds = unit_native - _d(tx.fees_mxn) / qty
        proceeds = (sell_qty * unit_proceeds).quantize(_CENT)

        buys = open_buys.setdefault(tx.instrument_id, deque())
        open_date = buys[0]["date"] if buys else tx.trade_date
        # Advance the queue so the next sell's open_date reflects what's still held.
        remaining = sell_qty
        while remaining > 0 and buys:
            front = buys[0]
            matched = min(remaining, front["qty"])
            front["qty"] -= matched
            remaining -= matched
            if front["qty"] <= 0:
                buys.popleft()

        days = (tx.trade_date - open_date).days
        realized.append(models.RealizedLot(
            instrument_id=tx.instrument_id,
            open_tx_id=None,  # no single opening transaction under average cost
            close_tx_id=tx.id,
            open_date=open_date,
            close_date=tx.trade_date,
            qty=sell_qty,
            proceeds_mxn=proceeds,
            cost_mxn=cost_basis,
            gain_mxn=proceeds - cost_basis,
            holding_days=days,
            kind="long" if days > _LONG_TERM_DAYS else "short",
            market=markets.get(tx.instrument_id, "foreign"),
        ))
        t["qty"] -= sell_qty
        t["cost"] -= cost_basis
        if t["qty"] <= 0:
            t["cost"] = Decimal("0")  # avoid carrying a residual when position closes

    return realized
