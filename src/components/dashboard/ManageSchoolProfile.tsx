"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import toast from "react-hot-toast";
import { SUPPORTED_CURRENCIES } from "@/lib/money";
import { invalidateSchoolSettings } from "@/lib/hooks/useSchoolSettings";
import { useT } from "@/components/i18n/LocaleProvider";

type SchoolForm = {
  id: string;
  name: string;
  logo_url: string;
  address: string;
  phone: string;
  email: string;
  motto: string;
  principal_name: string;
  established_year: string;
  currency: string;
  library_fine_per_day: string;
  library_loan_days: string;
  library_max_loans: string;
};

const emptyForm: SchoolForm = {
  id: "",
  name: "",
  logo_url: "",
  address: "",
  phone: "",
  email: "",
  motto: "",
  principal_name: "",
  established_year: "",
  currency: "NGN",
  library_fine_per_day: "50",
  library_loan_days: "14",
  library_max_loans: "3",
};

export function ManageSchoolProfile() {
  const { t } = useT();
  const [form, setForm] = useState<SchoolForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSchool();
  }, []);

  const fetchSchool = async () => {
    setLoading(true);
    // No explicit filter needed: schools_select_authenticated already scopes
    // this to the caller's own school (id = current_school_id()).
    const { data, error } = await supabase
      .from("schools")
      .select("id, name, logo_url, address, phone, email, motto, principal_name, established_year, currency, library_fine_per_day, library_loan_days, library_max_loans")
      .maybeSingle();
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    if (data) {
      setForm({
        id: data.id,
        name: data.name || "",
        logo_url: data.logo_url || "",
        address: data.address || "",
        phone: data.phone || "",
        email: data.email || "",
        motto: data.motto || "",
        principal_name: data.principal_name || "",
        established_year: data.established_year != null ? String(data.established_year) : "",
        currency: data.currency || "NGN",
        library_fine_per_day: String(data.library_fine_per_day ?? 50),
        library_loan_days: String(data.library_loan_days ?? 14),
        library_max_loans: String(data.library_max_loans ?? 3),
      });
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.id) {
      toast.error("No school found to update");
      return;
    }
    if (!form.name.trim()) {
      toast.error("School name is required");
      return;
    }

    let establishedYear: number | null = null;
    if (form.established_year.trim()) {
      establishedYear = Number(form.established_year);
      if (!Number.isInteger(establishedYear) || establishedYear < 1600 || establishedYear > 2100) {
        toast.error("Enter a valid established year (e.g. 1998)");
        return;
      }
    }

    setSaving(true);
    const { error } = await supabase
      .from("schools")
      .update({
        name: form.name.trim(),
        logo_url: form.logo_url.trim() || null,
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        motto: form.motto.trim() || null,
        principal_name: form.principal_name.trim() || null,
        established_year: establishedYear,
        currency: form.currency,
        library_fine_per_day: Math.max(0, Number(form.library_fine_per_day) || 0),
        library_loan_days: Math.max(1, Math.floor(Number(form.library_loan_days) || 14)),
        library_max_loans: Math.max(1, Math.floor(Number(form.library_max_loans) || 3)),
      })
      .eq("id", form.id);
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    invalidateSchoolSettings();
    toast.success("School profile updated");
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("page.school.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("page.school.subtitle")}
        </p>
      </div>

      <form
        onSubmit={submit}
        className="grid gap-4 rounded-xl border border-border bg-card/80 p-6 shadow-soft md:grid-cols-2"
      >
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">School name</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Currency</label>
          <select
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Library: fine per overdue day</label>
          <input type="number" min={0} value={form.library_fine_per_day} onChange={(e) => setForm({ ...form, library_fine_per_day: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Library: loan period (days)</label>
            <input type="number" min={1} value={form.library_loan_days} onChange={(e) => setForm({ ...form, library_loan_days: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Library: max books per student</label>
            <input type="number" min={1} value={form.library_max_loans} onChange={(e) => setForm({ ...form, library_max_loans: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Logo URL (https)</label>
          <input
            value={form.logo_url}
            onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
            placeholder="https://..."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>

        <div className="space-y-1 md:col-span-2">
          <label className="text-xs text-muted-foreground">Address</label>
          <input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Phone</label>
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Email</label>
          <input
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>

        <div className="space-y-1 md:col-span-2">
          <label className="text-xs text-muted-foreground">Motto / tagline</label>
          <input
            value={form.motto}
            onChange={(e) => setForm({ ...form, motto: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Principal / head teacher name</label>
          <input
            value={form.principal_name}
            onChange={(e) => setForm({ ...form, principal_name: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Established year</label>
          <input
            type="number"
            min="1600"
            max="2100"
            value={form.established_year}
            onChange={(e) => setForm({ ...form, established_year: e.target.value })}
            placeholder="e.g. 1998"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>

        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save school profile"}
          </button>
        </div>
      </form>

      {form.logo_url && (
        <div className="rounded-xl border border-border bg-card/80 p-4">
          <p className="mb-2 text-xs text-muted-foreground">Logo preview</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={form.logo_url} alt="School logo" className="max-h-24 rounded bg-white p-2" />
        </div>
      )}
    </div>
  );
}
