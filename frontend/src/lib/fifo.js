/* Offline realized-lot matching engines — JS port of backend/app/fifo.py.
 *
 * Two strategies are supported via the `method` parameter:
 *  - "fifo"    (default): each SELL consumes BUY lots first-in-first-out.
 *  - "average": each SELL is costed at the running weighted-average cost; the
 *               realized lot's open_date is the earliest still-open BUY date.
 *
 * In live mode the backend computes these. When the backend is unreachable,
 * these helpers do the same client-side so adding / editing a transaction or
 * switching method still updates realized gains and the tax report. */

import { POSITIONS_RAW } from "./demoData.js";

const LONG_TERM_DAYS = 365;

// Mirrors Instrument.market on the backend (BMV listings are domestic).
const MARKET_BY_TICKER = Object.fromEntries(
  POSITIONS_RAW.map(p => [p.ticker, p.exchange === "BMV" ? "domestic" : "foreign"]),
);

const round2 = (n) => Math.round(n * 100) / 100;
const marketOf = (ticker) => MARKET_BY_TICKER[ticker] ?? "foreign";

function txNum(id) {
  const m = typeof id === "string" && id.match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}

function daysBetween(openDate, closeDate) {
  return Math.round((new Date(closeDate) - new Date(openDate)) / 86400000);
}

function sortedBuySell(transactions) {
  return [...transactions]
    .filter(t => t.type === "BUY" || t.type === "SELL")
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : txNum(a.id) - txNum(b.id)));
}

function realizedRow(tx, openDate, qty, costMxn, proceedsMxn) {
  const days = daysBetween(openDate, tx.date);
  return {
    closeDate: tx.date,
    openDate,
    ticker: tx.ticker,
    qty,
    proceedsMXN: proceedsMxn,
    costMXN: costMxn,
    gainMXN: round2(proceedsMxn - costMxn),
    days,
    kind: days > LONG_TERM_DAYS ? "long" : "short",
    market: marketOf(tx.ticker),
  };
}

/* Build realized lots from a transactions array.
 * `method` is "fifo" (default) or "average". */
export function computeRealizedLots(transactions, method = "fifo") {
  const txs = sortedBuySell(transactions);
  if (method === "average") return matchAverage(txs);
  if (method === "fifo")    return matchFifo(txs);
  throw new Error(`Unknown matching method: ${method}`);
}

function matchFifo(txs) {
  const openLots = new Map(); // ticker -> queue of { date, qty, unitCost }
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
      realized.push(realizedRow(tx, lot.date, matched, cost, proceeds));
      lot.qty -= matched;
      remaining -= matched;
      if (lot.qty <= 0) lots.shift();
    }
    // remaining > 0 means an oversold position; unmatched qty is skipped.
  }
  return realized;
}

function matchAverage(txs) {
  const openBuys = new Map(); // ticker -> queue of { date, qty }  (for open_date tracking)
  const totals = new Map();   // ticker -> { qty, cost } running totals in MXN
  const realized = [];

  for (const tx of txs) {
    const qty = Number(tx.qty);
    if (!(qty > 0)) continue;
    const unitNative = Number(tx.priceUSD) * Number(tx.fxRate);

    if (tx.type === "BUY") {
      const buyCost = qty * unitNative + Number(tx.feesMXN); // fees add to cost basis
      if (!openBuys.has(tx.ticker)) openBuys.set(tx.ticker, []);
      openBuys.get(tx.ticker).push({ date: tx.date, qty });
      const t = totals.get(tx.ticker) ?? { qty: 0, cost: 0 };
      t.qty += qty;
      t.cost += buyCost;
      totals.set(tx.ticker, t);
      continue;
    }

    // SELL — costed at the running average; oversold qty is skipped.
    const t = totals.get(tx.ticker);
    if (!t || t.qty <= 0) continue;
    const sellQty = Math.min(qty, t.qty);
    const avg = t.cost / t.qty;
    const costBasis = round2(sellQty * avg);
    const unitProceeds = unitNative - Number(tx.feesMXN) / qty;
    const proceeds = round2(sellQty * unitProceeds);

    const buys = openBuys.get(tx.ticker) ?? [];
    const openDate = buys.length > 0 ? buys[0].date : tx.date;
    // Advance the queue so the next sell's open_date reflects what's still held.
    let remaining = sellQty;
    while (remaining > 0 && buys.length > 0) {
      const front = buys[0];
      const matched = Math.min(remaining, front.qty);
      front.qty -= matched;
      remaining -= matched;
      if (front.qty <= 0) buys.shift();
    }

    realized.push(realizedRow(tx, openDate, sellQty, costBasis, proceeds));
    t.qty -= sellQty;
    t.cost -= costBasis;
    if (t.qty <= 0) t.cost = 0;
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
