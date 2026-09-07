"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { CalendarCheck, Users } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { EmptyState } from "@/components/ui/empty-state";
import { useT } from "@/components/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/dictionaries";

type ClassOption = { id: string; name: string };
type Student = { id: string; full_name: string };
type Status = "present" | "absent" | "late" | "excused";

const STATUSES: Array<{ value: Status; label: MessageKey; className: string }> = [
  { value: "present", label: "attendance.present", className: "bg-green-500/20 text-green-300 ring-green-400/40" },
  { value: "absent", label: "attendance.absent", className: "bg-red-500/20 text-red-300 ring-red-400/40" },
  { value: "late", label: "attendance.late", className: "bg-amber-500/20 text-amber-300 ring-amber-400/40" },
  { value: "excused", label: "attendance.excused", className: "bg-sky-500/20 text-sky-300 ring-sky-400/40" },
];

// Shared by the admin Attendance page and the teacher home view. One row per
// student per day: existing marks for the chosen date are loaded and saving
// upserts on (student_id, date), so re-saving corrects rather than duplicates.
export function AttendanceSheet({ classes, title }: { classes: ClassOption[]; title?: string }) {
  const { t } = useT();
  const [classId, setClassId] = useState<string>(classes[0]?.id || "");
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [students, setStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<Record<string, Status>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!classId && classes[0]?.id) setClassId(classes[0].id);
  }, [classes, classId]);

  useEffect(() => {
    if (!classId || !date) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, date]);

  async function load() {
    setLoading(true);
    const [{ data: studentRows, error: studentError }, { data: existing }] = await Promise.all([
      supabase.from("students").select("id, full_name").eq("class_id", classId).eq("status", "active").order("full_name"),
      supabase.from("attendance").select("student_id, status, note").eq("class_id", classId).eq("date", date),
    ]);
    setLoading(false);

    if (studentError) {
      toast.error(studentError.message);
      return;
    }

    setStudents(studentRows || []);
    const nextMarks: Record<string, Status> = {};
    const nextNotes: Record<string, string> = {};
    for (const row of existing || []) {
      nextMarks[row.student_id] = String(row.status).toLowerCase() as Status;
      if (row.note) nextNotes[row.student_id] = row.note;
    }
    setMarks(nextMarks);
    setNotes(nextNotes);
  }

  const markAll = (status: Status) => {
    const next: Record<string, Status> = {};
    students.forEach((s) => (next[s.id] = status));
    setMarks(next);
  };

  const summary = useMemo(() => {
    const counts: Record<Status, number> = { present: 0, absent: 0, late: 0, excused: 0 };
    Object.values(marks).forEach((m) => (counts[m] += 1));
    return counts;
  }, [marks]);

  async function save() {
    const records = students
      .filter((s) => marks[s.id])
      .map((s) => ({ student_id: s.id, class_id: classId, date, status: marks[s.id], note: notes[s.id]?.trim() || null }));

    if (records.length === 0) {
      toast.error("Mark at least one student");
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("attendance").upsert(records, { onConflict: "student_id,date" });
    setSaving(false);

    if (error) toast.error(error.message);
    else toast.success(`Attendance saved for ${records.length} student(s)`);
  }

  if (classes.length === 0) {
    return (
      <EmptyState
        icon={<Users size={20} />}
        title="No classes to take attendance for"
        description="Create classes (and assign students to them) before marking attendance."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <h1 className="text-2xl font-semibold">{title || t("page.attendance.title")}</h1>
        <div className="flex flex-wrap gap-2">
          <label className="text-sm">
            <span className="mr-2 text-muted-foreground">Class</span>
            <select value={classId} onChange={(e) => setClassId(e.target.value)} className="rounded border border-input bg-background px-3 py-2 text-sm">
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mr-2 text-muted-foreground">Date</span>
            <input type="date" value={date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} className="rounded border border-input bg-background px-3 py-2 text-sm" />
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card/80 p-4 shadow-soft md:p-6">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading roster...</p>
        ) : students.length === 0 ? (
          <EmptyState icon={<CalendarCheck size={20} />} title="No students in this class" description="Assign students to this class from the Students page." />
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground">Quick fill:</span>
              {STATUSES.map((s) => (
                <button key={s.value} type="button" onClick={() => markAll(s.value)} className={`rounded-full px-3 py-1 ring-1 ${s.className}`}>
                  {t("common.all")} · {t(s.label)}
                </button>
              ))}
              <span className="ml-auto text-muted-foreground">
                {summary.present} present · {summary.absent} absent · {summary.late} late · {summary.excused} excused
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="p-2">{t("common.student")}</th>
                    <th className="p-2">{t("common.status")}</th>
                    <th className="p-2">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.id} className="border-t border-border/60">
                      <td className="p-2">{s.full_name}</td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-1">
                          {STATUSES.map((st) => (
                            <button
                              key={st.value}
                              type="button"
                              onClick={() => setMarks({ ...marks, [s.id]: st.value })}
                              className={`rounded-full px-3 py-1 text-xs ring-1 transition ${
                                marks[s.id] === st.value ? st.className : "bg-transparent text-muted-foreground ring-border hover:bg-white/5"
                              }`}
                            >
                              {t(st.label)}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="p-2">
                        <input
                          value={notes[s.id] || ""}
                          onChange={(e) => setNotes({ ...notes, [s.id]: e.target.value })}
                          placeholder="Optional"
                          className="w-full rounded border border-input bg-background px-2 py-1 text-xs"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              data-tour="teacher-save-attendance"
              onClick={save}
              disabled={saving}
              className="mt-4 rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? t("common.saving") : t("page.attendance.save")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
