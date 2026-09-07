"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { BarChart3 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getLetterGrade } from "@/lib/grading";
import { useCurrentProfile } from "@/lib/hooks/useCurrentProfile";
import { RestrictedNotice } from "@/components/dashboard/RestrictedNotice";
import { EmptyState } from "@/components/ui/empty-state";
import { exportCsv, exportPdf, exportXlsx, type ExportColumn } from "@/lib/client/exportTable";
import { ReportsNav } from "@/components/dashboard/ReportsNav";
import { useSchoolSettings } from "@/lib/hooks/useSchoolSettings";
import { useT } from "@/components/i18n/LocaleProvider";

interface ResultRecord {
  ca_score: number | null;
  exam_score: number | null;
  total_score: number;
  students?: { full_name?: string } | null;
  subjects?: { name?: string } | null;
}

interface TermOption {
  id: string;
  name: string;
  sessions?: { name?: string } | null;
}

type Row = { student: string; subject: string; ca: number | null; exam: number | null; total: number; grade: string };

export default function GradesReport() {
  const { t } = useT();
  const { profile, loading: profileLoading } = useCurrentProfile();
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [terms, setTerms] = useState<TermOption[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("");
  const [records, setRecords] = useState<ResultRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [view, setView] = useState<"detail" | "summary">("summary");
  const { settings } = useSchoolSettings();
  const grading = settings.grading;

  const isStaff = profile?.role === "admin" || profile?.role === "teacher";

  useEffect(() => {
    if (!isStaff) return;
    supabase.from("classes").select("id, name").order("name").then(({ data }) => setClasses(data || []));
    supabase
      .from("terms")
      .select("id, name, sessions(name)")
      .order("start_date", { ascending: false })
      .then(({ data }) => setTerms((data as any) || []));
  }, [isStaff]);

  const fetchReport = async () => {
    if (!selectedClass || !selectedTerm) return toast.error("Select a class and term");
    setLoading(true);
    const { data, error } = await supabase
      .from("results")
      .select("ca_score, exam_score, total_score, students(full_name), subjects(name)")
      .eq("class_id", selectedClass)
      .eq("term_id", selectedTerm);
    setLoading(false);
    setGenerated(true);
    if (error) return toast.error(error.message);
    setRecords((data as any) || []);
  };

  const termLabel = useMemo(() => {
    const t = terms.find((term) => term.id === selectedTerm);
    return t ? (t.sessions?.name ? `${t.sessions.name} — ${t.name}` : t.name) : "";
  }, [terms, selectedTerm]);
  const classLabel = classes.find((c) => c.id === selectedClass)?.name || "";

  const rows: Row[] = useMemo(
    () =>
      records
        .map((r) => ({
          student: r.students?.full_name || "-",
          subject: r.subjects?.name || "-",
          ca: r.ca_score,
          exam: r.exam_score,
          total: Number(r.total_score || 0),
          grade: getLetterGrade(Number(r.total_score || 0), grading),
        }))
        .sort((a, b) => a.student.localeCompare(b.student) || a.subject.localeCompare(b.subject)),
    [records, grading]
  );

  // Per-student summary with average and position.
  const summary = useMemo(() => {
    const byStudent = new Map<string, number[]>();
    for (const r of rows) (byStudent.get(r.student) ?? byStudent.set(r.student, []).get(r.student)!).push(r.total);
    const list = Array.from(byStudent.entries()).map(([student, totals]) => ({
      student,
      subjects: totals.length,
      total: totals.reduce((a, b) => a + b, 0),
      average: Math.round((totals.reduce((a, b) => a + b, 0) / totals.length) * 10) / 10,
    }));
    list.sort((a, b) => b.average - a.average);
    return list.map((s) => ({ ...s, position: list.filter((o) => o.average > s.average).length + 1, grade: getLetterGrade(s.average, grading) }));
  }, [rows, grading]);

  const detailColumns: ExportColumn<Row>[] = [
    { header: "Student", value: (r) => r.student },
    { header: "Subject", value: (r) => r.subject },
    { header: "CA", value: (r) => r.ca },
    { header: "Exam", value: (r) => r.exam },
    { header: "Total", value: (r) => r.total },
    { header: "Grade", value: (r) => r.grade },
  ];
  const summaryColumns: ExportColumn<(typeof summary)[number]>[] = [
    { header: "Position", value: (r) => r.position },
    { header: "Student", value: (r) => r.student },
    { header: "Subjects", value: (r) => r.subjects },
    { header: "Total", value: (r) => r.total },
    { header: "Average", value: (r) => r.average },
    { header: "Grade", value: (r) => r.grade },
  ];

  const fileBase = `grades-${classLabel}-${termLabel}`.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const title = `Grades report — ${classLabel}`;

  if (profileLoading) return <p className="text-sm text-muted-foreground">Loading...</p>;
  if (!isStaff) return <RestrictedNotice message="Reports are available to admins and teachers." />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">{t("page.reports.grades.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("page.reports.grades.subtitle")}</p>
      </div>
      <ReportsNav />

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card/80 p-4 shadow-soft">
        <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
          <option value="">Select class</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
          <option value="">Select term</option>
          {terms.map((t) => (
            <option key={t.id} value={t.id}>{t.sessions?.name ? `${t.sessions.name} — ${t.name}` : t.name}</option>
          ))}
        </select>
        <button onClick={fetchReport} disabled={loading} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {loading ? t("common.loading") : t("common.generate")}
        </button>
        {rows.length > 0 && (
          <div className="ml-auto flex flex-wrap gap-2">
            <div className="flex rounded-md border border-input text-xs">
              <button onClick={() => setView("summary")} className={`px-3 py-2 ${view === "summary" ? "bg-white/10" : ""}`}>Summary</button>
              <button onClick={() => setView("detail")} className={`px-3 py-2 ${view === "detail" ? "bg-white/10" : ""}`}>Per subject</button>
            </div>
            <button onClick={() => (view === "summary" ? exportPdf(summary, summaryColumns, `${fileBase}.pdf`, title, termLabel) : exportPdf(rows, detailColumns, `${fileBase}.pdf`, title, termLabel))} className="rounded-md bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground">PDF</button>
            <button onClick={() => (view === "summary" ? exportXlsx(summary, summaryColumns, `${fileBase}.xlsx`, "Summary") : exportXlsx(rows, detailColumns, `${fileBase}.xlsx`, "Results"))} className="rounded-md bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground">Excel</button>
            <button onClick={() => (view === "summary" ? exportCsv(summary, summaryColumns, `${fileBase}.csv`) : exportCsv(rows, detailColumns, `${fileBase}.csv`))} className="rounded-md bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground">CSV</button>
          </div>
        )}
      </div>

      {!generated ? (
        <EmptyState icon={<BarChart3 size={20} />} title="Choose a class and term" description="Then click Generate to build the report." />
      ) : rows.length === 0 ? (
        <EmptyState icon={<BarChart3 size={20} />} title="No results for this selection" description="Scores entered for this class and term will appear here." />
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
                    <td className="p-3">{s.position}</td>
                    <td className="p-3 font-medium">{s.student}</td>
                    <td className="p-3">{s.subjects}</td>
                    <td className="p-3">{s.total}</td>
                    <td className="p-3">{s.average}</td>
                    <td className="p-3">{s.grade}</td>
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
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-border/60">
                    <td className="p-3 font-medium">{r.student}</td>
                    <td className="p-3">{r.subject}</td>
                    <td className="p-3">{r.ca ?? "-"}</td>
                    <td className="p-3">{r.exam ?? "-"}</td>
                    <td className="p-3">{r.total}</td>
                    <td className="p-3">{r.grade}</td>
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
