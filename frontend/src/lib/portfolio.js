import { api } from "./api.js";
import {
  FX_USD_MXN, POSITIONS_RAW, TRANSACTIONS_RAW, REALIZED, ALLOCATION,
  PERFORMANCE, TAX_BREAKDOWN, enrichPositions, enrichTransactions,
} from "./demoData.js";

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
    return {
      fxRate: rate,
      positions: enrichPositions(positions ?? POSITIONS_RAW, rate),
      transactions: enrichTransactions(transactions ?? TRANSACTIONS_RAW),
      realized: realized ?? REALIZED,
      allocation: allocation ?? ALLOCATION,
      performance: performance ?? PERFORMANCE,
      taxBreakdown: tax ?? TAX_BREAKDOWN,
      isLive: !!(positions && transactions),
    };
  } catch {
    return {
      fxRate: FX_USD_MXN,
      positions: enrichPositions(POSITIONS_RAW),
      transactions: enrichTransactions(TRANSACTIONS_RAW),
      realized: REALIZED,
      allocation: ALLOCATION,
      performance: PERFORMANCE,
      taxBreakdown: TAX_BREAKDOWN,
      isLive: false,
    };
  }
}
