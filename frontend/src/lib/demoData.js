/* Fallback demo dataset used until the backend is reachable. */

export const FX_USD_MXN = 17.42;

export const POSITIONS_RAW = [
  { ticker: "AAPL",   name: "Apple Inc.",                  sector: "Technology",     exchange: "NASDAQ",   isin: "US0378331005", qty: 45,  avgCostUSD: 168.40, lastUSD: 214.32, dayPct:  1.24, weight: 18.4 },
  { ticker: "MSFT",   name: "Microsoft Corp.",             sector: "Technology",     exchange: "NASDAQ",   isin: "US5949181045", qty: 22,  avgCostUSD: 312.10, lastUSD: 438.90, dayPct:  0.62, weight: 16.1 },
  { ticker: "NVDA",   name: "NVIDIA Corp.",                sector: "Semiconductors", exchange: "NASDAQ",   isin: "US67066G1040", qty: 18,  avgCostUSD: 412.80, lastUSD: 952.40, dayPct:  3.41, weight: 15.8 },
  { ticker: "AMZN",   name: "Amazon.com Inc.",             sector: "Consumer Disc.", exchange: "NASDAQ",   isin: "US0231351067", qty: 30,  avgCostUSD: 142.50, lastUSD: 198.70, dayPct: -0.42, weight: 11.2 },
  { ticker: "TSLA",   name: "Tesla Inc.",                  sector: "Automotive",     exchange: "NASDAQ",   isin: "US88160R1014", qty: 25,  avgCostUSD: 248.30, lastUSD: 192.10, dayPct: -2.14, weight:  8.9 },
  { ticker: "WALMEX", name: "Walmart de México",           sector: "Consumer Stap.", exchange: "BMV",      isin: "MXP4948K1056", qty: 200, avgCostUSD:  3.84, lastUSD:  4.21, dayPct:  0.18, weight:  6.4 },
  { ticker: "GFNORTE",name: "Grupo Financiero Banorte",    sector: "Financials",     exchange: "BMV",      isin: "MXP370711014", qty: 150, avgCostUSD:  9.10, lastUSD:  8.62, dayPct: -0.84, weight:  6.0 },
  { ticker: "META",   name: "Meta Platforms",              sector: "Communication",  exchange: "NASDAQ",   isin: "US30303M1027", qty: 12,  avgCostUSD: 298.20, lastUSD: 512.40, dayPct:  0.94, weight:  6.7 },
  { ticker: "GOOGL",  name: "Alphabet Inc. Class A",       sector: "Communication",  exchange: "NASDAQ",   isin: "US02079K3059", qty: 20,  avgCostUSD: 132.40, lastUSD: 168.20, dayPct: -0.12, weight:  5.4 },
  { ticker: "VOO",    name: "Vanguard S&P 500 ETF",        sector: "ETF",            exchange: "NYSEARCA", isin: "US9229083632", qty: 14,  avgCostUSD: 412.30, lastUSD: 521.80, dayPct:  0.31, weight:  5.1 },
];

export function enrichPositions(rows, fx = FX_USD_MXN) {
  return rows.map(p => {
    const costBasisUSD = p.qty * p.avgCostUSD;
    const marketValueUSD = p.qty * p.lastUSD;
    const unrealizedUSD = marketValueUSD - costBasisUSD;
    return {
      ...p,
      costBasisUSD, marketValueUSD, unrealizedUSD,
      unrealizedPct: (unrealizedUSD / costBasisUSD) * 100,
      costBasisMXN: costBasisUSD * fx,
      marketValueMXN: marketValueUSD * fx,
      unrealizedMXN: unrealizedUSD * fx,
    };
  });
}

