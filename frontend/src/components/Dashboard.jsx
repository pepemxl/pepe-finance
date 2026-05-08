import React from "react";
import { fmtMXN, fmtUSD, fmtPct, fmtNum, fmtDateLong } from "../lib/format.js";

// Each entry maps to a slice of the trailing `performance` array (60 pts ≈ 6 months).
// Ticks are anchored by *fraction* of the slice so labels follow whatever range is active.
const PERF_RANGES = [
  { id: "1D",  points: 2,  ticks: [{ at: 0, label: "−1d" },  { at: 1, label: "now" }] },
  { id: "1W",  points: 3,  ticks: [{ at: 0, label: "−1w" },  { at: 1, label: "now" }] },
  { id: "6M",  points: 60, ticks: [{ at: 0, label: "Nov" }, { at: 12/59, label: "Dec" }, { at: 24/59, label: "Jan" }, { at: 36/59, label: "Feb" }, { at: 48/59, label: "Mar" }, { at: 1, label: "May" }] },
  { id: "1Y",  points: 60, ticks: [{ at: 0, label: "−1Y" }, { at: 0.5, label: "−6M" }, { at: 1, label: "now" }] },
  { id: "YTD", points: 36, ticks: [{ at: 0, label: "Jan" }, { at: 9/35, label: "Feb" }, { at: 18/35, label: "Mar" }, { at: 27/35, label: "Apr" }, { at: 1, label: "May" }] },
  { id: "ALL", points: 60, ticks: [{ at: 0, label: "Nov" }, { at: 12/59, label: "Dec" }, { at: 24/59, label: "Jan" }, { at: 36/59, label: "Feb" }, { at: 48/59, label: "Mar" }, { at: 1, label: "May" }] },
];

