"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Baby, CalendarCheck, GraduationCap, Receipt } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { authFetch } from "@/lib/client/authFetch";
import { EmptyState } from "@/components/ui/empty-state";
import { getLetterGrade } from "@/lib/grading";
import { useSchoolSettings } from "@/lib/hooks/useSchoolSettings";
import { formatMoney } from "@/lib/money";
import { AnnouncementsPanel } from "@/components/dashboard/AnnouncementsPanel";
import { useT } from "@/components/i18n/LocaleProvider";

type Child = { id: string; full_name: string; status: string; classes?: { name?: string } | null };
type TermOption = { id: string; name: string; is_current?: boolean; sessions?: { name?: string; is_current?: boolean } | null };

export function ParentSelfView() {
  const { t } = useT();
  const [children, setChildren] = useState<Child[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [terms, setTerms] = useState<TermOption[]>([]);
  const [termId, setTermId] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { settings } = useSchoolSettings();

  useEffect(() => {
    (async () => {
      const [{ data: links, error }, { data: termData }] = await Promise.all([
        supabase.from("parent_students").select("student_id, students(id, full_name, status, classes(name))"),
        supabase.from("terms").select("id, name, is_current, sessions(name, is_current)").order("start_date", { ascending: false }),
      ]);
      setLoading(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      const kids = (links || []).map((l: any) => l.students).filter(Boolean) as Child[];
      setChildren(kids);
      setSelected(kids[0]?.id || "");

      const termList = (termData as any as TermOption[]) || [];
      setTerms(termList);
      setTermId(termList.find((t) => t.is_current)?.id || termList.find((t) => t.sessions?.is_current)?.id || termList[0]?.id || "");
    })();
  }, []);

  useEffect(() => {
    if (!selected) return;
    (async () => {
      const since = new Date();
      since.setDate(since.getDate() - 60);
      const [{ data: att }, res] = await Promise.all([
        supabase.from("attendance").select("date, status").eq("student_id", selected).gte("date", since.toISOString().slice(0, 10)).order("date", { ascending: false }),
        authFetch(`/api/invoices?studentId=${selected}&pageSize=50`),
      ]);
      setAttendance(att || []);
      const json = await res.json().catch(() => ({}));
      setInvoices(res.ok ? json.data || [] : []);
    })();
  }, [selected]);

  useEffect(() => {
    if (!selected || !termId) return;
    supabase
      .from("results")
      .select("ca_score, exam_score, total_score, subjects(name)")
      .eq("student_id", selected)
      .eq("term_id", termId)
      .then(({ data }) => setResults(data || []));
  }, [selected, termId]);

  const child = children.find((c) => c.id === selected);
  const attendanceRate = useMemo(() => {
    if (attendance.length === 0) return null;
    const present = attendance.filter((a) => ["present", "late"].includes(String(a.status).toLowerCase())).length;
    return Math.round((present / attendance.length) * 100);
  }, [attendance]);
  const outstanding = invoices.reduce((s, i) => s + (i.status === "cancelled" ? 0 : Number(i.balance || 0)), 0);

  if (loading) return <p className="text-sm text-muted-foreground">Loading...</p>;

  if (children.length === 0) {
    return (
      <EmptyState
        icon={<Baby size={20} />}
        title="No children linked to your account yet"
        description="Ask your school admin to link your account to your child's record under Team & Access."
      />
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">{t("page.children.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("page.children.subtitle")}</p>
        </div>
        {children.length > 1 && (
          <select value={selected} onChange={(e) => setSelected(e.target.value)} className="rounded border border-input bg-background px-3 py-2 text-sm">
            {children.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
              </option>
            ))}
          </select>
        )}
      </div>

      <AnnouncementsPanel />

      {child && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-card/80 p-4">
            <p className="text-xs text-muted-foreground">Child</p>
            <p className="text-lg font-semibold">{child.full_name}</p>
            <p className="text-sm text-muted-foreground">Class: {child.classes?.name || "Unassigned"}</p>
          </div>
          <div className="rounded-xl border border-border bg-card/80 p-4">
            <p className="text-xs text-muted-foreground">Attendance (last 60 days)</p>
            <p className="text-lg font-semibold">{attendanceRate === null ? "—" : `${attendanceRate}%`}</p>
            <p className="text-sm text-muted-foreground">{attendance.length} day(s) recorded</p>
          </div>
          <div className="rounded-xl border border-border bg-card/80 p-4">
            <p className="text-xs text-muted-foreground">Outstanding fees</p>
            <p className="text-lg font-semibold">{formatMoney(outstanding, settings.currency)}</p>
            <Link href="/dashboard/invoices" className="text-sm text-primary">
              View invoices &amp; pay
            </Link>
          </div>
        </div>
      )}

      <section className="rounded-xl border border-border bg-card/80 p-4 md:p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <GraduationCap size={18} /> Results
          </h2>
          <select value={termId} onChange={(e) => setTermId(e.target.value)} className="rounded border border-input bg-background px-3 py-2 text-sm">
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.sessions?.name ? `${t.sessions.name} — ${t.name}` : t.name}
              </option>
            ))}
          </select>
        </div>
        {results.length === 0 ? (
          <p className="text-sm text-muted-foreground">No results recorded for this term yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-muted-foreground">
              <tr>
                <th className="p-2">Subject</th>
                <th className="p-2">CA</th>
                <th className="p-2">Exam</th>
                <th className="p-2">Total</th>
                <th className="p-2">Grade</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i} className="border-t border-border/60">
                  <td className="p-2">{r.subjects?.name || "-"}</td>
                  <td className="p-2">{r.ca_score ?? "-"}</td>
                  <td className="p-2">{r.exam_score ?? "-"}</td>
                  <td className="p-2">{r.total_score}</td>
                  <td className="p-2">{getLetterGrade(Number(r.total_score), settings.grading)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card/80 p-4 md:p-6">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <CalendarCheck size={18} /> Recent attendance
        </h2>
        {attendance.length === 0 ? (
          <p className="text-sm text-muted-foreground">No attendance recorded in the last 60 days.</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {attendance.slice(0, 40).map((a) => (
              <span
                key={a.date}
                title={`${a.date}: ${a.status}`}
                className={`rounded px-2 py-1 text-xs capitalize ${
                  a.status === "present" ? "bg-green-500/20 text-green-300" : a.status === "late" ? "bg-amber-500/20 text-amber-300" : a.status === "excused" ? "bg-sky-500/20 text-sky-300" : "bg-red-500/20 text-red-300"
                }`}
              >
                {new Date(a.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {a.status}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card/80 p-4 md:p-6">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Receipt size={18} /> Invoices
        </h2>
        {invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">No invoices yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-muted-foreground">
              <tr>
                <th className="p-2">Fee</th>
                <th className="p-2">Balance</th>
                <th className="p-2">Status</th>
                <th className="p-2">Due</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-t border-border/60">
                  <td className="p-2">{inv.fee_name || inv.reference}</td>
                  <td className="p-2">{formatMoney(inv.balance || 0, settings.currency)}</td>
                  <td className="p-2 capitalize">{inv.status}</td>
                  <td className="p-2 text-muted-foreground">{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Link href="/dashboard/invoices" className="mt-3 inline-block text-sm text-primary">
          Go to invoices to pay online →
        </Link>
      </section>
    </div>
  );
}
