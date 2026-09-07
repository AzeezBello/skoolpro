"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { LOCALES, translate, type Locale, type MessageKey } from "@/lib/i18n/dictionaries";

const KEY = "skoolpro-locale";

type Ctx = { locale: Locale; setLocale: (l: Locale) => void; t: (key: MessageKey, vars?: Record<string, string | number>) => string };

const LocaleContext = createContext<Ctx>({ locale: "en", setLocale: () => {}, t: (k, v) => translate("en", k, v) });

function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY);
      if (isLocale(stored)) {
        setLocaleState(stored);
        document.documentElement.lang = stored;
        return;
      }
      const browser = navigator.language.slice(0, 2);
      if (isLocale(browser)) {
        setLocaleState(browser);
        document.documentElement.lang = browser;
      }
    } catch {
      // ignore
    }
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    document.documentElement.lang = l;
    try {
      localStorage.setItem(KEY, l);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo<Ctx>(() => ({ locale, setLocale, t: (k, v) => translate(locale, k, v) }), [locale, setLocale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useT() {
  return useContext(LocaleContext);
}