function PerformanceChart({ t, performance }) {
  const [rangeId, setRangeId] = React.useState("6M");
  const range = PERF_RANGES.find(r => r.id === rangeId) ?? PERF_RANGES[2];
  const data = React.useMemo(() => {
    const n = Math.min(range.points, performance.length);
    return performance.slice(-Math.max(n, 2));
  }, [performance, range.points]);

  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const W = 800, H = 180, P = { l: 40, r: 12, t: 8, b: 18 };
  const pts = data.map((v, i) => {
    const x = P.l + (i / (data.length - 1)) * (W - P.l - P.r);
    const y = P.t + (1 - (v - min) / span) * (H - P.t - P.b);
    return [x, y];
  });
  const path = pts.map(([x, y], i) => (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1)).join(" ");
  const area = path + ` L${pts[pts.length - 1][0].toFixed(1)} ${H - P.b} L${pts[0][0].toFixed(1)} ${H - P.b} Z`;
  const last = data[data.length - 1];
  const first = data[0];
  const pct = first ? ((last - first) / first) * 100 : 0;

  return (
    <div className="chart-card">
      <div className="chart-head">
        <div className="flex gap-12" style={{ alignItems: "baseline" }}>
          <h2>{t("performance")}</h2>
          <div className="tabs" style={{ marginLeft: 8 }}>
            {PERF_RANGES.map(r => (
              <button
                key={r.id}
                type="button"
                className={r.id === rangeId ? "active" : ""}
                onClick={() => setRangeId(r.id)}
              >
                {r.id}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-12" style={{ alignItems: "baseline" }}>
          <span className="chart-value">{fmtMXN(last)}</span>
          <span className={pct >= 0 ? "cell-pos mono" : "cell-neg mono"} style={{ fontSize: 12 }}>{fmtPct(pct)}</span>
        </div>
      </div>
      <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {[0, 1, 2, 3, 4].map(i => {
          const y = P.t + (i / 4) * (H - P.t - P.b);
          const v = max - (i / 4) * span;
          return (
            <g key={i}>
              <line className="grid" x1={P.l} x2={W - P.r} y1={y} y2={y} />
              <text className="axis-label" x={P.l - 6} y={y + 3} textAnchor="end">{(v / 1000).toFixed(0)}k</text>
            </g>
          );
        })}
        <path className="area-fill" d={area} />
        <path className="area-line" d={path} />
        {range.ticks.map((tk, k) => {
          const x = P.l + tk.at * (W - P.l - P.r);
          return <text key={k} className="axis-label" x={x} y={H - 4} textAnchor="middle">{tk.label}</text>;
        })}
      </svg>
    </div>
  );
}

export function HoldingsTable({ t, locale, currency, setRoute, positions, limit }) {
  const [filter, setFilter] = React.useState("all");
  const filtered = React.useMemo(() => {
    if (filter === "winners") return positions.filter(p => (p.unrealizedMXN ?? 0) > 0);
    if (filter === "losers")  return positions.filter(p => (p.unrealizedMXN ?? 0) < 0);
    return positions;
  }, [positions, filter]);
  const rows = limit ? filtered.slice(0, limit) : filtered;
  const tabs = [
    { id: "all",     label: locale === "es" ? "Todas"      : "All" },
    { id: "winners", label: locale === "es" ? "Ganadoras"  : "Winners" },
    { id: "losers",  label: locale === "es" ? "Perdedoras" : "Losers" },
  ];
  return (
    <div className="table-wrap">
      <div className="table-head">
        <h2>{t("holdings_title")}</h2>
        <div className="table-tools">
          <div className="tabs">
            {tabs.map(tab => (
              <button
                key={tab.id}
                type="button"
                className={filter === tab.id ? "active" : ""}
                onClick={() => setFilter(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button className="btn btn-sm">{t("export_csv")}</button>
        </div>
      </div>
      <table className="data">
        <thead>
          <tr>
            <th>{t("ticker")}</th>
            <th className="num">{t("qty")}</th>
            <th className="num">{t("avg_cost")}</th>
            <th className="num">{t("last")}</th>
            <th className="num">{t("day")}</th>
            <th className="num">{t("market_value")}</th>
            <th className="num">{t("cost_basis")}</th>
            <th className="num">{t("unr_pnl")}</th>
            <th className="num">{t("weight")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={9} className="subtle" style={{ textAlign: "center", padding: "16px" }}>
                {locale === "es" ? "Sin resultados para este filtro." : "No holdings match this filter."}
              </td>
            </tr>
          )}
          {rows.map(p => {
            const fmt = currency === "MXN" ? fmtMXN : fmtUSD;
            const mv  = currency === "MXN" ? p.marketValueMXN : p.marketValueUSD;
            const cb  = currency === "MXN" ? p.costBasisMXN  : p.costBasisUSD;
            const upl = currency === "MXN" ? p.unrealizedMXN : p.unrealizedUSD;
            return (
              <tr key={p.ticker} onClick={() => setRoute("detail:" + p.ticker)}>
                <td className="ticker">{p.ticker}<span className="name">{p.name}</span></td>
                <td className="num">{fmtNum(p.qty, 0)}</td>
                <td className="num">{fmtUSD(p.avgCostUSD)}</td>
                <td className="num">{fmtUSD(p.lastUSD)}</td>
                <td className={"num " + (p.dayPct >= 0 ? "cell-pos" : "cell-neg")}>{fmtPct(p.dayPct)}</td>
                <td className="num">{fmt(mv)}</td>
                <td className="num">{fmt(cb)}</td>
                <td className={"num " + (upl >= 0 ? "cell-pos" : "cell-neg")}>
                  {fmt(upl, { signed: true })} <span className="subtle" style={{ fontSize: 10 }}>({fmtPct(p.unrealizedPct)})</span>
                </td>
                <td className="num">{p.weight.toFixed(1)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RecentTransactions({ t, locale, setRoute, transactions }) {
  const rows = transactions.slice(0, 6);
  return (
    <div className="table-wrap">
      <div className="table-head">
        <h2>{t("recent_tx")}</h2>
        <button className="btn btn-sm" onClick={() => setRoute("transactions")}>
          {locale === "es" ? "Ver todas →" : "View all →"}
        </button>
      </div>
      <table className="data">
        <thead>
          <tr>
            <th>{t("date")}</th><th>{t("type")}</th><th>{t("ticker")}</th>
            <th className="num">{t("qty")}</th><th className="num">{t("price_usd")}</th>
            <th className="num">FX</th><th className="num">{t("fees")}</th>
            <th className="num">{t("total_mxn")}</th><th>{t("broker")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(tx => (
            <tr key={tx.id}>
              <td className="mono">{new Date(tx.date).toLocaleDateString(locale === "es" ? "es-MX" : "en-US", { year: "numeric", month: "short", day: "2-digit" })}</td>
              <td><span className={"chip " + (tx.type === "BUY" ? "chip-buy" : tx.type === "SELL" ? "chip-sell" : "chip-div")}>{tx.type}</span></td>
              <td className="ticker">{tx.ticker}</td>
              <td className="num">{tx.qty}</td>
              <td className="num">{fmtUSD(tx.priceUSD)}</td>
              <td className="num subtle">{tx.fxRate.toFixed(4)}</td>
              <td className="num">{fmtMXN(tx.feesMXN)}</td>
              <td className="num">{fmtMXN(tx.totalMXN)}</td>
              <td className="mono subtle">{tx.broker}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Allocation({ t, locale, allocation }) {
  return (
    <div className="table-wrap">
      <div className="table-head">
        <h2>{t("allocation")}</h2>
        <span className="mono subtle" style={{ fontSize: 11 }}>{locale === "es" ? "por sector" : "by sector"}</span>
      </div>
      <div style={{ padding: "12px 16px" }}>
        {allocation.map(a => (
          <div key={a.sector} style={{ display: "grid", gridTemplateColumns: "140px 1fr 60px 60px", alignItems: "center", gap: 10, padding: "5px 0", fontSize: 12 }}>
            <div>{a.sector}</div>
            <div style={{ background: "var(--bg-chip)", height: 14, position: "relative" }}>
              <div style={{ position: "absolute", inset: 0, width: (a.pct / 35) * 100 + "%", background: "var(--accent)", opacity: .85 }} />
            </div>
            <div className="num mono" style={{ textAlign: "right" }}>{a.pct.toFixed(1)}%</div>
            <div className={"num mono " + (a.ret >= 0 ? "cell-pos" : "cell-neg")} style={{ textAlign: "right" }}>{fmtPct(a.ret, 1)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Treemap({ locale }) {
  const data = [
    { tic: "AAPL", pct:  21.6, cls: "pos-3" },
    { tic: "NVDA", pct:  34.1, cls: "pos-3" },
    { tic: "MSFT", pct:  12.4, cls: "pos-2" },
    { tic: "META", pct:   8.6, cls: "pos-1" },
    { tic: "TSLA", pct: -22.6, cls: "neg-3" },
    { tic: "AMZN", pct:  -3.2, cls: "neg-1" },
  ];
  return (
    <div className="table-wrap">
      <div className="table-head">
        <h2>{locale === "es" ? "Mapa de calor" : "Heatmap"}</h2>
        <span className="mono subtle" style={{ fontSize: 11 }}>{locale === "es" ? "rendimiento total" : "total return"}</span>
      </div>
      <div className="treemap">
        {data.map(d => (
          <div key={d.tic} className={"tile " + d.cls}>
            <div className="t-tic">{d.tic}</div>
            <div className="t-pct">{fmtPct(d.pct)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Dashboard({ t, locale, currency, setRoute, positions, transactions, realized, allocation, performance, taxBreakdown, fxRate }) {
  const totalMV = positions.reduce((a, p) => a + p.marketValueMXN, 0);
  const totalCost = positions.reduce((a, p) => a + p.costBasisMXN, 0);
  const upnl = totalMV - totalCost;
  const upnlPct = (upnl / totalCost) * 100;
  const realizedYTD = realized.reduce((a, r) => a + r.gainMXN, 0);
  const day = positions.reduce((a, p) => a + p.marketValueMXN * (p.dayPct / 100), 0);
  const dayPct = (day / totalMV) * 100;
  const tax = Math.max(0, realizedYTD) * taxBreakdown.rateApplied;
  const fmt = currency === "MXN" ? fmtMXN : (v) => fmtUSD(v / fxRate);

  return (
    <main className="main">
      <div className="page-head">
        <div>
          <h1>{t("dashboard")}</h1>
          <div className="sub">
            {locale === "es" ? "Vista general · " : "Overview · "}
            {fmtDateLong(new Date().toISOString(), locale)}
          </div>
        </div>
        <div className="actions">
          <button className="btn btn-sm" onClick={() => setRoute("import")}>↑ {t("import")}</button>
          <button className="btn btn-sm" onClick={() => setRoute("sell")}>− {t("new_sale")}</button>
          <button className="btn btn-primary btn-sm" onClick={() => setRoute("buy")}>+ {t("new_purchase")}</button>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi">
          <div className="label">{t("portfolio_value")}</div>
          <div className="value">{fmt(totalMV)}</div>
          <div className="sub">
            <span className={dayPct >= 0 ? "delta-pos" : "delta-neg"}>{fmtPct(dayPct)}</span>
            <span>{locale === "es" ? "hoy" : "today"}</span>
          </div>
        </div>
        <div className="kpi">
          <div className="label">{t("total_invested")}</div>
          <div className="value">{fmt(totalCost)}</div>
          <div className="sub"><span>{locale === "es" ? "base de costo" : "cost basis"}</span></div>
        </div>
        <div className="kpi">
          <div className="label">{t("unrealized_pnl")}</div>
          <div className="value" style={{ color: upnl >= 0 ? "var(--pos)" : "var(--neg)" }}>{fmt(upnl)}</div>
          <div className="sub"><span className={upnl >= 0 ? "delta-pos" : "delta-neg"}>{fmtPct(upnlPct)}</span></div>
        </div>
        <div className="kpi">
          <div className="label">{t("realized_ytd")}</div>
          <div className="value" style={{ color: realizedYTD >= 0 ? "var(--pos)" : "var(--neg)" }}>{fmt(realizedYTD)}</div>
          <div className="sub"><span>{realized.length} {locale === "es" ? "cierres" : "closes"}</span></div>
        </div>
        <div className="kpi">
          <div className="label">{t("tax_estimated")} 2026</div>
          <div className="value" style={{ color: "var(--warn)" }}>{fmt(tax)}</div>
          <div className="sub">
            <span>{(taxBreakdown.rateApplied * 100).toFixed(0)}% ISR PF</span>
            <a onClick={() => setRoute("taxes")} style={{ color: "var(--accent)", cursor: "pointer" }}>
              {locale === "es" ? "ver detalle →" : "details →"}
            </a>
          </div>
        </div>
      </div>

      <PerformanceChart t={t} performance={performance} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 1, background: "var(--border)" }}>
        <HoldingsTable t={t} locale={locale} currency={currency} setRoute={setRoute} positions={positions} />
        <Treemap locale={locale} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 1, background: "var(--border)" }}>
        <RecentTransactions t={t} locale={locale} setRoute={setRoute} transactions={transactions} />
        <Allocation t={t} locale={locale} allocation={allocation} />
      </div>
    </main>
  );
}
