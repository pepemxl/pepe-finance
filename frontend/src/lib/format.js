export const fmtMXN = (n, opts = {}) => {
  const v = n ?? 0;
  const sign = v < 0 ? "−" : "";
  const abs = Math.abs(v);
  return (opts.signed && v >= 0 ? "+" : sign) +
    "$" + abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const fmtUSD = (n) => {
  const v = n ?? 0;
  const sign = v < 0 ? "−" : "";
  return sign + "$" + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const fmtPct = (n, d = 2) => {
  const v = n ?? 0;
  const sign = v >= 0 ? "+" : "−";
  return sign + Math.abs(v).toFixed(d) + "%";
};

export const fmtNum = (n, d = 2) =>
  (n ?? 0).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

export const fmtFixed = (n, d = 4) => (n ?? 0).toFixed(d);

export const fmtDate = (iso, locale = "es") =>
  new Date(iso).toLocaleDateString(locale === "es" ? "es-MX" : "en-US",
    { year: "numeric", month: "short", day: "2-digit" });

export const fmtDateLong = (iso, locale = "es") =>
  new Date(iso).toLocaleDateString(locale === "es" ? "es-MX" : "en-US",
    { year: "numeric", month: "long", day: "2-digit" });
