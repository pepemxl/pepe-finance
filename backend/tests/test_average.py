"""Unit tests for the average-cost matching engine (app/fifo.py)."""

from datetime import date
from decimal import Decimal

import pytest

from app import models
from app.fifo import recompute_realized_lots
from helpers import make_instrument, make_tx, list_lots


def test_single_buy_sell_matches_fifo(db):
    # With only one open lot, average == FIFO.
    instr = make_instrument(db)
    make_tx(db, instr, "2024-01-10", "BUY", 10, 100)
    make_tx(db, instr, "2024-06-10", "SELL", 10, 120)

    assert recompute_realized_lots(db, method="average") == 1
    (lot,) = list_lots(db)
    assert float(lot.cost_mxn) == pytest.approx(17000.0)
    assert float(lot.proceeds_mxn) == pytest.approx(20400.0)
    assert float(lot.gain_mxn) == pytest.approx(3400.0)
    assert lot.open_date == date(2024, 1, 10)


def test_two_buys_then_sell_uses_weighted_average(db):
    instr = make_instrument(db)
    make_tx(db, instr, "2024-01-01", "BUY", 10, 100)
    make_tx(db, instr, "2024-02-01", "BUY", 10, 200)
    # Avg cost per unit = (10*100 + 10*200) / 20 = 150 USD * 17 fx = 2550 MXN.
    make_tx(db, instr, "2024-03-01", "SELL", 5, 150)

    recompute_realized_lots(db, method="average")

    (lot,) = list_lots(db)
    assert lot.qty == Decimal("5")
    assert float(lot.cost_mxn) == pytest.approx(5 * 150 * 17)      # 12 750
    assert float(lot.proceeds_mxn) == pytest.approx(5 * 150 * 17)  # 12 750
    assert float(lot.gain_mxn) == pytest.approx(0.0)
    assert lot.open_date == date(2024, 1, 1)  # earliest still-open BUY


def test_average_recomputes_after_intermediate_sell(db):
    # BUY10@100 -> SELL5@200 -> BUY5@300 -> SELL5@400.
    instr = make_instrument(db)
    make_tx(db, instr, "2024-01-01", "BUY", 10, 100)
    make_tx(db, instr, "2024-04-01", "SELL", 5, 200)
    make_tx(db, instr, "2024-07-01", "BUY", 5, 300)
    make_tx(db, instr, "2024-10-01", "SELL", 5, 400)

    recompute_realized_lots(db, method="average")

    lots = list_lots(db)
    assert len(lots) == 2
    # First sell at avg=100 (only one buy): cost = 5*100*17 = 8500, proceeds = 5*200*17 = 17000.
    assert float(lots[0].cost_mxn) == pytest.approx(8500.0)
    assert float(lots[0].gain_mxn) == pytest.approx(8500.0)
    # After first sell remaining qty=5, cost=8500 (avg preserved). Then BUY 5@300:
    # totals -> qty=10, cost=8500 + 5*300*17 = 8500 + 25500 = 34000, avg per unit = 3400 MXN.
    # Second sell 5 -> cost = 5*3400 = 17000, proceeds = 5*400*17 = 34000, gain = 17000.
    assert float(lots[1].cost_mxn) == pytest.approx(17000.0)
    assert float(lots[1].gain_mxn) == pytest.approx(17000.0)


def test_open_date_advances_as_oldest_buys_are_consumed(db):
    instr = make_instrument(db)
    make_tx(db, instr, "2024-01-01", "BUY", 5, 100)
    make_tx(db, instr, "2024-06-01", "BUY", 5, 200)
    make_tx(db, instr, "2024-07-01", "SELL", 5, 250)  # consumes the Jan 1 buy entirely
    make_tx(db, instr, "2024-12-01", "SELL", 5, 300)  # next sell's open_date should be Jun 1

    recompute_realized_lots(db, method="average")

    lots = list_lots(db)
    assert lots[0].open_date == date(2024, 1, 1)
    assert lots[1].open_date == date(2024, 6, 1)


def test_oversell_skipped_under_average(db):
    instr = make_instrument(db)
    make_tx(db, instr, "2024-01-01", "BUY", 3, 100)
    make_tx(db, instr, "2024-02-01", "SELL", 10, 120)

    recompute_realized_lots(db, method="average")

    (lot,) = list_lots(db)
    assert lot.qty == Decimal("3")  # capped at the open qty; the rest is dropped


def test_holding_period_classification_average(db):
    instr = make_instrument(db)
    make_tx(db, instr, "2022-01-01", "BUY", 1, 100)
    make_tx(db, instr, "2023-01-02", "SELL", 1, 100)  # 366 days -> long
    make_tx(db, instr, "2023-02-01", "BUY", 1, 100)
    make_tx(db, instr, "2023-12-31", "SELL", 1, 100)  # 333 days -> short

    recompute_realized_lots(db, method="average")

    lots = list_lots(db)
    assert {l.holding_days: l.kind for l in lots} == {366: "long", 333: "short"}


def test_method_dispatcher_rejects_unknown(db):
    make_instrument(db)
    with pytest.raises(ValueError, match="Unknown matching method"):
        recompute_realized_lots(db, method="lifo")


def test_methods_diverge_on_mixed_cost_basis(db):
    # When earlier and later buys have different prices, FIFO and average produce
    # different cost bases for the same SELL. This locks in that they're really
    # different engines, not aliases.
    def setup():
        instr = make_instrument(db)
        make_tx(db, instr, "2024-01-01", "BUY", 10, 100)
        make_tx(db, instr, "2024-02-01", "BUY", 10, 300)
        make_tx(db, instr, "2024-03-01", "SELL", 10, 250)
        return instr

    instr = setup()
    recompute_realized_lots(db, method="fifo")
    fifo_cost = float(list_lots(db)[0].cost_mxn)  # 10 * 100 * 17 = 17 000

    # Wipe so we start clean and compare apples-to-apples.
    db.query(models.RealizedLot).delete()
    db.flush()

    recompute_realized_lots(db, method="average")
    avg_cost = float(list_lots(db)[0].cost_mxn)   # 10 * 200 * 17 = 34 000

    assert fifo_cost == pytest.approx(17000.0)
    assert avg_cost == pytest.approx(34000.0)
    assert fifo_cost != avg_cost
