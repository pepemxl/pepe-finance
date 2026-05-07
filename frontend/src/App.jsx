import React, { useEffect, useState } from "react";
import { useLocale, useTheme, useCurrency } from "./lib/hooks.js";
import { loadPortfolio } from "./lib/portfolio.js";
import { TopBar, Sidebar, StatusBar } from "./components/Shell.jsx";
import { Dashboard, HoldingsTable } from "./components/Dashboard.jsx";
import {
  BuyForm, SellForm, TransactionsList, ImportCSV, TaxReport, StockDetail,
} from "./components/Screens.jsx";

export default function App() {
  const { locale, setLocale, t } = useLocale();
  const { theme, setTheme } = useTheme();
  const { primary: currency, setPrimary: setCurrency } = useCurrency();
  const [route, setRoute] = useState("dashboard");
  const [data, setData] = useState(null);

  useEffect(() => { loadPortfolio().then(setData); }, []);

  if (!data) {
    return <div style={{ padding: 40, fontFamily: "var(--font-sans)" }}>Loading…</div>;
  }

  const { positions, transactions, realized, allocation, performance, taxBreakdown, fxRate } = data;

  let screen;
  if (route === "dashboard") {
    screen = <Dashboard t={t} locale={locale} currency={currency} setRoute={setRoute}
              positions={positions} transactions={transactions} realized={realized}
              allocation={allocation} performance={performance}
              taxBreakdown={taxBreakdown} fxRate={fxRate} />;
  } else if (route === "holdings") {
    screen = (
      <main className="main">
        <div className="page-head">
          <div>
            <h1>{t("holdings")}</h1>
            <div className="sub">{positions.length} {locale === "es" ? "posiciones activas" : "open positions"}</div>
          </div>
          <div className="actions">
            <button className="btn btn-sm" onClick={() => setRoute("buy")}>+ {t("new_purchase")}</button>
          </div>
        </div>
        <HoldingsTable t={t} locale={locale} currency={currency} setRoute={setRoute} positions={positions} />
      </main>
    );
  } else if (route === "transactions") {
    screen = <TransactionsList t={t} locale={locale} setRoute={setRoute} transactions={transactions} />;
  } else if (route === "buy") {
    screen = <BuyForm t={t} locale={locale} setRoute={setRoute} fxRate={fxRate} />;
  } else if (route === "sell") {
    screen = <SellForm t={t} locale={locale} setRoute={setRoute} fxRate={fxRate} />;
  } else if (route === "taxes") {
    screen = <TaxReport t={t} locale={locale} setRoute={setRoute} taxBreakdown={taxBreakdown} realized={realized} />;
  } else if (route === "import") {
    screen = <ImportCSV t={t} locale={locale} setRoute={setRoute} />;
  } else if (route.startsWith("detail:")) {
    screen = <StockDetail t={t} locale={locale} currency={currency} setRoute={setRoute}
              ticker={route.split(":")[1]} positions={positions} transactions={transactions} />;
  } else {
    screen = <div style={{ padding: 40 }}>404</div>;
  }

  return (
    <div className="app" data-screen-label={"Route: " + route}>
      <TopBar locale={locale} setLocale={setLocale} theme={theme} setTheme={setTheme}
              currency={currency} setCurrency={setCurrency} fxRate={fxRate} />
      <Sidebar route={route} setRoute={setRoute} t={t} locale={locale}
               positions={positions} transactions={transactions} fxRate={fxRate} />
      {screen}
      <StatusBar locale={locale} positions={positions} transactions={transactions} />
    </div>
  );
}
