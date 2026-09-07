"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { CalendarCheck } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentProfile } from "@/lib/hooks/useCurrentProfile";
import { RestrictedNotice } from "@/components/dashboard/RestrictedNotice";
import { EmptyState } from "@/components/ui/empty-state";
import { exportCsv, exportPdf, exportXlsx, type ExportColumn } from "@/lib/client/exportTable";
import { ReportsNav } from "@/components/dashboard/ReportsNav";
import { useT } from "@/components/i18n/LocaleProvider";

type Record_ = { date: string; status: string; note: string | null; student_id: string; students?: { full_name?: string } | null };
type Summary = { student: string; present: number; absent: number; late: number; excused: number; total: number; rate: number };

function firstOfMonth() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

export default function AttendanceReport() {
  const { t } = useT();
  const { profile, loading: profileLoading } = useCurrentProfile();
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [records, setRecords] = useState<Record_[]>([]);
  const [dateRange, setDateRange] = useState({ start: firstOfMonth(), end: new Date().toISOString().slice(0, 10) });
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [view, setView] = useState<"summary" | "detail">("summary");

  const isStaff = profile?.role === "admin" || profile?.role === "teacher";

  useEffect(() => {
    if (!isStaff) return;
    supabase.from("classes").select("id, name").order("name").then(({ data }) => setClasses(data || []));
  }, [isStaff]);

  const fetchReport = async () => {
    if (!selectedClass || !dateRange.start || !dateRange.end) return toast.error("Select a class and date range");
    setLoading(true);
    const { data, error } = await supabase
      .from("attendance")
      .select("date, status, note, student_id, students(full_name)")
      .eq("class_id", selectedClass)
      .gte("date", dateRange.start)
      .lte("date", dateRange.end)
      .order("date", { ascending: false });
    setLoading(false);
    setGenerated(true);
    if (error) return toast.error(error.message);
    setRecords((data as any) || []);
  };

  const summary: Summary[] = useMemo(() => {
    const map = new Map<string, Summary>();
    for (const r of records) {
      const name = r.students?.full_name || r.student_id;
      const s = map.get(name) ?? { student: name, present: 0, absent: 0, late: 0, excused: 0, total: 0, rate: 0 };
      const status = String(r.status).toLowerCase() as keyof Summary;
      if (status in s && typeof s[status] === "number") (s as any)[status] += 1;
      s.total += 1;
      map.set(name, s);
    }
    return Array.from(map.values())
      .map((s) => ({ ...s, rate: s.total ? Math.round(((s.present + s.late) / s.total) * 100) : 0 }))
      .sort((a, b) => a.student.localeCompare(b.student));
  }, [records]);

  const classLabel = classes.find((c) => c.id === selectedClass)?.name || "";
  const fileBase = `attendance-${classLabel}-${dateRange.start}-${dateRange.end}`.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const title = `Attendance report — ${classLabel}`;
  const subtitle = `${dateRange.start} to ${dateRange.end}`;

  const detailColumns: ExportColumn<Record_>[] = [
    { header: "Date", value: (r) => r.date },
    { header: "Student", value: (r) => r.students?.full_name || "-" },
    { header: "Status", value: (r) => r.status },
    { header: "Note", value: (r) => r.note || "" },
  ];
  const summaryColumns: ExportColumn<Summary>[] = [
    { header: "Student", value: (r) => r.student },
    { header: "Present", value: (r) => r.present },
    { header: "Late", value: (r) => r.late },
    { header: "Absent", value: (r) => r.absent },
    { header: "Excused", value: (r) => r.excused },
    { header: "Days", value: (r) => r.total },
    { header: "Rate %", value: (r) => r.rate },
  ];

  if (profileLoading) return <p className="text-sm text-muted-foreground">Loading...</p>;
  if (!isStaff) return <RestrictedNotice message="Reports are available to admins and teachers." />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">{t("page.reports.attendance.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("page.reports.attendance.subtitle")}</p>
      </div>
      <ReportsNav />

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card/80 p-4 shadow-soft">
        <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
          <option value="">Select class</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <input type="date" value={dateRange.start} onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
        <input type="date" value={dateRange.end} onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
        <button onClick={fetchReport} disabled={loading} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {loading ? t("common.loading") : t("common.generate")}
        </button>
        {records.length > 0 && (
          <div className="ml-auto flex flex-wrap gap-2">
            <div className="flex rounded-md border border-input text-xs">
              <button onClick={() => setView("summary")} className={`px-3 py-2 ${view === "summary" ? "bg-white/10" : ""}`}>Summary</button>
              <button onClick={() => setView("detail")} className={`px-3 py-2 ${view === "detail" ? "bg-white/10" : ""}`}>Daily</button>
            </div>
            <button onClick={() => (view === "summary" ? exportPdf(summary, summaryColumns, `${fileBase}.pdf`, title, subtitle) : exportPdf(records, detailColumns, `${fileBase}.pdf`, title, subtitle))} className="rounded-md bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground">PDF</button>
            <button onClick={() => (view === "summary" ? exportXlsx(summary, summaryColumns, `${fileBase}.xlsx`, "Summary") : exportXlsx(records, detailColumns, `${fileBase}.xlsx`, "Attendance"))} className="rounded-md bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground">Excel</button>
            <button onClick={() => (view === "summary" ? exportCsv(summary, summaryColumns, `${fileBase}.csv`) : exportCsv(records, detailColumns, `${fileBase}.csv`))} className="rounded-md bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground">CSV</button>
          </div>
        )}
      </div>

      {!generated ? (
        <EmptyState icon={<CalendarCheck size={20} />} title="Choose a class and date range" description="Then click Generate to build the report." />
      ) : records.length === 0 ? (
        <EmptyState icon={<CalendarCheck size={20} />} title="No attendance in this range" description="Marked attendance for this class will appear here." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card/80 shadow-soft">
          {view === "summary" ? (
            <table className="w-full text-left text-sm">
              <thead className="bg-secondary/40 text-muted-foreground">
                <tr>{summaryColumns.map((c) => <th key={c.header} className="p-3">{c.header}</th>)}</tr>
              </thead>
              <tbody>
                {summary.map((s) => (
                  <tr key={s.student} className="border-t border-border/60">
                    <td className="p-3 font-medium">{s.student}</td>
                    <td className="p-3">{s.present}</td>
                    <td className="p-3">{s.late}</td>
                    <td className="p-3">{s.absent}</td>
                    <td className="p-3">{s.excused}</td>
                    <td className="p-3">{s.total}</td>
                    <td className="p-3">{s.rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-secondary/40 text-muted-foreground">
                <tr>{detailColumns.map((c) => <th key={c.header} className="p-3">{c.header}</th>)}</tr>
              </thead>
              <tbody>
                {records.map((r, i) => (
                  <tr key={i} className="border-t border-border/60">
                    <td className="p-3">{r.date}</td>
                    <td className="p-3 font-medium">{r.students?.full_name}</td>
                    <td className="p-3 capitalize">{r.status}</td>
                    <td className="p-3 text-muted-foreground">{r.note || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
