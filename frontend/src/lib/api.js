const BASE = import.meta.env.VITE_API_URL || "/api";

async function get(path) {
  const r = await fetch(`${BASE}${path}`);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

async function post(path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    let detail = `${r.status} ${r.statusText}`;
    try { detail = (await r.json())?.detail ?? detail; } catch {}
    throw new Error(detail);
  }
  return r.json();
}

export const api = {
  positions:         () => get("/positions"),
  transactions:      () => get("/transactions"),
  realized:          () => get("/realized"),
  allocation:        () => get("/allocation"),
  performance:       () => get("/performance"),
  taxBreakdown:      (year) => get(year != null ? `/tax/breakdown?year=${year}` : "/tax/breakdown"),
  fxRate:            () => get("/fx/usd-mxn"),
  createTransaction: (payload) => post("/transactions", payload),
};
