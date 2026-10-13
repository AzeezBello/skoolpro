"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/hooks/useTheme";
import { useT } from "@/components/i18n/LocaleProvider";

export function ThemeToggle() {
  const { dark, toggle } = useTheme();
  const { t } = useT();
  const label = dark ? t("topbar.theme.light") : t("topbar.theme.dark");

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-full text-shell-foreground transition hover:bg-shell-hover"
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
