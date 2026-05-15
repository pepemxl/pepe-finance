/* Offline FIFO matching engine — JS port of backend/app/fifo.py.
 *
 * In live mode the backend derives realized_lots from the transactions ledger.
 * When the backend is unreachable, these helpers do the same client-side so
 * adding / editing a transaction still flows through to realized gains and the
 * tax report. */

import { POSITIONS_RAW } from "./demoData.js";

const LONG_TERM_DAYS = 365;

// Mirrors Instrument.market on the backend (BMV listings are domestic).
const MARKET_BY_TICKER = Object.fromEntries(
  POSITIONS_RAW.map(p => [p.ticker, p.exchange === "BMV" ? "domestic" : "foreign"]),
);

const round2 = (n) => Math.round(n * 100) / 100;

function txNum(id) {
  const m = typeof id === "string" && id.match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}

function daysBetween(openDate, closeDate) {
  return Math.round((new Date(closeDate) - new Date(openDate)) / 86400000);
}

/* Rebuild realized lots from a transactions array via FIFO matching.
 * Returns objects shaped like the API's /realized payload. */
export function computeRealizedLots(transactions) {
  const txs = [...transactions]
    .filter(t => t.type === "BUY" || t.type === "SELL")
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : txNum(a.id) - txNum(b.id)));

  const openLots = new Map(); // ticker -> FIFO queue of { date, qty, unitCost }
  const realized = [];

  for (const tx of txs) {
    const qty = Number(tx.qty);
    if (!(qty > 0)) continue;
    const unitNative = Number(tx.priceUSD) * Number(tx.fxRate); // MXN per unit, pre-fee
    const feePerUnit = Number(tx.feesMXN) / qty;
    if (!openLots.has(tx.ticker)) openLots.set(tx.ticker, []);
    const lots = openLots.get(tx.ticker);

    if (tx.type === "BUY") {
      // Fees on a buy add to cost basis.
      lots.push({ date: tx.date, qty, unitCost: unitNative + feePerUnit });
      continue;
    }

    // SELL — fees on a sell reduce proceeds.
    const unitProceeds = unitNative - feePerUnit;
    let remaining = qty;
    while (remaining > 0 && lots.length > 0) {
      const lot = lots[0];
      const matched = Math.min(remaining, lot.qty);
      const cost = round2(matched * lot.unitCost);
      const proceeds = round2(matched * unitProceeds);
      const days = daysBetween(lot.date, tx.date);
      realized.push({
        closeDate: tx.date,
        openDate: lot.date,
        ticker: tx.ticker,
        qty: matched,
        proceedsMXN: proceeds,
        costMXN: cost,
        gainMXN: round2(proceeds - cost),
        days,
        kind: days > LONG_TERM_DAYS ? "long" : "short",
        market: MARKET_BY_TICKER[tx.ticker] ?? "foreign",
      });
      lot.qty -= matched;
      remaining -= matched;
      if (lot.qty <= 0) lots.shift();
    }
    // remaining > 0 here means an oversold position (SELL without a matching
    // BUY); the unmatched quantity is intentionally skipped.
  }

  return realized;
}

/* Aggregate realized lots into a tax breakdown for one fiscal year — mirrors
 * the backend's /tax/breakdown. rateApplied and carryForward are carried over
 * from the seed breakdown since offline mode has no tax-settings table. */
export function computeTaxBreakdown(realized, year, { rateApplied = 0.30, carryForward = 0 } = {}) {
  let shortTermGain = 0, longTermGain = 0, shortTermLoss = 0, longTermLoss = 0;
  for (const r of realized) {
    if (new Date(r.closeDate).getFullYear() !== year) continue;
    const g = r.gainMXN;
    if (r.kind === "short") {
      if (g >= 0) shortTermGain += g; else shortTermLoss += -g;
    } else {
      if (g >= 0) longTermGain += g; else longTermLoss += -g;
    }
  }
  return {
    year,
    rateApplied,
    shortTermGain: round2(shortTermGain),
    longTermGain: round2(longTermGain),
    shortTermLoss: round2(shortTermLoss),
    longTermLoss: round2(longTermLoss),
    carryForward,
  };
}
