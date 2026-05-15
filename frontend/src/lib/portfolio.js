import { api } from "./api.js";
import {
  FX_USD_MXN, POSITIONS_RAW, TRANSACTIONS_RAW, ALLOCATION,
  PERFORMANCE, TAX_BREAKDOWN, enrichPositions, enrichTransactions,
} from "./demoData.js";
import { computeRealizedLots, computeTaxBreakdown } from "./fifo.js";

export async function loadPortfolio() {
  try {
    const [fx, positions, transactions, realized, allocation, performance, tax] = await Promise.all([
      api.fxRate().catch(() => ({ rate: FX_USD_MXN })),
      api.positions().catch(() => null),
      api.transactions().catch(() => null),
      api.realized().catch(() => null),
      api.allocation().catch(() => null),
      api.performance().catch(() => null),
      api.taxBreakdown().catch(() => null),
    ]);
    const rate = fx?.rate ?? FX_USD_MXN;
    const txs = enrichTransactions(transactions ?? TRANSACTIONS_RAW);
    // Offline: derive realized lots & tax breakdown from the ledger via FIFO,
    // mirroring what the backend does in live mode.
    const realizedLots = realized ?? computeRealizedLots(txs);
    return {
      fxRate: rate,
      positions: enrichPositions(positions ?? POSITIONS_RAW, rate),
      transactions: txs,
      realized: realizedLots,
      allocation: allocation ?? ALLOCATION,
      performance: performance ?? PERFORMANCE,
      taxBreakdown: tax ?? computeTaxBreakdown(realizedLots, TAX_BREAKDOWN.year, TAX_BREAKDOWN),
      isLive: !!(positions && transactions),
    };
  } catch {
    const txs = enrichTransactions(TRANSACTIONS_RAW);
    const realizedLots = computeRealizedLots(txs);
    return {
      fxRate: FX_USD_MXN,
      positions: enrichPositions(POSITIONS_RAW),
      transactions: txs,
      realized: realizedLots,
      allocation: ALLOCATION,
      performance: PERFORMANCE,
      taxBreakdown: computeTaxBreakdown(realizedLots, TAX_BREAKDOWN.year, TAX_BREAKDOWN),
      isLive: false,
    };
  }
}
