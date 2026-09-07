"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { DEFAULT_GRADING, parseGradingConfig, type GradingConfig } from "@/lib/grading";

export type LibrarySettings = { finePerDay: number; loanDays: number; maxLoans: number };
export type SchoolSettings = { id: string | null; name: string; currency: string; grading: GradingConfig; library: LibrarySettings };

const DEFAULT_LIBRARY: LibrarySettings = { finePerDay: 50, loanDays: 14, maxLoans: 3 };
const FALLBACK: SchoolSettings = { id: null, name: "SkoolPro", currency: "NGN", grading: DEFAULT_GRADING, library: DEFAULT_LIBRARY };

let cache: SchoolSettings | null = null;

// The caller's own school (RLS scopes the select), cached per page load so
// many components can read currency/grading without repeated queries.
export function useSchoolSettings() {
  const [settings, setSettings] = useState<SchoolSettings>(cache ?? FALLBACK);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    if (cache) return;
    let mounted = true;
    supabase
      .from("schools")
      .select("id, name, currency, grading_config, library_fine_per_day, library_loan_days, library_max_loans")
      .maybeSingle()
      .then(({ data }) => {
        if (!mounted) return;
        const next: SchoolSettings = data
          ? {
              id: data.id,
              name: data.name,
              currency: data.currency || "NGN",
              grading: parseGradingConfig(data.grading_config),
              library: {
                finePerDay: Number(data.library_fine_per_day ?? DEFAULT_LIBRARY.finePerDay),
                loanDays: Number(data.library_loan_days ?? DEFAULT_LIBRARY.loanDays),
                maxLoans: Number(data.library_max_loans ?? DEFAULT_LIBRARY.maxLoans),
              },
            }
          : FALLBACK;
        cache = next;
        setSettings(next);
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return { settings, loading, refresh: () => { cache = null; } };
}

export function invalidateSchoolSettings() {
  cache = null;
}
