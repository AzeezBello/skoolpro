"use client";

import { Languages } from "lucide-react";
import { LOCALES, LOCALE_NAMES } from "@/lib/i18n/dictionaries";
import { useT } from "@/components/i18n/LocaleProvider";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useT();
  return (
    <label className="flex items-center gap-1 text-xs" title={t("common.language")}>
      <Languages size={14} className="opacity-70" />
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as typeof locale)}
        aria-label={t("common.language")}
        className={`rounded-md border border-border bg-transparent px-1 py-1 text-xs ${compact ? "w-16" : ""}`}
      >
        {LOCALES.map((l) => (
          <option key={l} value={l} className="text-black">
            {compact ? l.toUpperCase() : LOCALE_NAMES[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
