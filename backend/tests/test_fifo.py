"""Unit tests for the FIFO matching engine (app/fifo.py)."""

from datetime import date
from decimal import Decimal

import pytest

from app import models
from app.fifo import recompute_realized_lots


def _instrument(db, ticker="AAPL", market="foreign"):
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


_seq = 0


def _tx(db, instr, trade_date, type_, qty, price_usd, fx_rate="17", fees_mxn="0"):
    global _seq
    _seq += 1
    tx = models.Transaction(
        external_id=f"TX-{_seq:04d}",
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


def _lots(db):
    return db.query(models.RealizedLot).order_by(models.RealizedLot.id).all()


def test_single_buy_sell_full_match(db):
    instr = _instrument(db)
    _tx(db, instr, "2024-01-10", "BUY", 10, 100)
    _tx(db, instr, "2024-06-10", "SELL", 10, 120)

    count = recompute_realized_lots(db)

    assert count == 1
    (lot,) = _lots(db)
    assert lot.qty == Decimal("10")
    assert float(lot.cost_mxn) == pytest.approx(17000.0)      # 10 * 100 * 17
    assert float(lot.proceeds_mxn) == pytest.approx(20400.0)  # 10 * 120 * 17
    assert float(lot.gain_mxn) == pytest.approx(3400.0)
    assert lot.holding_days == 152
    assert lot.kind == "short"
    assert lot.market == "foreign"


def test_partial_sell_leaves_rest_open(db):
    instr = _instrument(db)
    _tx(db, instr, "2024-01-01", "BUY", 10, 100)
    _tx(db, instr, "2024-02-01", "SELL", 4, 110)

    recompute_realized_lots(db)

    (lot,) = _lots(db)
    assert lot.qty == Decimal("4")  # the other 6 stay open, not realized


def test_sell_spans_multiple_buy_lots(db):
    instr = _instrument(db)
    _tx(db, instr, "2024-01-01", "BUY", 5, 100)
    _tx(db, instr, "2024-02-01", "BUY", 5, 200)
    _tx(db, instr, "2024-03-01", "SELL", 8, 300)

    recompute_realized_lots(db)

    lots = _lots(db)
    assert [l.qty for l in lots] == [Decimal("5"), Decimal("3")]
    # FIFO: first lot drawn from the cheaper 100-priced buy, second from the 200 one.
    assert float(lots[0].cost_mxn) == pytest.approx(5 * 100 * 17)
    assert float(lots[1].cost_mxn) == pytest.approx(3 * 200 * 17)


def test_oversell_skips_unmatched_quantity(db):
    instr = _instrument(db)
    _tx(db, instr, "2024-01-01", "BUY", 3, 100)
    _tx(db, instr, "2024-02-01", "SELL", 10, 120)

    recompute_realized_lots(db)

    (lot,) = _lots(db)
    assert lot.qty == Decimal("3")  # only 3 could be matched; 7 silently dropped


def test_sell_with_no_buy_produces_nothing(db):
    instr = _instrument(db)
    _tx(db, instr, "2024-02-01", "SELL", 5, 120)

    assert recompute_realized_lots(db) == 0
    assert _lots(db) == []


def test_fees_raise_cost_and_reduce_proceeds(db):
    instr = _instrument(db)
    _tx(db, instr, "2024-01-01", "BUY", 10, 100, fees_mxn=200)
    _tx(db, instr, "2024-02-01", "SELL", 10, 100, fees_mxn=100)

    recompute_realized_lots(db)

    (lot,) = _lots(db)
    assert float(lot.cost_mxn) == pytest.approx(17200.0)      # 17000 + 200 buy fee
    assert float(lot.proceeds_mxn) == pytest.approx(16900.0)  # 17000 - 100 sell fee
    assert float(lot.gain_mxn) == pytest.approx(-300.0)


def test_holding_period_classification(db):
    instr = _instrument(db)
    # Exactly 365 days is still short — long requires > 365.
    _tx(db, instr, "2022-01-01", "BUY", 1, 100)
    _tx(db, instr, "2023-01-01", "SELL", 1, 100)
    # 366 days -> long.
    _tx(db, instr, "2022-01-01", "BUY", 1, 100)
    _tx(db, instr, "2023-01-02", "SELL", 1, 100)

    recompute_realized_lots(db)

    lots = _lots(db)
    assert {l.holding_days: l.kind for l in lots} == {365: "short", 366: "long"}


def test_dividends_are_ignored(db):
    instr = _instrument(db)
    _tx(db, instr, "2024-01-01", "BUY", 10, 100)
    _tx(db, instr, "2024-03-01", "DIV", 10, 0.5)
    _tx(db, instr, "2024-06-01", "SELL", 10, 120)

    recompute_realized_lots(db)

    (lot,) = _lots(db)
    assert lot.open_date == date(2024, 1, 1)  # matched the BUY, not the DIV
    assert lot.close_date == date(2024, 6, 1)


def test_fifo_is_per_instrument(db):
    aapl = _instrument(db, "AAPL", market="foreign")
    walmex = _instrument(db, "WALMEX", market="domestic")
    _tx(db, aapl, "2024-01-01", "BUY", 5, 100)
    _tx(db, walmex, "2024-01-02", "BUY", 5, 10)
    _tx(db, aapl, "2024-02-01", "SELL", 5, 150)
    _tx(db, walmex, "2024-02-02", "SELL", 5, 12)

    recompute_realized_lots(db)

    lots = {l.instrument_id: l for l in _lots(db)}
    assert lots[aapl.id].market == "foreign"
    assert lots[walmex.id].market == "domestic"
    assert float(lots[aapl.id].cost_mxn) == pytest.approx(5 * 100 * 17)
    assert float(lots[walmex.id].cost_mxn) == pytest.approx(5 * 10 * 17)


def test_matching_orders_by_trade_date_not_insertion(db):
    instr = _instrument(db)
    # Insert the SELL row before the BUY row; the engine must still sort by date.
    _tx(db, instr, "2024-06-01", "SELL", 5, 120)
    _tx(db, instr, "2024-01-01", "BUY", 5, 100)

    recompute_realized_lots(db)

    (lot,) = _lots(db)
    assert lot.open_date == date(2024, 1, 1)
    assert lot.close_date == date(2024, 6, 1)


def test_recompute_replaces_previous_results(db):
    instr = _instrument(db)
    _tx(db, instr, "2024-01-01", "BUY", 10, 100)
    sell = _tx(db, instr, "2024-02-01", "SELL", 10, 120)

    assert recompute_realized_lots(db) == 1

    # Re-running with the same ledger rebuilds rather than appends: the table is
    # wiped first, so the count stays 1 instead of growing to 2.
    assert recompute_realized_lots(db) == 1
    assert len(_lots(db)) == 1

    # Removing the SELL drops the realized lot entirely.
    db.delete(sell)
    db.flush()
    assert recompute_realized_lots(db) == 0
    assert _lots(db) == []
