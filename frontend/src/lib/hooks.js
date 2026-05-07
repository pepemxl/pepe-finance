import { useState, useEffect, useMemo } from "react";
import { i18n } from "./i18n.js";

export function useLocale() {
  const [locale, setLocale] = useState(() => localStorage.getItem("fs_locale") || "es");
  useEffect(() => { localStorage.setItem("fs_locale", locale); }, [locale]);
  const t = useMemo(() => (k) => (i18n[locale][k] ?? k), [locale]);
  return { locale, setLocale, t };
}

export function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem("fs_theme") || "light");
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("fs_theme", theme);
  }, [theme]);
  return { theme, setTheme };
}

export function useCurrency() {
  const [primary, setPrimary] = useState(() => localStorage.getItem("fs_currency") || "MXN");
  useEffect(() => { localStorage.setItem("fs_currency", primary); }, [primary]);
  return { primary, setPrimary };
}