export const TRANSACTIONS_RAW = [
  { id: "TX-2840", date: "2026-05-04", type: "BUY",  ticker: "NVDA",    qty: 5,   priceUSD:  942.30, fxRate: 17.42, feesMXN: 184.20, broker: "GBM+",    notes: "DCA mensual" },
  { id: "TX-2839", date: "2026-05-02", type: "DIV",  ticker: "AAPL",    qty: 45,  priceUSD:    0.24, fxRate: 17.40, feesMXN:   0.00, broker: "GBM+",    notes: "Dividendo Q2" },
  { id: "TX-2838", date: "2026-04-28", type: "SELL", ticker: "TSLA",    qty: 10,  priceUSD:  204.50, fxRate: 17.38, feesMXN: 156.40, broker: "Kuspit",  notes: "Toma parcial" },
  { id: "TX-2837", date: "2026-04-22", type: "BUY",  ticker: "VOO",     qty: 4,   priceUSD:  514.20, fxRate: 17.51, feesMXN: 152.30, broker: "GBM+",    notes: "" },
  { id: "TX-2836", date: "2026-04-15", type: "BUY",  ticker: "WALMEX",  qty: 100, priceUSD:    4.18, fxRate: 17.62, feesMXN:  84.10, broker: "Banorte", notes: "" },
  { id: "TX-2835", date: "2026-04-10", type: "SELL", ticker: "META",    qty:  3,  priceUSD:  498.80, fxRate: 17.55, feesMXN:  98.40, broker: "GBM+",    notes: "Rebalanceo" },
  { id: "TX-2834", date: "2026-04-03", type: "BUY",  ticker: "MSFT",    qty:  6,  priceUSD:  421.40, fxRate: 17.21, feesMXN: 142.80, broker: "GBM+",    notes: "" },
  { id: "TX-2833", date: "2026-03-28", type: "BUY",  ticker: "GOOGL",   qty:  8,  priceUSD:  158.90, fxRate: 16.98, feesMXN:  96.20, broker: "Kuspit",  notes: "" },
  { id: "TX-2832", date: "2026-03-21", type: "BUY",  ticker: "AMZN",    qty: 10,  priceUSD:  184.30, fxRate: 16.84, feesMXN: 124.50, broker: "GBM+",    notes: "DCA mensual" },
  { id: "TX-2831", date: "2026-03-15", type: "SELL", ticker: "AAPL",    qty:  5,  priceUSD:  208.40, fxRate: 16.91, feesMXN:  84.20, broker: "GBM+",    notes: "" },
  { id: "TX-2830", date: "2026-03-08", type: "BUY",  ticker: "GFNORTE", qty: 50,  priceUSD:    8.94, fxRate: 16.72, feesMXN:  64.10, broker: "Banorte", notes: "" },
  { id: "TX-2829", date: "2026-02-28", type: "BUY",  ticker: "NVDA",    qty:  3,  priceUSD:  788.40, fxRate: 17.04, feesMXN: 132.40, broker: "GBM+",    notes: "" },
  { id: "TX-2828", date: "2026-02-12", type: "SELL", ticker: "AMZN",    qty:  4,  priceUSD:  178.20, fxRate: 17.18, feesMXN:  72.80, broker: "GBM+",    notes: "" },
  { id: "TX-2827", date: "2026-01-22", type: "BUY",  ticker: "TSLA",    qty: 10,  priceUSD:  221.40, fxRate: 17.45, feesMXN: 162.40, broker: "Kuspit",  notes: "" },
  { id: "TX-2826", date: "2026-01-08", type: "BUY",  ticker: "MSFT",    qty:  4,  priceUSD:  398.60, fxRate: 17.62, feesMXN: 124.20, broker: "GBM+",    notes: "Inicio de año" },
  // Historical mock data 2020–2025 (multi-year tax-report testing)
  { id: "TX-2777", date: "2025-07-08", type: "SELL", ticker: "AMZN",    qty: 12,  priceUSD:  150.00, fxRate: 17.40, feesMXN:  90.83, broker: "GBM+",    notes: "Cierre posición 2022" },
  { id: "TX-2776", date: "2025-06-12", type: "BUY",  ticker: "NVDA",    qty:  4,  priceUSD:  720.00, fxRate: 17.25, feesMXN: 144.07, broker: "GBM+",    notes: "" },
  { id: "TX-2775", date: "2025-01-20", type: "BUY",  ticker: "AAPL",    qty: 15,  priceUSD:  185.00, fxRate: 17.80, feesMXN: 143.25, broker: "GBM+",    notes: "Inicio de año" },
  { id: "TX-2772", date: "2024-10-22", type: "SELL", ticker: "GOOGL",   qty:  5,  priceUSD:  168.00, fxRate: 17.30, feesMXN:  42.14, broker: "Kuspit",  notes: "Cierre posición 2022" },
  { id: "TX-2771", date: "2024-09-18", type: "BUY",  ticker: "WALMEX",  qty: 120, priceUSD:    3.90, fxRate: 18.00, feesMXN:  24.43, broker: "Banorte", notes: "" },
  { id: "TX-2770", date: "2024-04-05", type: "BUY",  ticker: "GFNORTE", qty: 80,  priceUSD:    8.20, fxRate: 17.10, feesMXN:  32.53, broker: "Banorte", notes: "" },
  { id: "TX-2767", date: "2023-11-10", type: "SELL", ticker: "TSLA",    qty:  4,  priceUSD:  240.00, fxRate: 17.60, feesMXN:  49.00, broker: "Kuspit",  notes: "Cierre con pérdida" },
  { id: "TX-2766", date: "2023-08-30", type: "BUY",  ticker: "VOO",     qty:  3,  priceUSD:  410.00, fxRate: 17.40, feesMXN:  62.07, broker: "GBM+",    notes: "" },
  { id: "TX-2765", date: "2023-02-14", type: "BUY",  ticker: "META",    qty:  7,  priceUSD:  175.00, fxRate: 18.60, feesMXN:  66.08, broker: "GBM+",    notes: "" },
  { id: "TX-2762", date: "2022-12-05", type: "SELL", ticker: "NVDA",    qty:  6,  priceUSD:  165.00, fxRate: 19.50, feesMXN:  55.98, broker: "Kuspit",  notes: "Cierre posición 2021" },
  { id: "TX-2761", date: "2022-06-21", type: "BUY",  ticker: "AMZN",    qty: 12,  priceUSD:  110.00, fxRate: 20.10, feesMXN:  76.94, broker: "GBM+",    notes: "DCA mensual" },
  { id: "TX-2760", date: "2022-03-08", type: "BUY",  ticker: "GOOGL",   qty:  5,  priceUSD:  135.00, fxRate: 20.80, feesMXN:  40.72, broker: "Kuspit",  notes: "" },
  { id: "TX-2757", date: "2021-09-28", type: "SELL", ticker: "MSFT",    qty:  8,  priceUSD:  285.00, fxRate: 20.20, feesMXN: 133.56, broker: "GBM+",    notes: "Cierre posición 2020" },
  { id: "TX-2756", date: "2021-05-03", type: "BUY",  ticker: "TSLA",    qty:  4,  priceUSD:  220.00, fxRate: 20.30, feesMXN:  51.81, broker: "Kuspit",  notes: "" },
  { id: "TX-2755", date: "2021-01-12", type: "BUY",  ticker: "NVDA",    qty:  6,  priceUSD:  130.00, fxRate: 20.00, feesMXN:  45.24, broker: "Kuspit",  notes: "" },
  { id: "TX-2752", date: "2020-11-20", type: "SELL", ticker: "AAPL",    qty:  5,  priceUSD:  118.00, fxRate: 20.10, feesMXN:  34.39, broker: "GBM+",    notes: "Toma parcial" },
  { id: "TX-2751", date: "2020-07-15", type: "BUY",  ticker: "MSFT",    qty:  8,  priceUSD:  210.00, fxRate: 21.50, feesMXN: 104.75, broker: "GBM+",    notes: "" },
  { id: "TX-2750", date: "2020-02-10", type: "BUY",  ticker: "AAPL",    qty: 10,  priceUSD:   78.50, fxRate: 19.10, feesMXN:  43.48, broker: "GBM+",    notes: "Apertura 2020" },
];

