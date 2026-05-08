import React, { useEffect, useState } from "react";
import { fmtMXN, fmtUSD, fmtPct, fmtDate } from "../lib/format.js";
import { api } from "../lib/api.js";

function csvField(v) {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadBlob(filename, text, mime = "text/csv;charset=utf-8;") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function printHtmlInPopup(title, body) {
  const w = window.open("", "_blank", "width=900,height=720");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
  body { font: 12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; color: #111; padding: 24px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 14px; margin: 24px 0 8px; }
  .sub { color: #555; font-size: 11px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 6px 8px; border-bottom: 1px solid #e5e5e5; text-align: left; }
  th.num, td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .pos { color: #0a7d3a; }
  .neg { color: #b21f24; }
  .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 12px 0 16px; }
  .summary .cell { border: 1px solid #ddd; padding: 8px; }
  .summary .lbl { font-size: 10px; color: #555; text-transform: uppercase; letter-spacing: .08em; }
  .summary .val { font-size: 16px; font-weight: 600; margin-top: 4px; }
  @media print { @page { margin: 16mm; } }
</style></head><body>${body}</body></html>`);
  w.document.close();
  w.onload = () => { w.focus(); w.print(); };
}

const BUY_BROKERS = [
  { code: "GBM",  name: "GBM+" },
  { code: "KUS",  name: "Kuspit" },
  { code: "BNT",  name: "Banorte Casa de Bolsa" },
  { code: "ACT",  name: "Actinver" },
  { code: "IBKR", name: "Interactive Brokers" },
];

const BUY_DEFAULTS = {
  qty: 10, price: 214.32, comm: 0.0025, iva: 0.16,
  ticker: "AAPL", date: "2026-05-06",
  brokerCode: "GBM", account: "PERSONAL-001", notes: "",
};

function nextExternalId(transactions) {
  let max = 0;
  for (const tx of transactions ?? []) {
    const m = typeof tx.id === "string" && tx.id.match(/^TX-(\d+)$/);
    if (m) max = Math.max(max, +m[1]);
  }
  return `TX-${max + 1}`;
}

export function BuyForm({ t, locale, setRoute, fxRate, transactions, addTransaction }) {
  const [qty, setQty] = useState(BUY_DEFAULTS.qty);
  const [price, setPrice] = useState(BUY_DEFAULTS.price);
  const [fx, setFx] = useState(fxRate);
  const [comm, setComm] = useState(BUY_DEFAULTS.comm);
  const [iva, setIva] = useState(BUY_DEFAULTS.iva);
  const [ticker, setTicker] = useState(BUY_DEFAULTS.ticker);
  const [date, setDate] = useState(BUY_DEFAULTS.date);
  const [brokerCode, setBrokerCode] = useState(BUY_DEFAULTS.brokerCode);
  const [account, setAccount] = useState(BUY_DEFAULTS.account);
  const [notes, setNotes] = useState(BUY_DEFAULTS.notes);
  const [status, setStatus] = useState({ kind: "idle" });

  const grossUSD = qty * price;
  const grossMXN = grossUSD * fx;
  const commMXN = grossMXN * comm;
  const ivaMXN = commMXN * iva;
  const totalMXN = grossMXN + commMXN + ivaMXN;

  const resetForm = () => {
    setQty(BUY_DEFAULTS.qty);
    setPrice(BUY_DEFAULTS.price);
    setFx(fxRate);
    setComm(BUY_DEFAULTS.comm);
    setIva(BUY_DEFAULTS.iva);
    setTicker(BUY_DEFAULTS.ticker);
    setDate(BUY_DEFAULTS.date);
    setBrokerCode(BUY_DEFAULTS.brokerCode);
    setAccount(BUY_DEFAULTS.account);
    setNotes("");
  };

  const validate = () => {
    if (!ticker.trim()) return locale === "es" ? "Falta el ticker." : "Ticker is required.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return locale === "es" ? "Fecha inválida (YYYY-MM-DD)." : "Invalid date (YYYY-MM-DD).";
    if (!(qty > 0)) return locale === "es" ? "Cantidad debe ser > 0." : "Quantity must be > 0.";
    if (!(price > 0)) return locale === "es" ? "Precio debe ser > 0." : "Price must be > 0.";
    if (!(fx > 0)) return locale === "es" ? "FX debe ser > 0." : "FX rate must be > 0.";
    return null;
  };

  const handleSave = async (stayOnForm) => {
    const err = validate();
    if (err) {
      setStatus({ kind: "error", msg: err });
      return;
    }
    const payload = {
      external_id: nextExternalId(transactions),
      trade_date: date,
      type: "BUY",
      ticker: ticker.trim().toUpperCase(),
      qty: Number(qty),
      price_usd: Number(price),
      fx_rate: Number(fx),
      commission_pct: Number(comm),
      iva_pct: Number(iva),
      fees_mxn: Number((commMXN + ivaMXN).toFixed(2)),
      broker_code: brokerCode,
      account_number: account.trim() || null,
      notes: notes.trim() || null,
    };

    setStatus({ kind: "saving" });
    try {
      await addTransaction(payload);
      setStatus({ kind: "saved", id: payload.external_id });
      if (stayOnForm) {
        resetForm();
      } else {
        setRoute("transactions");
      }
    } catch (e) {
      setStatus({ kind: "error", msg: e.message ?? String(e) });
    }
  };

  return (
    <main className="main">
      <div className="page-head">
        <div>
          <h1>{t("new_purchase")}</h1>
          <div className="sub">{locale === "es" ? "Registrar adquisición de acciones" : "Record a stock acquisition"}</div>
        </div>
        <div className="actions">
          <button className="btn btn-sm" onClick={() => setRoute("dashboard")} disabled={status.kind === "saving"}>{t("cancel")}</button>
          <button className="btn btn-sm" onClick={() => handleSave(true)} disabled={status.kind === "saving"}>{t("save_and_new")}</button>
          <button className="btn btn-primary btn-sm" onClick={() => handleSave(false)} disabled={status.kind === "saving"}>
            {status.kind === "saving" ? (locale === "es" ? "Guardando…" : "Saving…") : t("save")}
          </button>
        </div>
      </div>

      {status.kind === "error" && (
        <div className="form-status error" role="alert" style={{ margin: "8px 16px", padding: "8px 12px", background: "var(--bg-chip)", color: "var(--neg)", border: "1px solid var(--neg)", borderRadius: 4, fontSize: 13 }}>
          {status.msg}
        </div>
      )}
      {status.kind === "saved" && (
        <div className="form-status saved" style={{ margin: "8px 16px", padding: "8px 12px", background: "var(--bg-chip)", color: "var(--pos)", border: "1px solid var(--pos)", borderRadius: 4, fontSize: 13 }}>
          {locale === "es" ? `Guardado: ${status.id}` : `Saved: ${status.id}`}
        </div>
      )}

      <div className="form-wrap">
        <div className="form-main">
          <div className="form-section">
            <h3>{locale === "es" ? "Información básica" : "Basic info"}</h3>
            <div className="form-row"><label>{t("transaction_type")}</label>
              <div className="tabs" style={{ width: "fit-content" }}>
                <button className="active" style={{ padding: "5px 16px" }}>{t("purchase")}</button>
                <button style={{ padding: "5px 16px" }} onClick={() => setRoute("sell")}>{t("sale")}</button>
                <button style={{ padding: "5px 16px" }} onClick={() => setRoute("dividend")}>{t("dividend")}</button>
              </div>
            </div>
            <div className="form-row"><label>{t("date")}</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                <input value={date.split("-")[0]} onChange={e => setDate(e.target.value + "-" + date.split("-")[1] + "-" + date.split("-")[2])} placeholder={locale === "es" ? "Año" : "Year"} />
                <input value={date.split("-")[1]} onChange={e => setDate(date.split("-")[0] + "-" + e.target.value + "-" + date.split("-")[2])} placeholder={locale === "es" ? "Mes" : "Month"} />
                <input value={date.split("-")[2]} onChange={e => setDate(date.split("-")[0] + "-" + date.split("-")[1] + "-" + e.target.value)} placeholder={locale === "es" ? "Día" : "Day"} />
              </div>
            </div>
            <div className="form-row"><label>{t("instrument")}</label>
              <input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())} placeholder="AAPL · NASDAQ · US0378331005" />
            </div>
            <div className="form-row"><label>{t("broker")}</label>
              <select value={brokerCode} onChange={e => setBrokerCode(e.target.value)}>
                {BUY_BROKERS.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
              </select>
            </div>
            <div className="form-row"><label>{t("account")}</label>
              <input value={account} onChange={e => setAccount(e.target.value)} />
            </div>
          </div>

          <div className="form-section">
            <h3>{locale === "es" ? "Precio y cantidad" : "Price & quantity"}</h3>
            <div className="form-row"><label>{t("quantity")}</label><input type="number" value={qty} onChange={e => setQty(+e.target.value)} /></div>
            <div className="form-row"><label>{t("unit_price")}</label>
              <div className="input-suffix"><input type="number" step="0.01" value={price} onChange={e => setPrice(+e.target.value)} /><span className="suffix">USD</span></div>
            </div>
            <div className="form-row"><label>{t("fx_rate")}</label>
              <div className="input-suffix"><input type="number" step="0.0001" value={fx} onChange={e => setFx(+e.target.value)} /><span className="suffix">MXN/USD</span></div>
            </div>
          </div>

          <div className="form-section">
            <h3>{locale === "es" ? "Comisiones" : "Fees"}</h3>
            <div className="form-row"><label>{t("commission")}</label>
              <div className="input-suffix"><input type="number" step="0.0001" value={comm} onChange={e => setComm(+e.target.value)} /><span className="suffix">%</span></div>
            </div>
            <div className="form-row"><label>{t("iva_commission")}</label>
              <div className="input-suffix"><input type="number" step="0.01" value={iva} onChange={e => setIva(+e.target.value)} /><span className="suffix">%</span></div>
            </div>
            <div className="form-row"><label>{t("notes")}</label><textarea rows="2" value={notes} onChange={e => setNotes(e.target.value)} placeholder={locale === "es" ? "Estrategia DCA mensual…" : "Monthly DCA strategy…"} /></div>
          </div>
        </div>

        <div className="form-side">
          <div className="calc-card">
            <h4>{t("cost_breakdown")}</h4>
            <div className="calc-row"><span className="lbl">{t("gross_amount")} (USD)</span><span>{fmtUSD(grossUSD)}</span></div>
            <div className="calc-row subtle"><span className="lbl">× FX</span><span>{fx.toFixed(4)}</span></div>
            <div className="calc-row"><span className="lbl">{t("gross_amount")} (MXN)</span><span>{fmtMXN(grossMXN)}</span></div>
            <div className="calc-row"><span className="lbl">{t("commission")}</span><span>{fmtMXN(commMXN)}</span></div>
            <div className="calc-row"><span className="lbl">{t("iva_commission")}</span><span>{fmtMXN(ivaMXN)}</span></div>
            <div className="calc-row total"><span className="lbl">{t("total_mxn")}</span><span>{fmtMXN(totalMXN)}</span></div>
          </div>

          <div className="calc-card">
            <h4>{locale === "es" ? "Impacto en posición" : "Position impact"}</h4>
            <div className="calc-row"><span className="lbl">{locale === "es" ? "Tenencia previa" : "Previous qty"}</span><span>45</span></div>
            <div className="calc-row"><span className="lbl">{locale === "es" ? "Nueva tenencia" : "New qty"}</span><span style={{ color: "var(--pos)" }}>{45 + qty}</span></div>
            <div className="calc-row"><span className="lbl">{locale === "es" ? "Costo prom. previo" : "Prev avg cost"}</span><span>$168.40</span></div>
            <div className="calc-row"><span className="lbl">{locale === "es" ? "Nuevo costo prom." : "New avg cost"}</span><span>${(((45 * 168.40) + (qty * price)) / (45 + qty)).toFixed(2)}</span></div>
          </div>

          <div className="calc-card">
            <h4>{locale === "es" ? "Validaciones" : "Validations"}</h4>
            <div className="calc-row subtle"><span className="lbl">✓ {locale === "es" ? "Liquidez disponible" : "Cash available"}</span><span style={{ color: "var(--pos)" }}>OK</span></div>
            <div className="calc-row subtle"><span className="lbl">✓ {locale === "es" ? "FX dentro de banda" : "FX in band"}</span><span style={{ color: "var(--pos)" }}>OK</span></div>
            <div className="calc-row subtle"><span className="lbl">⚠ {locale === "es" ? "Concentración sector" : "Sector concentration"}</span><span style={{ color: "var(--warn)" }}>34.5%</span></div>
          </div>
        </div>
      </div>
    </main>
  );
}

export function DividendForm({ t, locale, setRoute, fxRate, transactions, addTransaction }) {
  const [qty, setQty] = useState(45);
  const [price, setPrice] = useState(0.24);
  const [fx, setFx] = useState(fxRate);
  const [ticker, setTicker] = useState("AAPL");
  const [date, setDate] = useState("2026-05-06");
  const [brokerCode, setBrokerCode] = useState("GBM");
  const [account, setAccount] = useState("PERSONAL-001");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState({ kind: "idle" });

  const grossUSD = qty * price;
  const grossMXN = grossUSD * fx;

  const validate = () => {
    if (!ticker.trim()) return locale === "es" ? "Falta el ticker." : "Ticker is required.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return locale === "es" ? "Fecha inválida (YYYY-MM-DD)." : "Invalid date (YYYY-MM-DD).";
    if (!(qty > 0)) return locale === "es" ? "Cantidad debe ser > 0." : "Quantity must be > 0.";
    if (!(price > 0)) return locale === "es" ? "Dividendo por acción debe ser > 0." : "Dividend per share must be > 0.";
    if (!(fx > 0)) return locale === "es" ? "FX debe ser > 0." : "FX rate must be > 0.";
    return null;
  };

  const handleSave = async (stayOnForm) => {
    const err = validate();
    if (err) {
      setStatus({ kind: "error", msg: err });
      return;
    }
    const payload = {
      external_id: nextExternalId(transactions),
      trade_date: date,
      type: "DIV",
      ticker: ticker.trim().toUpperCase(),
      qty: Number(qty),
      price_usd: Number(price),
      fx_rate: Number(fx),
      commission_pct: 0,
      iva_pct: 0,
      fees_mxn: 0,
      broker_code: brokerCode,
      account_number: account.trim() || null,
      notes: notes.trim() || null,
    };

    setStatus({ kind: "saving" });
    try {
      await addTransaction(payload);
      setStatus({ kind: "saved", id: payload.external_id });
      if (stayOnForm) {
        setQty(0);
        setPrice(0);
        setNotes("");
      } else {
        setRoute("transactions");
      }
    } catch (e) {
      setStatus({ kind: "error", msg: e.message ?? String(e) });
    }
  };

  return (
    <main className="main">
      <div className="page-head">
        <div>
          <h1>{locale === "es" ? "Nuevo dividendo" : "New dividend"}</h1>
          <div className="sub">{locale === "es" ? "Registrar pago de dividendo" : "Record a dividend payment"}</div>
        </div>
        <div className="actions">
          <button className="btn btn-sm" onClick={() => setRoute("dashboard")} disabled={status.kind === "saving"}>{t("cancel")}</button>
          <button className="btn btn-sm" onClick={() => handleSave(true)} disabled={status.kind === "saving"}>{t("save_and_new")}</button>
          <button className="btn btn-primary btn-sm" onClick={() => handleSave(false)} disabled={status.kind === "saving"}>
            {status.kind === "saving" ? (locale === "es" ? "Guardando…" : "Saving…") : t("save")}
          </button>
        </div>
      </div>

      {status.kind === "error" && (
        <div className="form-status error" role="alert" style={{ margin: "8px 16px", padding: "8px 12px", background: "var(--bg-chip)", color: "var(--neg)", border: "1px solid var(--neg)", borderRadius: 4, fontSize: 13 }}>
          {status.msg}
        </div>
      )}
      {status.kind === "saved" && (
        <div className="form-status saved" style={{ margin: "8px 16px", padding: "8px 12px", background: "var(--bg-chip)", color: "var(--pos)", border: "1px solid var(--pos)", borderRadius: 4, fontSize: 13 }}>
          {locale === "es" ? `Guardado: ${status.id}` : `Saved: ${status.id}`}
        </div>
      )}

      <div className="form-wrap">
        <div className="form-main">
          <div className="form-section">
            <h3>{locale === "es" ? "Información básica" : "Basic info"}</h3>
            <div className="form-row"><label>{t("transaction_type")}</label>
              <div className="tabs" style={{ width: "fit-content" }}>
                <button style={{ padding: "5px 16px" }} onClick={() => setRoute("buy")}>{t("purchase")}</button>
                <button style={{ padding: "5px 16px" }} onClick={() => setRoute("sell")}>{t("sale")}</button>
                <button className="active" style={{ padding: "5px 16px" }}>{t("dividend")}</button>
              </div>
            </div>
            <div className="form-row"><label>{t("date")}</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                <input value={date.split("-")[0]} onChange={e => setDate(e.target.value + "-" + date.split("-")[1] + "-" + date.split("-")[2])} placeholder={locale === "es" ? "Año" : "Year"} />
                <input value={date.split("-")[1]} onChange={e => setDate(date.split("-")[0] + "-" + e.target.value + "-" + date.split("-")[2])} placeholder={locale === "es" ? "Mes" : "Month"} />
                <input value={date.split("-")[2]} onChange={e => setDate(date.split("-")[0] + "-" + date.split("-")[1] + "-" + e.target.value)} placeholder={locale === "es" ? "Día" : "Day"} />
              </div>
            </div>
            <div className="form-row"><label>{t("instrument")}</label>
              <input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())} placeholder="AAPL" />
            </div>
            <div className="form-row"><label>{t("broker")}</label>
              <select value={brokerCode} onChange={e => setBrokerCode(e.target.value)}>
                {BUY_BROKERS.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
              </select>
            </div>
            <div className="form-row"><label>{t("account")}</label>
              <input value={account} onChange={e => setAccount(e.target.value)} />
            </div>
          </div>

          <div className="form-section">
            <h3>{locale === "es" ? "Monto" : "Amount"}</h3>
            <div className="form-row"><label>{locale === "es" ? "Acciones con derecho" : "Eligible shares"}</label>
              <input type="number" value={qty} onChange={e => setQty(+e.target.value)} />
            </div>
            <div className="form-row"><label>{locale === "es" ? "Dividendo por acción" : "Dividend per share"}</label>
              <div className="input-suffix"><input type="number" step="0.0001" value={price} onChange={e => setPrice(+e.target.value)} /><span className="suffix">USD</span></div>
            </div>
            <div className="form-row"><label>{t("fx_rate")}</label>
              <div className="input-suffix"><input type="number" step="0.0001" value={fx} onChange={e => setFx(+e.target.value)} /><span className="suffix">MXN/USD</span></div>
            </div>
            <div className="form-row"><label>{t("notes")}</label>
              <textarea rows="2" value={notes} onChange={e => setNotes(e.target.value)} placeholder={locale === "es" ? "Dividendo Q2…" : "Q2 dividend…"} />
            </div>
          </div>
        </div>

        <div className="form-side">
          <div className="calc-card">
            <h4>{t("cost_breakdown")}</h4>
            <div className="calc-row"><span className="lbl">{locale === "es" ? "Acciones" : "Shares"}</span><span>{qty}</span></div>
            <div className="calc-row"><span className="lbl">{locale === "es" ? "× DPS" : "× DPS"}</span><span>{fmtUSD(price)}</span></div>
            <div className="calc-row"><span className="lbl">{t("gross_amount")} (USD)</span><span>{fmtUSD(grossUSD)}</span></div>
            <div className="calc-row subtle"><span className="lbl">× FX</span><span>{fx.toFixed(4)}</span></div>
            <div className="calc-row total"><span className="lbl">{t("total_mxn")}</span><span>{fmtMXN(grossMXN)}</span></div>
          </div>
        </div>
      </div>
    </main>
  );
}

export function SellForm({ t, locale, setRoute, fxRate, transactions, addTransaction }) {
  const [qty, setQty] = useState(5);
  const [price, setPrice] = useState(214.32);
  const [fx, setFx] = useState(fxRate);
  const [comm, setComm] = useState(0.0025);
  const [iva, setIva] = useState(0.16);
  const [ticker, setTicker] = useState("AAPL");
  const [date, setDate] = useState("2026-05-06");
  const [brokerCode, setBrokerCode] = useState("GBM");
  const [account, setAccount] = useState("PERSONAL-001");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState({ kind: "idle" });

  const lots = [{ date: "2024-08-22", qty: 5, costUSD: 188.00, fx: 17.10 }];
  const grossUSD = qty * price;
  const grossMXN = grossUSD * fx;
  const commMXN = grossMXN * comm;
  const ivaMXN = commMXN * iva;
  const proceedsMXN = grossMXN - commMXN - ivaMXN;
  const costMXN = lots.reduce((a, l) => a + l.qty * l.costUSD * l.fx, 0);
  const gain = proceedsMXN - costMXN;
  const days = Math.floor((new Date("2026-05-06") - new Date("2024-08-22")) / 86400000);
  const isLong = days > 365;
  const taxRate = 0.30;
  const tax = Math.max(0, gain) * taxRate;

  const validate = () => {
    if (!ticker.trim()) return locale === "es" ? "Falta el ticker." : "Ticker is required.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return locale === "es" ? "Fecha inválida (YYYY-MM-DD)." : "Invalid date (YYYY-MM-DD).";
    if (!(qty > 0)) return locale === "es" ? "Cantidad debe ser > 0." : "Quantity must be > 0.";
    if (!(price > 0)) return locale === "es" ? "Precio debe ser > 0." : "Price must be > 0.";
    if (!(fx > 0)) return locale === "es" ? "FX debe ser > 0." : "FX rate must be > 0.";
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) {
      setStatus({ kind: "error", msg: err });
      return;
    }
    const payload = {
      external_id: nextExternalId(transactions),
      trade_date: date,
      type: "SELL",
      ticker: ticker.trim().toUpperCase(),
      qty: Number(qty),
      price_usd: Number(price),
      fx_rate: Number(fx),
      commission_pct: Number(comm),
      iva_pct: Number(iva),
      fees_mxn: Number((commMXN + ivaMXN).toFixed(2)),
      broker_code: brokerCode,
      account_number: account.trim() || null,
      notes: notes.trim() || null,
    };

    setStatus({ kind: "saving" });
    try {
      await addTransaction(payload);
      setStatus({ kind: "saved", id: payload.external_id });
      setRoute("transactions");
    } catch (e) {
      setStatus({ kind: "error", msg: e.message ?? String(e) });
    }
  };

  return (
    <main className="main">
      <div className="page-head">
        <div>
          <h1>{t("new_sale")}</h1>
          <div className="sub">{locale === "es" ? "Registrar venta — método FIFO" : "Record disposal — FIFO method"}</div>
        </div>
        <div className="actions">
          <button className="btn btn-sm" onClick={() => setRoute("dashboard")} disabled={status.kind === "saving"}>{t("cancel")}</button>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={status.kind === "saving"}>
            {status.kind === "saving" ? (locale === "es" ? "Guardando…" : "Saving…") : t("save")}
          </button>
        </div>
      </div>

      {status.kind === "error" && (
        <div className="form-status error" role="alert" style={{ margin: "8px 16px", padding: "8px 12px", background: "var(--bg-chip)", color: "var(--neg)", border: "1px solid var(--neg)", borderRadius: 4, fontSize: 13 }}>
          {status.msg}
        </div>
      )}

      <div className="form-wrap">
        <div className="form-main">
          <div className="form-section">
            <h3>{locale === "es" ? "Información básica" : "Basic info"}</h3>
            <div className="form-row"><label>{t("transaction_type")}</label>
              <div className="tabs" style={{ width: "fit-content" }}>
                <button style={{ padding: "5px 16px" }} onClick={() => setRoute("buy")}>{t("purchase")}</button>
                <button className="active" style={{ padding: "5px 16px" }}>{t("sale")}</button>
                <button style={{ padding: "5px 16px" }} onClick={() => setRoute("dividend")}>{t("dividend")}</button>
              </div>
            </div>
            <div className="form-row"><label>{t("date")}</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                <input value={date.split("-")[0]} onChange={e => setDate(e.target.value + "-" + date.split("-")[1] + "-" + date.split("-")[2])} placeholder={locale === "es" ? "Año" : "Year"} />
                <input value={date.split("-")[1]} onChange={e => setDate(date.split("-")[0] + "-" + e.target.value + "-" + date.split("-")[2])} placeholder={locale === "es" ? "Mes" : "Month"} />
                <input value={date.split("-")[2]} onChange={e => setDate(date.split("-")[0] + "-" + date.split("-")[1] + "-" + e.target.value)} placeholder={locale === "es" ? "Día" : "Day"} />
              </div>
            </div>
            <div className="form-row"><label>{t("instrument")}</label>
              <input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())} placeholder="AAPL" />
            </div>
            <div className="form-row"><label>{t("broker")}</label>
              <select value={brokerCode} onChange={e => setBrokerCode(e.target.value)}>
                {BUY_BROKERS.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
              </select>
            </div>
            <div className="form-row"><label>{t("account")}</label>
              <input value={account} onChange={e => setAccount(e.target.value)} />
            </div>
          </div>

          <div className="form-section">
            <h3>{locale === "es" ? "Precio y cantidad" : "Price & quantity"}</h3>
            <div className="form-row"><label>{t("quantity")}</label><input type="number" value={qty} onChange={e => setQty(+e.target.value)} /></div>
            <div className="form-row"><label>{t("unit_price")}</label>
              <div className="input-suffix"><input type="number" step="0.01" value={price} onChange={e => setPrice(+e.target.value)} /><span className="suffix">USD</span></div>
            </div>
            <div className="form-row"><label>{t("fx_rate")}</label>
              <div className="input-suffix"><input type="number" step="0.0001" value={fx} onChange={e => setFx(+e.target.value)} /><span className="suffix">MXN/USD</span></div>
            </div>
            <div className="form-row"><label>{t("commission")}</label>
              <div className="input-suffix"><input type="number" step="0.0001" value={comm} onChange={e => setComm(+e.target.value)} /><span className="suffix">%</span></div>
            </div>
            <div className="form-row"><label>{t("iva_commission")}</label>
              <div className="input-suffix"><input type="number" step="0.01" value={iva} onChange={e => setIva(+e.target.value)} /><span className="suffix">%</span></div>
            </div>
            <div className="form-row"><label>{t("notes")}</label>
              <textarea rows="2" value={notes} onChange={e => setNotes(e.target.value)} placeholder={locale === "es" ? "Toma de utilidades…" : "Profit taking…"} />
            </div>
          </div>

          <div className="form-section">
            <h3>{t("matched_lots")}</h3>
            <table className="data" style={{ background: "var(--bg-row)" }}>
              <thead><tr><th>{t("date")}</th><th className="num">{t("qty")}</th><th className="num">{t("avg_cost")}</th><th className="num">FX</th><th className="num">{t("cost_basis")}</th><th>{t("holding_period")}</th></tr></thead>
              <tbody>
                {lots.map((l, i) => (
                  <tr key={i}>
                    <td className="mono">{fmtDate(l.date, locale)}</td>
                    <td className="num">{l.qty}</td>
                    <td className="num">{fmtUSD(l.costUSD)}</td>
                    <td className="num subtle">{l.fx.toFixed(4)}</td>
                    <td className="num">{fmtMXN(l.qty * l.costUSD * l.fx)}</td>
                    <td><span className="pill pill-pos">{days} {t("days")} · {isLong ? t("long_term") : t("short_term")}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="form-side">
          <div className="calc-card">
            <h4>{t("cost_breakdown")}</h4>
            <div className="calc-row"><span className="lbl">{t("gross_amount")} (USD)</span><span>{fmtUSD(grossUSD)}</span></div>
            <div className="calc-row"><span className="lbl">{t("gross_amount")} (MXN)</span><span>{fmtMXN(grossMXN)}</span></div>
            <div className="calc-row"><span className="lbl">− {t("commission")}</span><span>{fmtMXN(-commMXN)}</span></div>
            <div className="calc-row"><span className="lbl">− {t("iva_commission")}</span><span>{fmtMXN(-ivaMXN)}</span></div>
            <div className="calc-row total"><span className="lbl">{locale === "es" ? "Producto neto" : "Net proceeds"}</span><span>{fmtMXN(proceedsMXN)}</span></div>
          </div>

          <div className="calc-card">
            <h4>{t("realized_gain")}</h4>
            <div className="calc-row"><span className="lbl">{locale === "es" ? "Producto" : "Proceeds"}</span><span>{fmtMXN(proceedsMXN)}</span></div>
            <div className="calc-row"><span className="lbl">− {t("cost_basis")}</span><span>{fmtMXN(-costMXN)}</span></div>
            <div className="calc-row total" style={{ color: gain >= 0 ? "var(--pos)" : "var(--neg)" }}>
              <span className="lbl" style={{ color: "inherit" }}>{t("realized_gain")}</span><span>{fmtMXN(gain, { signed: true })}</span>
            </div>
          </div>

          <div className="calc-card">
            <h4>{t("isr_due")}</h4>
            <div className="calc-row"><span className="lbl">{t("tax_rate_applied")}</span><span>{(taxRate * 100).toFixed(0)}%</span></div>
            <div className="calc-row"><span className="lbl">{locale === "es" ? "Tipo" : "Type"}</span><span>{isLong ? t("long_term") : t("short_term")} · {t("foreign")}</span></div>
            <div className="calc-row total" style={{ color: "var(--warn)" }}>
              <span className="lbl" style={{ color: "inherit" }}>{gain >= 0 ? t("tax_owed") : t("tax_claim")}</span>
              <span>{fmtMXN(gain >= 0 ? tax : Math.abs(gain) * taxRate)}</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export function TransactionsList({ t, locale, setRoute, transactions }) {
  const [filter, setFilter] = useState("ALL");
  const [ticker, setTicker] = useState("ALL");
  const [broker, setBroker] = useState("ALL");
  const [year, setYear]     = useState("ALL");
  const [query, setQuery]   = useState("");

  const tickerOptions = React.useMemo(
    () => Array.from(new Set(transactions.map(tx => tx.ticker))).sort(),
    [transactions],
  );
  const brokerOptions = React.useMemo(
    () => Array.from(new Set(transactions.map(tx => tx.broker))).sort(),
    [transactions],
  );
  const yearOptions = React.useMemo(
    () => Array.from(new Set(transactions.map(tx => new Date(tx.date).getFullYear())))
      .sort((a, b) => b - a),
    [transactions],
  );

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions.filter(tx => {
      if (filter !== "ALL" && tx.type !== filter) return false;
      if (ticker !== "ALL" && tx.ticker !== ticker) return false;
      if (broker !== "ALL" && tx.broker !== broker) return false;
      if (year   !== "ALL" && new Date(tx.date).getFullYear() !== Number(year)) return false;
      if (q) {
        const hay = `${tx.id} ${tx.ticker} ${tx.broker} ${tx.notes ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [transactions, filter, ticker, broker, year, query]);

  return (
    <main className="main">
      <div className="page-head">
        <div>
          <h1>{t("transactions")}</h1>
          <div className="sub">{t("showing")} {rows.length} {t("of")} {transactions.length} {t("rows")}</div>
        </div>
        <div className="actions">
          <button className="btn btn-sm" onClick={() => setRoute("import")}>↑ {t("import")}</button>
          <button className="btn btn-sm">{t("export_csv")}</button>
          <button className="btn btn-sm" onClick={() => setRoute("sell")}>− {t("new_sale")}</button>
          <button className="btn btn-primary btn-sm" onClick={() => setRoute("buy")}>+ {t("new_purchase")}</button>
        </div>
      </div>

      <div className="filter-bar">
        <span className="lbl-inline">{t("filter_by")}:</span>
        <select value={ticker} onChange={e => setTicker(e.target.value)}>
          <option value="ALL">{t("all")} tickers</option>
          {tickerOptions.map(tk => <option key={tk} value={tk}>{tk}</option>)}
        </select>
        <select value={broker} onChange={e => setBroker(e.target.value)}>
          <option value="ALL">{t("all")} brokers</option>
          {brokerOptions.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <select value={year} onChange={e => setYear(e.target.value)}>
          <option value="ALL">{locale === "es" ? "Todos los años" : "All years"}</option>
          {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <div className="tabs">
          <button className={filter === "ALL"  ? "active" : ""} onClick={() => setFilter("ALL")}>{t("all")}</button>
          <button className={filter === "BUY"  ? "active" : ""} onClick={() => setFilter("BUY")}>BUY</button>
          <button className={filter === "SELL" ? "active" : ""} onClick={() => setFilter("SELL")}>SELL</button>
          <button className={filter === "DIV"  ? "active" : ""} onClick={() => setFilter("DIV")}>DIV</button>
        </div>
        <div className="grow" />
        <input
          placeholder={locale === "es" ? "Buscar…" : "Search…"}
          style={{ width: 200 }}
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>ID</th><th>{t("date")}</th><th>{t("type")}</th><th>{t("ticker")}</th>
              <th className="num">{t("qty")}</th><th className="num">{t("price_usd")}</th>
              <th className="num">FX</th><th className="num">{t("price_mxn")}</th>
              <th className="num">{t("fees")}</th><th className="num">{t("total_mxn")}</th>
              <th>{t("broker")}</th><th>{t("notes")}</th><th className="num">{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={13} className="subtle" style={{ textAlign: "center", padding: "16px" }}>
                  {t("no_results")}
                </td>
              </tr>
            )}
            {rows.map(tx => (
              <tr key={tx.id}>
                <td className="mono subtle">{tx.id}</td>
                <td className="mono">{fmtDate(tx.date, locale)}</td>
                <td><span className={"chip " + (tx.type === "BUY" ? "chip-buy" : tx.type === "SELL" ? "chip-sell" : "chip-div")}>{tx.type}</span></td>
                <td className="ticker">{tx.ticker}</td>
                <td className="num">{tx.qty}</td>
                <td className="num">{fmtUSD(tx.priceUSD)}</td>
                <td className="num subtle">{tx.fxRate.toFixed(4)}</td>
                <td className="num">{fmtMXN(tx.priceUSD * tx.fxRate)}</td>
                <td className="num">{fmtMXN(tx.feesMXN)}</td>
                <td className="num"><strong>{fmtMXN(tx.totalMXN)}</strong></td>
                <td className="mono subtle">{tx.broker}</td>
                <td className="subtle" style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>{tx.notes || "—"}</td>
                <td className="num"><button className="btn btn-sm btn-ghost">edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

// ---------- CSV import helpers ----------

function parseCSVLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else cur += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { out.push(cur); cur = ""; }
      else cur += c;
    }
  }
  out.push(cur);
  return out.map(s => s.trim());
}

function parseCSV(text) {
  const lines = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n").split("\n").filter(l => l.length);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = parseCSVLine(lines[0]);
  const rows = lines.slice(1).map(line => {
    const cells = parseCSVLine(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = cells[i] ?? ""; });
    return obj;
  });
  return { headers, rows };
}

const IMPORT_FIELDS = [
  { key: "date",     required: true,  label: { es: "Fecha (YYYY-MM-DD)", en: "Date (YYYY-MM-DD)" } },
  { key: "ticker",   required: true,  label: { es: "Ticker", en: "Ticker" } },
  { key: "type",     required: true,  label: { es: "Tipo (BUY/SELL/DIV)", en: "Type (BUY/SELL/DIV)" } },
  { key: "qty",      required: true,  label: { es: "Cantidad", en: "Quantity" } },
  { key: "priceUSD", required: true,  label: { es: "Precio USD", en: "Price USD" } },
  { key: "fxRate",   required: true,  label: { es: "Tipo de cambio", en: "FX rate" } },
  { key: "fees",     required: false, label: { es: "Comisiones MXN", en: "Fees MXN" } },
  { key: "broker",   required: false, label: { es: "Broker", en: "Broker" } },
  { key: "account",  required: false, label: { es: "Cuenta", en: "Account" } },
  { key: "notes",    required: false, label: { es: "Notas", en: "Notes" } },
];

const HEADER_HINTS = {
  date:     ["date", "trade_date", "tradedate", "settlement date", "settlementdate", "fecha"],
  ticker:   ["ticker", "symbol", "activo", "instrumento"],
  type:     ["type", "action", "tipo", "operacion", "operación"],
  qty:      ["qty", "quantity", "cantidad", "shares", "acciones"],
  priceUSD: ["price", "priceusd", "price_usd", "precio", "precio_usd"],
  fxRate:   ["fx", "fxrate", "fx_rate", "tc", "tipo_cambio", "tipodecambio"],
  fees:     ["fees", "commission", "comision", "comisión", "feesmxn", "fees_mxn"],
  broker:   ["broker", "casa_de_bolsa"],
  account:  ["account", "account_number", "cuenta", "numero_cuenta"],
  notes:    ["notes", "notas", "comentario"],
};

function autoMap(headers) {
  const norm = (s) => s.toLowerCase().replace(/[\s_-]+/g, "");
  const lower = headers.map(norm);
  const map = {};
  for (const [field, hints] of Object.entries(HEADER_HINTS)) {
    map[field] = "";
    for (const hint of hints) {
      const idx = lower.indexOf(norm(hint));
      if (idx >= 0) { map[field] = headers[idx]; break; }
    }
  }
  return map;
}

function normalizeType(raw) {
  const v = String(raw ?? "").trim().toLowerCase();
  if (["buy", "compra", "b", "purchase"].includes(v))                  return "BUY";
  if (["sell", "venta", "s", "sale", "disposal"].includes(v))          return "SELL";
  if (["div", "dividendo", "dividend", "d"].includes(v))               return "DIV";
  return null;
}

function buildBrokerLookup() {
  const m = {};
  for (const b of BUY_BROKERS) {
    m[b.code] = b.code;
    m[b.code.toLowerCase()] = b.code;
    m[b.name] = b.code;
    m[b.name.toLowerCase()] = b.code;
  }
  return m;
}

function rowToPayload(row, mapping, brokerLookup, externalId) {
  const cell = (k) => mapping[k] ? String(row[mapping[k]] ?? "").trim() : "";
  const errors = [];

  const date = cell("date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push(`bad date "${date}"`);

  const ticker = cell("ticker").toUpperCase();
  if (!ticker) errors.push("missing ticker");

  const type = normalizeType(cell("type"));
  if (!type) errors.push(`bad type "${cell("type")}"`);

  const qty = Number(cell("qty"));
  if (!(qty > 0)) errors.push("qty must be > 0");

  const priceUSD = Number(cell("priceUSD"));
  if (!(priceUSD > 0)) errors.push("price must be > 0");

  const fxRate = Number(cell("fxRate"));
  if (!(fxRate > 0)) errors.push("fx must be > 0");

  const fees = mapping.fees ? Number(cell("fees") || 0) : 0;
  const brokerRaw = cell("broker");
  const brokerCode = brokerRaw ? (brokerLookup[brokerRaw] ?? brokerLookup[brokerRaw.toLowerCase()] ?? null) : null;
  const account = cell("account") || null;
  const notes   = cell("notes") || null;

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    payload: {
      external_id: externalId,
      trade_date: date,
      type,
      ticker,
      qty,
      price_usd: priceUSD,
      fx_rate: fxRate,
      commission_pct: 0,
      iva_pct: 0,
      fees_mxn: Number.isFinite(fees) ? fees : 0,
      broker_code: brokerCode,
      account_number: account,
      notes,
    },
  };
}

export function ImportCSV({ t, locale, setRoute, transactions, addTransaction }) {
  const fileInputRef = React.useRef(null);
  const [file, setFile] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [dragOver, setDragOver] = useState(false);
  const [parseError, setParseError] = useState(null);
  const [validation, setValidation] = useState(null);
  const [importState, setImportState] = useState({ kind: "idle" });

  const brokerLookup = React.useMemo(buildBrokerLookup, []);

  const baseExternal = React.useMemo(() => {
    let max = 0;
    for (const tx of transactions ?? []) {
      const m = typeof tx.id === "string" && tx.id.match(/^TX-(\d+)$/);
      if (m) max = Math.max(max, +m[1]);
    }
    return max;
  }, [transactions]);

  const handleFile = async (f) => {
    if (!f) return;
    setFile(f);
    setParseError(null);
    setValidation(null);
    setImportState({ kind: "idle" });
    try {
      const text = await f.text();
      const { headers: hh, rows: rr } = parseCSV(text);
      if (hh.length === 0) throw new Error(locale === "es" ? "CSV vacío." : "CSV is empty.");
      setHeaders(hh);
      setRows(rr);
      setMapping(autoMap(hh));
    } catch (e) {
      setParseError(e.message ?? String(e));
      setHeaders([]); setRows([]); setMapping({});
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const previewRow = rows[0];
  const cellPreview = (k) => previewRow && mapping[k] ? String(previewRow[mapping[k]] ?? "") : "";

  const buildPayloads = () => {
    const out = { valid: [], invalid: [] };
    rows.forEach((row, i) => {
      const r = rowToPayload(row, mapping, brokerLookup, `TX-${baseExternal + i + 1}`);
      if (r.ok) out.valid.push(r.payload);
      else out.invalid.push({ index: i + 2, errors: r.errors }); // +2 = header row offset, 1-based
    });
    return out;
  };

  const validate = () => {
    if (rows.length === 0) return;
    setValidation(buildPayloads());
  };

  const runImport = async () => {
    if (rows.length === 0) return;
    const { valid, invalid } = buildPayloads();
    setValidation({ valid, invalid });
    if (valid.length === 0) {
      setImportState({ kind: "error", msg: locale === "es" ? "No hay filas válidas." : "No valid rows to import." });
      return;
    }
    setImportState({ kind: "importing", done: 0, total: valid.length, failures: [] });
    const failures = [];
    for (let i = 0; i < valid.length; i++) {
      try {
        await addTransaction(valid[i]);
      } catch (e) {
        failures.push({ id: valid[i].external_id, msg: e.message ?? String(e) });
      }
      setImportState(s => s.kind === "importing" ? { ...s, done: i + 1, failures: [...failures] } : s);
    }
    setImportState({ kind: "done", imported: valid.length - failures.length, failures, skipped: invalid.length });
  };

  const reset = () => {
    setFile(null); setHeaders([]); setRows([]); setMapping({});
    setValidation(null); setParseError(null); setImportState({ kind: "idle" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const importing = importState.kind === "importing";

  return (
    <main className="main">
      <div className="page-head">
        <div>
          <h1>{t("import")}</h1>
          <div className="sub">{locale === "es" ? "Importa transacciones desde tu broker" : "Import transactions from your broker"}</div>
        </div>
        <div className="actions">
          {file && <button className="btn btn-sm" onClick={reset} disabled={importing}>{locale === "es" ? "Limpiar" : "Clear"}</button>}
          <button className="btn btn-sm" onClick={() => setRoute("transactions")} disabled={importing}>{t("cancel")}</button>
        </div>
      </div>

      <div style={{ padding: 24, maxWidth: 900 }}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: "none" }}
          onChange={e => handleFile(e.target.files?.[0])}
        />

        <div
          className="dropzone"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          style={{ cursor: "pointer", outline: dragOver ? "2px dashed var(--accent)" : undefined }}
        >
          <div style={{ fontSize: 28, marginBottom: 8 }}>↑</div>
          {file ? (
            <>
              <strong>{file.name}</strong>
              <div style={{ marginTop: 4, fontSize: 12 }}>
                {rows.length} {locale === "es" ? "filas" : "rows"} · {headers.length} {locale === "es" ? "columnas" : "columns"}
              </div>
            </>
          ) : (
            <>
              <strong>{locale === "es" ? "Arrastra tu archivo CSV aquí" : "Drop your CSV file here"}</strong>
              <div style={{ marginTop: 4 }}>
                {locale === "es" ? "o" : "or"}{" "}
                <span style={{ color: "var(--accent)", textDecoration: "underline" }}>
                  {locale === "es" ? "selecciona un archivo" : "browse files"}
                </span>
              </div>
              <div style={{ marginTop: 12, fontSize: 11 }}>
                {locale === "es"
                  ? "Encabezados detectados: date, ticker, type, qty, priceUSD, fxRate, fees, broker, account, notes."
                  : "Auto-detected headers: date, ticker, type, qty, priceUSD, fxRate, fees, broker, account, notes."}
              </div>
            </>
          )}
        </div>

        {parseError && (
          <div role="alert" style={{ marginTop: 12, padding: "8px 12px", background: "var(--bg-chip)", color: "var(--neg)", border: "1px solid var(--neg)", borderRadius: 4, fontSize: 13 }}>
            {parseError}
          </div>
        )}

        {file && headers.length > 0 && (
          <div className="calc-card" style={{ marginTop: 16 }}>
            <h4>{locale === "es" ? "Mapeo de columnas" : "Column mapping"}</h4>
            <table className="data" style={{ marginTop: 6 }}>
              <thead>
                <tr>
                  <th>{locale === "es" ? "Campo destino" : "Target field"}</th>
                  <th>{locale === "es" ? "Columna CSV" : "CSV column"}</th>
                  <th>{locale === "es" ? "Vista previa" : "Preview"}</th>
                </tr>
              </thead>
              <tbody>
                {IMPORT_FIELDS.map(f => (
                  <tr key={f.key}>
                    <td>
                      {f.label[locale] ?? f.label.en}
                      {f.required && <span style={{ color: "var(--neg)" }}> *</span>}
                    </td>
                    <td>
                      <select
                        value={mapping[f.key] ?? ""}
                        onChange={e => setMapping(m => ({ ...m, [f.key]: e.target.value }))}
                        disabled={importing}
                      >
                        <option value="">{locale === "es" ? "— sin mapear —" : "— unmapped —"}</option>
                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </td>
                    <td className="mono subtle">{cellPreview(f.key) || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {validation && (
              <div style={{ marginTop: 12, fontSize: 13 }}>
                <div>
                  <strong>{locale === "es" ? "Validación" : "Validation"}:</strong>{" "}
                  <span style={{ color: "var(--pos)" }}>{validation.valid.length} {locale === "es" ? "válidas" : "valid"}</span>
                  {" · "}
                  <span style={{ color: validation.invalid.length ? "var(--neg)" : "var(--fg-subtle)" }}>
                    {validation.invalid.length} {locale === "es" ? "con errores" : "with errors"}
                  </span>
                </div>
                {validation.invalid.length > 0 && (
                  <ul style={{ margin: "6px 0 0 16px", maxHeight: 140, overflow: "auto", fontSize: 12 }}>
                    {validation.invalid.slice(0, 50).map((e, i) => (
                      <li key={i}>{locale === "es" ? "Fila" : "Row"} {e.index}: {e.errors.join("; ")}</li>
                    ))}
                    {validation.invalid.length > 50 && (
                      <li className="subtle">… {validation.invalid.length - 50} {locale === "es" ? "más" : "more"}</li>
                    )}
                  </ul>
                )}
              </div>
            )}

            {importState.kind === "importing" && (
              <div style={{ marginTop: 12, fontSize: 13 }}>
                {locale === "es" ? "Importando" : "Importing"} {importState.done}/{importState.total}…
              </div>
            )}
            {importState.kind === "done" && (
              <div style={{ marginTop: 12, padding: "8px 12px", background: "var(--bg-chip)", color: importState.failures.length ? "var(--warn)" : "var(--pos)", border: `1px solid ${importState.failures.length ? "var(--warn)" : "var(--pos)"}`, borderRadius: 4, fontSize: 13 }}>
                {locale === "es"
                  ? `Importadas ${importState.imported}, fallidas ${importState.failures.length}, omitidas ${importState.skipped}.`
                  : `Imported ${importState.imported}, failed ${importState.failures.length}, skipped ${importState.skipped}.`}
                {importState.failures.length > 0 && (
                  <ul style={{ margin: "6px 0 0 16px", fontSize: 12 }}>
                    {importState.failures.slice(0, 20).map((f, i) => (
                      <li key={i}>{f.id}: {f.msg}</li>
                    ))}
                  </ul>
                )}
                <div style={{ marginTop: 8 }}>
                  <button className="btn btn-sm" onClick={() => setRoute("transactions")}>
                    {locale === "es" ? "Ver transacciones →" : "View transactions →"}
                  </button>
                </div>
              </div>
            )}
            {importState.kind === "error" && (
              <div role="alert" style={{ marginTop: 12, padding: "8px 12px", background: "var(--bg-chip)", color: "var(--neg)", border: "1px solid var(--neg)", borderRadius: 4, fontSize: 13 }}>
                {importState.msg}
              </div>
            )}

            <div className="flex gap-8" style={{ marginTop: 12, justifyContent: "flex-end" }}>
              <button className="btn btn-sm" onClick={validate} disabled={importing}>
                {locale === "es" ? "Validar" : "Validate"}
              </button>
              <button className="btn btn-primary btn-sm" onClick={runImport} disabled={importing || rows.length === 0}>
                {importing
                  ? (locale === "es" ? `Importando ${importState.done}/${importState.total}…` : `Importing ${importState.done}/${importState.total}…`)
                  : (locale === "es" ? `Importar ${rows.length} registros` : `Import ${rows.length} rows`)}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export function TaxReport({ t, locale, taxBreakdown, realized }) {
  const [year, setYear] = useState(taxBreakdown.year);
  const [tb, setTb] = useState(taxBreakdown);
  const [loading, setLoading] = useState(false);

  // Refetch when the user picks a different year. Falls back silently to the
  // last successfully-loaded breakdown when the API is unreachable.
  useEffect(() => {
    if (year === tb.year) return;
    let cancelled = false;
    setLoading(true);
    api.taxBreakdown(year)
      .then(d => { if (!cancelled) setTb(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [year]); // eslint-disable-line react-hooks/exhaustive-deps

  const yearOptions = React.useMemo(() => {
    const ys = new Set(realized.map(r => new Date(r.closeDate).getFullYear()));
    ys.add(year); ys.add(taxBreakdown.year);
    return [...ys].sort((a, b) => b - a);
  }, [realized, year, taxBreakdown.year]);

  const realizedForYear = React.useMemo(
    () => realized.filter(r => new Date(r.closeDate).getFullYear() === year),
    [realized, year],
  );

  const netGain = tb.shortTermGain + tb.longTermGain - tb.shortTermLoss - tb.longTermLoss;
  const taxOwed = Math.max(0, netGain) * tb.rateApplied;

  const exportCSV = () => {
    const labels = locale === "es"
      ? ["Cierre", "Apertura", "Ticker", "Cantidad", "Producto MXN", "Costo MXN", "Ganancia MXN", "Días", "Tipo", "Mercado", "ISR estimado MXN"]
      : ["Close", "Open", "Ticker", "Qty", "Proceeds MXN", "Cost MXN", "Gain MXN", "Days", "Kind", "Market", "Est. tax MXN"];
    const rows = [labels.join(",")];
    for (const r of realizedForYear) {
      const tax = r.gainMXN > 0 ? r.gainMXN * tb.rateApplied : 0;
      rows.push([
        r.closeDate, r.openDate, r.ticker, r.qty,
        r.proceedsMXN, r.costMXN, r.gainMXN, r.days, r.kind, r.market,
        tax.toFixed(2),
      ].map(csvField).join(","));
    }
    rows.push("");
    rows.push([locale === "es" ? "Resumen" : "Summary"].join(","));
    rows.push([locale === "es" ? "Año fiscal" : "Fiscal year", year].join(","));
    rows.push([locale === "es" ? "Ganancia CP" : "Short-term gain", tb.shortTermGain].join(","));
    rows.push([locale === "es" ? "Ganancia LP" : "Long-term gain",  tb.longTermGain].join(","));
    rows.push([locale === "es" ? "Pérdida CP"  : "Short-term loss", tb.shortTermLoss].join(","));
    rows.push([locale === "es" ? "Pérdida LP"  : "Long-term loss",  tb.longTermLoss].join(","));
    rows.push([locale === "es" ? "Ganancia neta" : "Net gain", netGain.toFixed(2)].join(","));
    rows.push([locale === "es" ? "Tasa aplicada" : "Applied rate", tb.rateApplied].join(","));
    rows.push([locale === "es" ? "ISR a pagar" : "Tax owed", taxOwed.toFixed(2)].join(","));
    downloadBlob(`tax_report_${year}.csv`, rows.join("\n"));
  };

  const exportPDF = () => {
    const fmtMoney = (n) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
    const tableRows = realizedForYear.map(r => {
      const tax = r.gainMXN > 0 ? r.gainMXN * tb.rateApplied : 0;
      const cls = r.gainMXN >= 0 ? "pos" : "neg";
      return `<tr>
        <td>${r.closeDate}</td><td>${r.openDate}</td><td>${r.ticker}</td>
        <td class="num">${r.qty}</td>
        <td class="num">${fmtMoney(r.proceedsMXN)}</td>
        <td class="num">${fmtMoney(r.costMXN)}</td>
        <td class="num ${cls}">${fmtMoney(r.gainMXN)}</td>
        <td class="num">${r.days}</td>
        <td>${r.kind}</td>
        <td class="num">${r.gainMXN > 0 ? fmtMoney(tax) : "—"}</td>
      </tr>`;
    }).join("");
    const title = locale === "es" ? `Reporte fiscal ${year}` : `Tax report ${year}`;
    const body = `
      <h1>${title}</h1>
      <div class="sub">${locale === "es" ? "Persona física · ISR sobre enajenación" : "Individual · Capital gains ISR"}</div>
      <div class="summary">
        <div class="cell"><div class="lbl">${locale === "es" ? "Ganancias" : "Capital gains"}</div><div class="val pos">${fmtMoney(tb.shortTermGain + tb.longTermGain)}</div></div>
        <div class="cell"><div class="lbl">${locale === "es" ? "Pérdidas" : "Capital losses"}</div><div class="val neg">${fmtMoney(-(tb.shortTermLoss + tb.longTermLoss))}</div></div>
        <div class="cell"><div class="lbl">${locale === "es" ? "Ganancia neta" : "Net gain"}</div><div class="val">${fmtMoney(netGain)}</div></div>
        <div class="cell"><div class="lbl">${locale === "es" ? "ISR a pagar" : "Tax owed"} (${(tb.rateApplied * 100).toFixed(0)}%)</div><div class="val">${fmtMoney(taxOwed)}</div></div>
      </div>
      <h2>${locale === "es" ? "Operaciones cerradas" : "Realized closes"} (${realizedForYear.length})</h2>
      <table>
        <thead><tr>
          <th>${locale === "es" ? "Cierre" : "Close"}</th>
          <th>${locale === "es" ? "Apertura" : "Open"}</th>
          <th>${t("ticker")}</th>
          <th class="num">${t("qty")}</th>
          <th class="num">${locale === "es" ? "Producto" : "Proceeds"}</th>
          <th class="num">${t("cost_basis")}</th>
          <th class="num">${t("realized_gain")}</th>
          <th class="num">${t("days")}</th>
          <th>${locale === "es" ? "Tipo" : "Kind"}</th>
          <th class="num">${t("isr_due")}</th>
        </tr></thead>
        <tbody>${tableRows || `<tr><td colspan="10" style="text-align:center;color:#888">${t("no_results")}</td></tr>`}</tbody>
      </table>`;
    printHtmlInPopup(title, body);
  };

  return (
    <main className="main">
      <div className="page-head">
        <div>
          <h1>{t("taxes")}</h1>
          <div className="sub">
            {t("fiscal_year")} {tb.year} · {locale === "es" ? "Persona física, ISR sobre enajenación" : "Individual, capital gains ISR"}
            {loading && <span className="subtle" style={{ marginLeft: 8 }}>· {locale === "es" ? "cargando…" : "loading…"}</span>}
          </div>
        </div>
        <div className="actions">
          <select className="btn btn-sm" style={{ padding: "4px 8px" }} value={year} onChange={e => setYear(Number(e.target.value))}>
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button className="btn btn-sm" onClick={exportCSV}>{t("export_csv")}</button>
          <button className="btn btn-primary btn-sm" onClick={exportPDF}>{t("export_pdf")}</button>
        </div>
      </div>

      <div className="tax-summary">
        <div className="cell"><div className="lbl">{t("capital_gains")}</div><div className="val" style={{ color: "var(--pos)" }}>{fmtMXN(tb.shortTermGain + tb.longTermGain)}</div><div className="sub">{t("short_term")} + {t("long_term")}</div></div>
        <div className="cell"><div className="lbl">{t("capital_losses")}</div><div className="val" style={{ color: "var(--neg)" }}>{fmtMXN(-(tb.shortTermLoss + tb.longTermLoss))}</div><div className="sub">{locale === "es" ? "deducibles" : "deductible"}</div></div>
        <div className="cell highlight-pos"><div className="lbl">{t("net_gain")}</div><div className="val">{fmtMXN(netGain, { signed: true })}</div><div className="sub">{locale === "es" ? "después de pérdidas" : "after losses"}</div></div>
        <div className="cell highlight-neg"><div className="lbl">{t("tax_owed")} ({(tb.rateApplied * 100).toFixed(0)}%)</div><div className="val">{fmtMXN(taxOwed)}</div><div className="sub">{locale === "es" ? "pago provisional anual" : "annual provisional"}</div></div>
      </div>

      <div className="tax-formula">
        <strong style={{ color: "var(--fg)" }}>{locale === "es" ? "Fórmula:" : "Formula:"}</strong>{" "}
        <code>{t("net_gain")} = (ST {locale === "es" ? "ganancia" : "gain"} + LT {locale === "es" ? "ganancia" : "gain"}) − (ST {locale === "es" ? "pérdida" : "loss"} + LT {locale === "es" ? "pérdida" : "loss"})</code> · <code>{t("tax_owed")} = max(0, {t("net_gain")}) × {(tb.rateApplied * 100).toFixed(0)}%</code> — {t("formula_note")}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "var(--border)" }}>
        <div className="table-wrap">
          <div className="table-head"><h2>{locale === "es" ? "Desglose por tipo" : "Breakdown by type"}</h2></div>
          <table className="data">
            <thead><tr><th>{locale === "es" ? "Categoría" : "Category"}</th><th className="num">{t("capital_gains")}</th><th className="num">{t("capital_losses")}</th><th className="num">{locale === "es" ? "Neto" : "Net"}</th><th className="num">{t("tax_owed")}</th></tr></thead>
            <tbody>
              <tr><td>{t("short_term")} · {t("foreign")}</td><td className="num cell-pos">{fmtMXN(tb.shortTermGain)}</td><td className="num cell-neg">{fmtMXN(-tb.shortTermLoss)}</td><td className="num">{fmtMXN(tb.shortTermGain - tb.shortTermLoss)}</td><td className="num"><strong>{fmtMXN((tb.shortTermGain - tb.shortTermLoss) * tb.rateApplied)}</strong></td></tr>
              <tr><td>{t("long_term")} · {t("foreign")}</td><td className="num cell-pos">{fmtMXN(tb.longTermGain)}</td><td className="num cell-neg">{fmtMXN(-tb.longTermLoss)}</td><td className="num">{fmtMXN(tb.longTermGain - tb.longTermLoss)}</td><td className="num"><strong>{fmtMXN(Math.max(0, tb.longTermGain - tb.longTermLoss) * tb.rateApplied)}</strong></td></tr>
              <tr><td>{t("short_term")} · {t("domestic")}</td><td className="num subtle">—</td><td className="num subtle">—</td><td className="num subtle">—</td><td className="num subtle">{locale === "es" ? "exento (BMV)" : "exempt (BMV)"}</td></tr>
              <tr style={{ background: "var(--bg-row-alt)", fontWeight: 600 }}><td>{locale === "es" ? "Total" : "Total"}</td><td className="num cell-pos">{fmtMXN(tb.shortTermGain + tb.longTermGain)}</td><td className="num cell-neg">{fmtMXN(-(tb.shortTermLoss + tb.longTermLoss))}</td><td className="num">{fmtMXN(netGain)}</td><td className="num">{fmtMXN(taxOwed)}</td></tr>
            </tbody>
          </table>
        </div>

        <div className="table-wrap">
          <div className="table-head"><h2>{locale === "es" ? "Pérdidas por amortizar" : "Loss carry-forward"}</h2></div>
          <table className="data">
            <thead><tr><th>{locale === "es" ? "Año origen" : "Origin year"}</th><th className="num">{locale === "es" ? "Pérdida" : "Loss"}</th><th className="num">{locale === "es" ? "Amortizado" : "Used"}</th><th className="num">{locale === "es" ? "Saldo" : "Balance"}</th><th className="num">{locale === "es" ? "Vence" : "Expires"}</th></tr></thead>
            <tbody>
              <tr><td>2024</td><td className="num cell-neg">{fmtMXN(-4520.30)}</td><td className="num">{fmtMXN(1679.80)}</td><td className="num"><strong>{fmtMXN(-2840.50)}</strong></td><td className="mono subtle">2034</td></tr>
              <tr><td>2025</td><td className="num cell-neg">{fmtMXN(-1284.10)}</td><td className="num">{fmtMXN(0)}</td><td className="num"><strong>{fmtMXN(-1284.10)}</strong></td><td className="mono subtle">2035</td></tr>
              <tr><td>2026</td><td className="num cell-neg">{fmtMXN(-tb.longTermLoss)}</td><td className="num">{fmtMXN(tb.longTermLoss)}</td><td className="num"><strong>{fmtMXN(0)}</strong></td><td className="mono subtle">2036</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="table-wrap">
        <div className="table-head"><h2>{locale === "es" ? "Operaciones cerradas — " : "Realized closes — "} {year}</h2><span className="mono subtle" style={{ fontSize: 11 }}>FIFO · {realizedForYear.length}</span></div>
        <table className="data">
          <thead><tr><th>{locale === "es" ? "Cierre" : "Close"}</th><th>{locale === "es" ? "Apertura" : "Open"}</th><th>{t("ticker")}</th><th className="num">{t("qty")}</th><th className="num">{locale === "es" ? "Producto" : "Proceeds"}</th><th className="num">{t("cost_basis")}</th><th className="num">{t("realized_gain")}</th><th>{t("holding_period")}</th><th>{locale === "es" ? "Tipo" : "Type"}</th><th className="num">{t("isr_due")}</th></tr></thead>
          <tbody>
            {realizedForYear.length === 0 && (
              <tr>
                <td colSpan={10} className="subtle" style={{ textAlign: "center", padding: "16px" }}>{t("no_results")}</td>
              </tr>
            )}
            {realizedForYear.map((r, i) => (
              <tr key={i}>
                <td className="mono">{fmtDate(r.closeDate, locale)}</td>
                <td className="mono subtle">{fmtDate(r.openDate, locale)}</td>
                <td className="ticker">{r.ticker}</td>
                <td className="num">{r.qty}</td>
                <td className="num">{fmtMXN(r.proceedsMXN)}</td>
                <td className="num">{fmtMXN(r.costMXN)}</td>
                <td className={"num " + (r.gainMXN >= 0 ? "cell-pos" : "cell-neg")}><strong>{fmtMXN(r.gainMXN, { signed: true })}</strong></td>
                <td className="mono">{r.days} {t("days")}</td>
                <td><span className="pill pill-pos">{r.kind === "long" ? t("long_term") : t("short_term")}</span></td>
                <td className={"num " + (r.gainMXN >= 0 ? "" : "subtle")}>{r.gainMXN >= 0 ? fmtMXN(r.gainMXN * tb.rateApplied) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

export function StockDetail({ t, locale, currency, setRoute, ticker, positions, transactions }) {
  const p = positions.find(x => x.ticker === ticker) || positions[0];
  const txs = transactions.filter(x => x.ticker === p.ticker);
  const fmt = currency === "MXN" ? fmtMXN : fmtUSD;
  const mv = currency === "MXN" ? p.marketValueMXN : p.marketValueUSD;
  const cb = currency === "MXN" ? p.costBasisMXN : p.costBasisUSD;
  const upl = currency === "MXN" ? p.unrealizedMXN : p.unrealizedUSD;

  return (
    <main className="main">
      <div className="page-head">
        <div>
          <h1 style={{ fontFamily: "var(--font-mono)" }}>{p.ticker} <span className="mono subtle" style={{ fontSize: 13, fontWeight: 400, marginLeft: 8 }}>{p.name}</span></h1>
          <div className="sub">{p.exchange} · {p.sector} · ISIN {p.isin}</div>
        </div>
        <div className="actions">
          <button className="btn btn-sm" onClick={() => setRoute("dashboard")}>← {locale === "es" ? "Volver" : "Back"}</button>
          <button className="btn btn-sm" onClick={() => setRoute("sell")}>− {t("new_sale")}</button>
          <button className="btn btn-primary btn-sm" onClick={() => setRoute("buy")}>+ {t("new_purchase")}</button>
        </div>
      </div>

      <div className="meta-row">
        <div className="m"><b>{fmtUSD(p.lastUSD)}</b> {locale === "es" ? "último" : "last"}</div>
        <div className="m" style={{ color: p.dayPct >= 0 ? "var(--pos)" : "var(--neg)" }}><b>{fmtPct(p.dayPct)}</b> {t("day")}</div>
        <div className="m"><b>{p.qty}</b> {locale === "es" ? "acciones" : "shares"}</div>
        <div className="m"><b>{fmtUSD(p.avgCostUSD)}</b> {t("avg_cost")}</div>
        <div className="m"><b>{p.weight.toFixed(1)}%</b> {t("weight")}</div>
        <div className="grow"></div>
        <div className="m"><b>{fmtMXN(p.marketValueMXN)}</b> MXN</div>
        <div className="m"><b>{fmtUSD(p.marketValueUSD)}</b> USD</div>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="kpi"><div className="label">{t("market_value")}</div><div className="value">{fmt(mv)}</div></div>
        <div className="kpi"><div className="label">{t("cost_basis")}</div><div className="value">{fmt(cb)}</div></div>
        <div className="kpi"><div className="label">{t("unrealized")}</div><div className="value" style={{ color: upl >= 0 ? "var(--pos)" : "var(--neg)" }}>{fmt(upl)}</div><div className="sub"><span className={upl >= 0 ? "delta-pos" : "delta-neg"}>{fmtPct(p.unrealizedPct)}</span></div></div>
        <div className="kpi"><div className="label">{t("realized")}</div><div className="value">$0.00</div><div className="sub"><span>{locale === "es" ? "sin cierres" : "no closes"}</span></div></div>
      </div>

      <div className="detail-grid">
        <div>
          <div className="table-wrap">
            <div className="table-head"><h2>{t("history")}</h2><span className="mono subtle" style={{ fontSize: 11 }}>{txs.length} {locale === "es" ? "transacciones" : "transactions"}</span></div>
            <table className="data">
              <thead><tr><th>{t("date")}</th><th>{t("type")}</th><th className="num">{t("qty")}</th><th className="num">{t("price_usd")}</th><th className="num">FX</th><th className="num">{t("fees")}</th><th className="num">{t("total_mxn")}</th><th>{t("broker")}</th></tr></thead>
              <tbody>
                {txs.map(tx => (
                  <tr key={tx.id}>
                    <td className="mono">{fmtDate(tx.date, locale)}</td>
                    <td><span className={"chip " + (tx.type === "BUY" ? "chip-buy" : tx.type === "SELL" ? "chip-sell" : "chip-div")}>{tx.type}</span></td>
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
        </div>
        <div className="info-rows">
          <div style={{ fontSize: 11, color: "var(--fg-subtle)", textTransform: "uppercase", letterSpacing: ".12em", fontWeight: 600, marginBottom: 8 }}>{t("overview")}</div>
          <div className="ir"><span className="k">{t("sector")}</span><span className="v">{p.sector}</span></div>
          <div className="ir"><span className="k">{t("exchange")}</span><span className="v">{p.exchange}</span></div>
          <div className="ir"><span className="k">{t("isin")}</span><span className="v">{p.isin}</span></div>
          <div className="ir"><span className="k">{t("currency")}</span><span className="v">USD</span></div>
          <div className="ir"><span className="k">{t("first_buy")}</span><span className="v">{fmtDate(txs[txs.length-1]?.date || "2024-08-22", locale)}</span></div>
          <div className="ir"><span className="k">{t("last_buy")}</span><span className="v">{fmtDate(txs[0]?.date || "2026-05-04", locale)}</span></div>
          <div className="ir"><span className="k">{t("avg_holding")}</span><span className="v">428 {t("days")}</span></div>
          <div className="ir"><span className="k">{locale === "es" ? "Dividendos YTD" : "Dividends YTD"}</span><span className="v">$10.80</span></div>
        </div>
      </div>
    </main>
  );
}
