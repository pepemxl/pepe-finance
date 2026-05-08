import React, { useState } from "react";
import { fmtMXN, fmtUSD, fmtPct, fmtDate } from "../lib/format.js";

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
                <button style={{ padding: "5px 16px" }}>{t("dividend")}</button>
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

export function SellForm({ t, locale, setRoute, fxRate }) {
  const [qty, setQty] = useState(5);
  const [price, setPrice] = useState(214.32);
  const [fx, setFx] = useState(fxRate);
  const [comm, setComm] = useState(0.0025);
  const [iva, setIva] = useState(0.16);

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

  return (
    <main className="main">
      <div className="page-head">
        <div>
          <h1>{t("new_sale")}</h1>
          <div className="sub">{locale === "es" ? "Registrar venta — método FIFO" : "Record disposal — FIFO method"}</div>
        </div>
        <div className="actions">
          <button className="btn btn-sm" onClick={() => setRoute("dashboard")}>{t("cancel")}</button>
          <button className="btn btn-primary btn-sm" onClick={() => setRoute("transactions")}>{t("save")}</button>
        </div>
      </div>

      <div className="form-wrap">
        <div className="form-main">
          <div className="form-section">
            <h3>{locale === "es" ? "Información básica" : "Basic info"}</h3>
            <div className="form-row"><label>{t("transaction_type")}</label>
              <div className="tabs" style={{ width: "fit-content" }}>
                <button style={{ padding: "5px 16px" }} onClick={() => setRoute("buy")}>{t("purchase")}</button>
                <button className="active" style={{ padding: "5px 16px" }}>{t("sale")}</button>
                <button style={{ padding: "5px 16px" }}>{t("dividend")}</button>
              </div>
            </div>
            <div className="form-row"><label>{t("date")}</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                <input defaultValue="2026" /><input defaultValue="05" /><input defaultValue="06" />
              </div>
            </div>
            <div className="form-row"><label>{t("instrument")}</label><input defaultValue="AAPL · Apple Inc." /></div>
            <div className="form-row"><label>{t("broker")}</label>
              <select><option>GBM+</option><option>Kuspit</option></select>
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

export function ImportCSV({ t, locale, setRoute }) {
  return (
    <main className="main">
      <div className="page-head">
        <div>
          <h1>{t("import")}</h1>
          <div className="sub">{locale === "es" ? "Importa transacciones desde tu broker" : "Import transactions from your broker"}</div>
        </div>
        <div className="actions">
          <button className="btn btn-sm" onClick={() => setRoute("transactions")}>{t("cancel")}</button>
        </div>
      </div>

      <div style={{ padding: 24, maxWidth: 900 }}>
        <div className="dropzone">
          <div style={{ fontSize: 28, marginBottom: 8 }}>↑</div>
          <strong>{locale === "es" ? "Arrastra tu archivo CSV aquí" : "Drop your CSV file here"}</strong>
          <div style={{ marginTop: 4 }}>{locale === "es" ? "o" : "or"} <span style={{ color: "var(--accent)", textDecoration: "underline", cursor: "pointer" }}>{locale === "es" ? "selecciona un archivo" : "browse files"}</span></div>
          <div style={{ marginTop: 12, fontSize: 11 }}>{locale === "es" ? "Formatos soportados: GBM+, Kuspit, Banorte, IBKR, formato genérico" : "Supported: GBM+, Kuspit, Banorte, IBKR, generic format"}</div>
        </div>

        <div className="calc-card" style={{ marginTop: 16 }}>
          <h4>{locale === "es" ? "Mapeo de columnas" : "Column mapping"}</h4>
          <table className="data" style={{ marginTop: 6 }}>
            <thead><tr><th>{locale === "es" ? "Campo destino" : "Target field"}</th><th>{locale === "es" ? "Columna CSV" : "CSV column"}</th><th>{locale === "es" ? "Vista previa" : "Preview"}</th></tr></thead>
            <tbody>
              <tr><td>date</td><td className="mono">Settlement Date</td><td className="mono subtle">2026-04-28</td></tr>
              <tr><td>ticker</td><td className="mono">Symbol</td><td className="mono subtle">TSLA</td></tr>
              <tr><td>type</td><td className="mono">Action</td><td className="mono subtle">SELL</td></tr>
              <tr><td>quantity</td><td className="mono">Qty</td><td className="mono subtle">10</td></tr>
              <tr><td>priceUSD</td><td className="mono">Price</td><td className="mono subtle">204.50</td></tr>
              <tr><td>fxRate</td><td className="mono">FX</td><td className="mono subtle">17.38</td></tr>
              <tr><td>fees</td><td className="mono">Commission</td><td className="mono subtle">156.40</td></tr>
            </tbody>
          </table>
          <div className="flex gap-8" style={{ marginTop: 12, justifyContent: "flex-end" }}>
            <button className="btn btn-sm">{locale === "es" ? "Validar" : "Validate"}</button>
            <button className="btn btn-primary btn-sm">{locale === "es" ? "Importar 24 registros" : "Import 24 rows"}</button>
          </div>
        </div>
      </div>
    </main>
  );
}

export function TaxReport({ t, locale, taxBreakdown, realized }) {
  const tb = taxBreakdown;
  const netGain = tb.shortTermGain + tb.longTermGain - tb.shortTermLoss - tb.longTermLoss;
  const taxOwed = Math.max(0, netGain) * tb.rateApplied;

  return (
    <main className="main">
      <div className="page-head">
        <div>
          <h1>{t("taxes")}</h1>
          <div className="sub">{t("fiscal_year")} {tb.year} · {locale === "es" ? "Persona física, ISR sobre enajenación" : "Individual, capital gains ISR"}</div>
        </div>
        <div className="actions">
          <select className="btn btn-sm" style={{ padding: "4px 8px" }}><option>2026</option><option>2025</option><option>2024</option></select>
          <button className="btn btn-sm">{t("export_csv")}</button>
          <button className="btn btn-primary btn-sm">{t("export_pdf")}</button>
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
        <div className="table-head"><h2>{locale === "es" ? "Operaciones cerradas — " : "Realized closes — "} {tb.year}</h2><span className="mono subtle" style={{ fontSize: 11 }}>FIFO</span></div>
        <table className="data">
          <thead><tr><th>{locale === "es" ? "Cierre" : "Close"}</th><th>{locale === "es" ? "Apertura" : "Open"}</th><th>{t("ticker")}</th><th className="num">{t("qty")}</th><th className="num">{locale === "es" ? "Producto" : "Proceeds"}</th><th className="num">{t("cost_basis")}</th><th className="num">{t("realized_gain")}</th><th>{t("holding_period")}</th><th>{locale === "es" ? "Tipo" : "Type"}</th><th className="num">{t("isr_due")}</th></tr></thead>
          <tbody>
            {realized.map((r, i) => (
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