export function enrichTransactions(rows) {
  return rows.map(t => {
    const grossUSD = t.qty * t.priceUSD;
    const grossMXN = grossUSD * t.fxRate;
    const totalMXN = t.type === "BUY" ? grossMXN + t.feesMXN : grossMXN - t.feesMXN;
    return { ...t, grossUSD, grossMXN, totalMXN };
  });
}

// realized_lots is a DERIVED dataset — computeRealizedLots() in fifo.js rebuilds
// it from TRANSACTIONS_RAW via FIFO matching, mirroring the backend. No static
// REALIZED array on purpose.

export const ALLOCATION = [
  { sector: "Technology",     pct: 34.5, ret:  12.4 },
  { sector: "Semiconductors", pct: 15.8, ret:  24.1 },
  { sector: "Communication",  pct: 12.1, ret:   6.2 },
  { sector: "Consumer Disc.", pct: 11.2, ret:  -1.8 },
  { sector: "Automotive",     pct:  8.9, ret: -10.4 },
  { sector: "Financials",     pct:  6.0, ret:  -2.1 },
  { sector: "Consumer Stap.", pct:  6.4, ret:   3.2 },
  { sector: "ETF",            pct:  5.1, ret:   5.4 },
];

export const PERFORMANCE = (() => {
  const points = 60;
  const start = 1_240_000;
  const out = [];
  for (let i = 0; i < points; i++) {
    const drift = 4200 * Math.sin(i / 6) + i * 800;
    const noise = (Math.random() - 0.5) * 8000;
    out.push(Math.round(start + drift + noise));
  }
  out[points - 1] = 1_524_318;
  return out;
})();

export const TAX_BREAKDOWN = {
  year: 2026,
  rateApplied: 0.30,
  shortTermGain: 9930.80 + 2059.50,
  longTermGain:  5792.40,
  shortTermLoss: 0,
  longTermLoss:  6288.10,
  carryForward: -2840.50,
};
