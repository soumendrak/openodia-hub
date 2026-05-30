/**
 * Minimal i18n scaffold for OpenOdia.
 *
 * Context-based, two locales (`en`, `or`), localStorage-persisted. Missing
 * Odia keys fall back to English so the site never shows raw key names.
 *
 * Why custom over react-i18next: this is intentionally a scaffold. The Odia
 * translation set is empty until a native speaker contributes; pulling in a
 * 30 KB i18n library to manage zero translations would be silly. Once real
 * Odia copy lands and we need plurals / interpolation / lazy loading, swap
 * the implementation behind useTranslation() without touching call sites.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { en } from "../locales/en";
import { or } from "../locales/or";

export type Locale = "en" | "or";
export type TranslationKey = keyof typeof en;

const STRINGS: Record<Locale, Partial<Record<TranslationKey, string>>> = { en, or };
const STORAGE_KEY = "locale";

type Ctx = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: TranslationKey) => string;
};

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "or") setLocaleState(stored);
    document.documentElement.lang = stored === "or" ? "or" : "en";
  }, []);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, l);
      document.documentElement.lang = l;
    }
  };

  const t = (key: TranslationKey): string => {
    return STRINGS[locale][key] ?? en[key];
  };

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useTranslation must be used within an I18nProvider");
  }
  return ctx;
}
