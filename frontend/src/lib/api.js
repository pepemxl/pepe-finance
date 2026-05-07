const BASE = import.meta.env.VITE_API_URL || "/api";

async function get(path) {
  const r = await fetch(`${BASE}${path}`);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

export const api = {
  positions:     () => get("/positions"),
  transactions:  () => get("/transactions"),
  realized:      () => get("/realized"),
  allocation:    () => get("/allocation"),
  performance:   () => get("/performance"),
  taxBreakdown:  () => get("/tax/breakdown"),
  fxRate:        () => get("/fx/usd-mxn"),
};
