"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Wallet } from "lucide-react";
import { authFetch } from "@/lib/client/authFetch";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentProfile } from "@/lib/hooks/useCurrentProfile";
import { RestrictedNotice } from "@/components/dashboard/RestrictedNotice";
import { EmptyState } from "@/components/ui/empty-state";
import { exportCsv, exportPdf, exportXlsx, type ExportColumn } from "@/lib/client/exportTable";
import { ReportsNav } from "@/components/dashboard/ReportsNav";
import { useSchoolSettings } from "@/lib/hooks/useSchoolSettings";
import { formatMoney } from "@/lib/money";
import { useT } from "@/components/i18n/LocaleProvider";

type Invoice = { id: string; reference: string; student_id: string; student_full_name: string; class_name: string | null; fee_name: string | null; total_amount: number; amount_paid: number; balance: number; status: string; due_date: string | null; parent_name?: string; parent_email?: string };
type Arrears = { student: string; className: string; invoices: number; billed: number; paid: number; balance: number; oldestDue: string | null; bucket: string; parent: string };

function bucketFor(due: string | null) {
  if (!due) return "No due date";
  const days = Math.floor((Date.now() - new Date(due).getTime()) / 86_400_000);
  if (days < 0) return "Not yet due";
  if (days <= 30) return "1–30 days";
  if (days <= 60) return "31–60 days";
  if (days <= 90) return "61–90 days";
  return "90+ days";
}

// Arrears / aging report: outstanding balance per student, grouped into
// aging buckets from the oldest unpaid due date.
export default function FeesReport() {
  const { t } = useT();
  const { profile, loading: profileLoading } = useCurrentProfile();
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [classId, setClassId] = useState("");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const { settings } = useSchoolSettings();
  const cur = settings.currency;

  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    if (!isAdmin) return;
    supabase.from("classes").select("id, name").order("name").then(({ data }) => setClasses(data || []));
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      setLoading(true);
      const all: Invoice[] = [];
      for (let page = 1; page <= 50; page++) {
        const params = new URLSearchParams({ page: String(page), pageSize: "100" });
        if (classId) params.set("classId", classId);
        const res = await authFetch(`/api/invoices?${params}`);
        const json = await res.json();
        if (!res.ok) {
          toast.error(json.error || "Could not load invoices");
          break;
        }
        all.push(...(json.data || []));
        if (page >= (json.meta?.totalPages || 1)) break;
      }
      setInvoices(all);
      setLoading(false);
    })();
  }, [isAdmin, classId]);

  const open = useMemo(() => invoices.filter((i) => i.status !== "cancelled" && Number(i.balance) > 0), [invoices]);

  const arrears: Arrears[] = useMemo(() => {
    const map = new Map<string, Arrears>();
    for (const inv of open) {
      const a = map.get(inv.student_id) ?? { student: inv.student_full_name, className: inv.class_name || "-", invoices: 0, billed: 0, paid: 0, balance: 0, oldestDue: null, bucket: "", parent: inv.parent_email || inv.parent_name || "" };
      a.invoices += 1;
      a.billed += Number(inv.total_amount || 0);
      a.paid += Number(inv.amount_paid || 0);
      a.balance += Number(inv.balance || 0);
      if (inv.due_date && (!a.oldestDue || inv.due_date < a.oldestDue)) a.oldestDue = inv.due_date;
      map.set(inv.student_id, a);
    }
    return Array.from(map.values())
      .map((a) => ({ ...a, bucket: bucketFor(a.oldestDue) }))
      .sort((a, b) => b.balance - a.balance);
  }, [open]);

  const totals = useMemo(() => {
    const buckets: Record<string, number> = {};
    for (const a of arrears) buckets[a.bucket] = (buckets[a.bucket] || 0) + a.balance;
    return { outstanding: arrears.reduce((s, a) => s + a.balance, 0), students: arrears.length, buckets };
  }, [arrears]);

  const columns: ExportColumn<Arrears>[] = [
    { header: "Student", value: (r) => r.student },
    { header: "Class", value: (r) => r.className },
    { header: "Open invoices", value: (r) => r.invoices },
    { header: "Billed", value: (r) => r.billed },
    { header: "Paid", value: (r) => r.paid },
    { header: "Balance", value: (r) => r.balance },
    { header: "Oldest due", value: (r) => r.oldestDue || "" },
    { header: "Aging", value: (r) => r.bucket },
    { header: "Parent contact", value: (r) => r.parent },
  ];
  const fileBase = `arrears-${classes.find((c) => c.id === classId)?.name || "all"}`.replace(/[^a-z0-9]+/gi, "-").toLowerCase();

  if (profileLoading) return <p className="text-sm text-muted-foreground">Loading...</p>;
  if (!isAdmin) return <RestrictedNotice message="Fee reports are available to school admins." />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">{t("page.reports.fees.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("page.reports.fees.subtitle")}</p>
      </div>
      <ReportsNav />

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card/80 p-4 shadow-soft">
        <select value={classId} onChange={(e) => setClassId(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
          <option value="">All classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {arrears.length > 0 && (
          <div className="ml-auto flex gap-2">
            <button onClick={() => exportPdf(arrears, columns, `${fileBase}.pdf`, "Fees & arrears", `Outstanding ${formatMoney(totals.outstanding, cur)}`)} className="rounded-md bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground">PDF</button>
            <button onClick={() => exportXlsx(arrears, columns, `${fileBase}.xlsx`, "Arrears")} className="rounded-md bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground">Excel</button>
            <button onClick={() => exportCsv(arrears, columns, `${fileBase}.csv`)} className="rounded-md bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground">CSV</button>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total outstanding" value={formatMoney(totals.outstanding, cur)} />
        <Stat label="Students owing" value={String(totals.students)} />
        {Object.entries(totals.buckets).sort().map(([k, v]) => (
          <Stat key={k} label={k} value={formatMoney(v, cur)} />
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : arrears.length === 0 ? (
        <EmptyState icon={<Wallet size={20} />} title="No outstanding balances" description="Every invoice in this selection is paid or cancelled." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card/80 shadow-soft">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary/40 text-muted-foreground">
              <tr>{columns.map((c) => <th key={c.header} className="p-3">{c.header}</th>)}</tr>
            </thead>
            <tbody>
              {arrears.map((a) => (
                <tr key={a.student + a.className} className="border-t border-border/60">
                  <td className="p-3 font-medium">{a.student}</td>
                  <td className="p-3">{a.className}</td>
                  <td className="p-3">{a.invoices}</td>
                  <td className="p-3">{formatMoney(a.billed, cur)}</td>
                  <td className="p-3">{formatMoney(a.paid, cur)}</td>
                  <td className="p-3 font-semibold">{formatMoney(a.balance, cur)}</td>
                  <td className="p-3 text-muted-foreground">{a.oldestDue || "-"}</td>
                  <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs ${a.bucket.startsWith("90") ? "bg-red-500/20 text-red-300" : a.bucket.startsWith("61") ? "bg-amber-500/20 text-amber-300" : "bg-white/10"}`}>{a.bucket}</span></td>
                  <td className="p-3 text-muted-foreground">{a.parent || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/80 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}
