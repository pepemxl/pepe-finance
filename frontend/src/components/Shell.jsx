import React, { useEffect, useState } from "react";
import { fmtMXN, fmtPct } from "../lib/format.js";

export function TopBar({ locale, setLocale, theme, setTheme, currency, setCurrency, fxRate }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const time = now.toLocaleTimeString(locale === "es" ? "es-MX" : "en-US", { hour12: false });

  return (
    <div className="topbar">
      <div className="brand">
        <div className="brand-mark">F</div>
        <div>FinanceStocks</div>
        <span className="mono subtle" style={{ fontSize: 10, marginLeft: 4 }}>v0.1</span>
      </div>
      <div className="global-search">
        <input placeholder={locale === "es" ? "Buscar ticker, transacción, ISIN…" : "Search ticker, transaction, ISIN…"} />
      </div>
      <div className="topbar-spacer" />
      <div className="live-clock"><span className="dot" />MX • {time} • USD/MXN {fxRate.toFixed(4)}</div>
      <div className="toggle-group" title="Currency">
        <button className={currency === "MXN" ? "active" : ""} onClick={() => setCurrency("MXN")}>MXN</button>
        <button className={currency === "USD" ? "active" : ""} onClick={() => setCurrency("USD")}>USD</button>
      </div>
      <div className="toggle-group" title="Language">
        <button className={locale === "es" ? "active" : ""} onClick={() => setLocale("es")}>ES</button>
        <button className={locale === "en" ? "active" : ""} onClick={() => setLocale("en")}>EN</button>
      </div>
      <div className="toggle-group" title="Theme">
        <button className={theme === "light" ? "active" : ""} onClick={() => setTheme("light")}>☀</button>
        <button className={theme === "dark" ? "active" : ""} onClick={() => setTheme("dark")}>☾</button>
      </div>
    </div>
  );
}

export function Sidebar({ route, setRoute, t, locale, positions, transactions, fxRate }) {
  const items = [
    { id: "dashboard",    glyph: "▦", label: t("dashboard") },
    { id: "holdings",     glyph: "▤", label: t("holdings"),     count: positions.length },
    { id: "transactions", glyph: "≡", label: t("transactions"), count: transactions.length },
    { id: "buy",          glyph: "+", label: t("buy") },
    { id: "sell",         glyph: "−", label: t("sell") },
    { id: "taxes",        glyph: "%", label: t("taxes") },
    { id: "import",       glyph: "↑", label: t("import") },
  ];
  const watch = positions.slice(0, 5);

  return (
    <aside className="sidebar">
      <div className="nav-section">
        <div className="nav-label">{locale === "es" ? "Principal" : "Main"}</div>
        {items.map(it => (
          <div key={it.id}
               className={"nav-item" + (route.startsWith(it.id) ? " active" : "")}
               onClick={() => setRoute(it.id)}>
            <span className="glyph">{it.glyph}</span>
            <span>{it.label}</span>
            {it.count != null && <span className="count">{it.count}</span>}
          </div>
        ))}
      </div>
      <div className="nav-section">
        <div className="nav-label">Watchlist</div>
        {watch.map(p => (
          <div key={p.ticker}
               className={"nav-item" + (route === "detail:" + p.ticker ? " active" : "")}
               onClick={() => setRoute("detail:" + p.ticker)}>
            <span className="glyph mono">{p.ticker.slice(0, 4)}</span>
            <span className={p.dayPct >= 0 ? "cell-pos" : "cell-neg"} style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
              {fmtPct(p.dayPct)}
            </span>
          </div>
        ))}
      </div>
      <div className="sidebar-footer">
        <div className="row"><span>USD/MXN</span><span>{fxRate.toFixed(4)}</span></div>
        <div className="row"><span>{locale === "es" ? "Sesión" : "Session"}</span><span style={{ color: "var(--pos)" }}>OPEN</span></div>
        <div className="row"><span>{locale === "es" ? "Conexión" : "Conn."}</span><span>● live</span></div>
      </div>
    </aside>
  );
}

export function StatusBar({ locale, positions, transactions }) {
  const totalMV = positions.reduce((a, p) => a + p.marketValueMXN, 0);
  const totalCost = positions.reduce((a, p) => a + p.costBasisMXN, 0);
  const upnl = totalMV - totalCost;
  const upnlPct = (upnl / totalCost) * 100;
  const day = positions.reduce((a, p) => a + p.marketValueMXN * (p.dayPct / 100), 0);

  return (
    <div className="statusbar">
      <div className="seg"><span className="lbl">NAV</span><span className="val mono">{fmtMXN(totalMV)}</span></div>
      <div className={"seg " + (upnl >= 0 ? "pos" : "neg")}>
        <span className="lbl">UPL</span>
        <span className="val mono">{fmtMXN(upnl, { signed: true })} ({fmtPct(upnlPct)})</span>
      </div>
      <div className={"seg " + (day >= 0 ? "pos" : "neg")}>
        <span className="lbl">DAY</span>
        <span className="val mono">{fmtMXN(day, { signed: true })}</span>
      </div>
      <div className="seg"><span className="lbl">POS</span><span className="val mono">{positions.length}</span></div>
      <div className="seg"><span className="lbl">TX</span><span className="val mono">{transactions.length}</span></div>
      <div className="spacer" />
      <div className="seg"><span className="lbl">{locale === "es" ? "Última act." : "Last sync"}</span><span className="val">2026-05-06 14:22:08 CDT</span></div>
      <div className="seg"><span className="lbl">© FS</span><span className="val">2026</span></div>
    </div>
  );
}
