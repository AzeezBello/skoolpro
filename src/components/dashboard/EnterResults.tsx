"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import toast from "react-hot-toast";
import { ClipboardList, Download } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { authFetch } from "@/lib/client/authFetch";
import { getLetterGrade } from "@/lib/grading";
import { useSchoolSettings } from "@/lib/hooks/useSchoolSettings";
import { useT } from "@/components/i18n/LocaleProvider";

interface ClassItem {
  id: string;
  name: string;
}

interface Subject {
  id: string;
  name: string;
}

interface SessionOption {
  id: string;
  name: string;
  is_current: boolean;
}

interface TermOption {
  id: string;
  name: string;
  is_current?: boolean;
  results_published?: boolean;
}

interface StudentItem {
  id: string;
  full_name: string;
}

type ScoreEntry = { ca: string; exam: string };

export function EnterResults() {
  const { t } = useT();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [classSubjectIds, setClassSubjectIds] = useState<Record<string, string[]>>({});
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [terms, setTerms] = useState<TermOption[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [termId, setTermId] = useState("");
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [scores, setScores] = useState<Record<string, ScoreEntry>>({});
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingTerms, setLoadingTerms] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { settings } = useSchoolSettings();
  const CA_MAX = settings.grading.ca_max;
  const EXAM_MAX = settings.grading.exam_max;

  useEffect(() => {
    fetchOptions();
  }, []);

  useEffect(() => {
    if (sessionId) fetchTerms(sessionId);
    else {
      setTerms([]);
      setTermId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const fetchOptions = async () => {
    setLoadingOptions(true);
    const [{ data: classData }, { data: subjectData }, { data: assignmentData }, { data: sessionData }] =
      await Promise.all([
        supabase.from("classes").select("id, name").order("name"),
        supabase.from("subjects").select("id, name").order("name"),
        supabase.from("class_subjects").select("class_id, subject_id"),
        supabase.from("sessions").select("id, name, is_current").order("start_date", { ascending: false }),
      ]);
    setLoadingOptions(false);

    setClasses(classData || []);
    setAllSubjects(subjectData || []);

    const grouped: Record<string, string[]> = {};
    (assignmentData || []).forEach((row: { class_id: string; subject_id: string }) => {
      grouped[row.class_id] = grouped[row.class_id] || [];
      grouped[row.class_id].push(row.subject_id);
    });
    setClassSubjectIds(grouped);

    const sessionList: SessionOption[] = sessionData || [];
    setSessions(sessionList);
    const current = sessionList.find((s) => s.is_current) || sessionList[0];
    if (current) setSessionId(current.id);
  };

  const fetchTerms = async (forSessionId: string) => {
    setLoadingTerms(true);
    const { data, error } = await supabase
      .from("terms")
      .select("id, name, is_current, results_published")
      .eq("session_id", forSessionId)
      .order("start_date", { ascending: true });
    setLoadingTerms(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    const termList: TermOption[] = data || [];
    setTerms(termList);
    setTermId((prev) => (termList.some((t) => t.id === prev) ? prev : termList.find((t) => t.is_current)?.id || termList[0]?.id || ""));
  };

  const availableSubjects = useMemo(() => {
    const ids = classSubjectIds[classId] || [];
    return allSubjects.filter((s) => ids.includes(s.id));
  }, [allSubjects, classSubjectIds, classId]);

  useEffect(() => {
    if (!classId || !subjectId || !termId) {
      setStudents([]);
      setScores({});
      return;
    }
    loadStudentsAndScores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, subjectId, termId]);

  const loadStudentsAndScores = async () => {
    setLoadingStudents(true);
    // Roster for the selected session comes from enrollments when the school
    // records them; otherwise fall back to the current class list.
    const [{ data: enrolled }, { data: resultData }] = await Promise.all([
      supabase.from("student_enrollments").select("students(id, full_name)").eq("class_id", classId).eq("session_id", sessionId),
      supabase.from("results").select("student_id, ca_score, exam_score").eq("subject_id", subjectId).eq("term_id", termId),
    ]);

    let studentList: StudentItem[] = ((enrolled || []).map((e: any) => e.students).filter(Boolean) as StudentItem[]).sort((a, b) =>
      a.full_name.localeCompare(b.full_name)
    );

    if (studentList.length === 0) {
      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select("id, full_name")
        .eq("class_id", classId)
        .eq("status", "active")
        .order("full_name");
      if (studentError) {
        setLoadingStudents(false);
        toast.error(studentError.message);
        return;
      }
      studentList = studentData || [];
    }
    setLoadingStudents(false);
    setStudents(studentList);

    const nextScores: Record<string, ScoreEntry> = {};
    studentList.forEach((s) => {
      const existing = (resultData || []).find((r: any) => r.student_id === s.id);
      nextScores[s.id] = {
        ca: existing?.ca_score != null ? String(existing.ca_score) : "",
        exam: existing?.exam_score != null ? String(existing.exam_score) : "",
      };
    });
    setScores(nextScores);
  };

  const updateScore = (studentId: string, field: "ca" | "exam", value: string) => {
    setScores((prev) => ({
      ...prev,
      [studentId]: { ...(prev[studentId] || { ca: "", exam: "" }), [field]: value },
    }));
  };

  const save = async () => {
    if (!classId || !subjectId || !termId) {
      toast.error("Select a session, term, class, and subject first");
      return;
    }

    const rows: Array<{
      student_id: string;
      subject_id: string;
      class_id: string;
      term_id: string;
      ca_score: number | null;
      exam_score: number | null;
    }> = [];

    const cleared: string[] = [];
    for (const s of students) {
      const entry = scores[s.id];
      if (!entry || (entry.ca === "" && entry.exam === "")) {
        cleared.push(s.id);
        continue;
      }

      const ca = entry.ca === "" ? null : Number(entry.ca);
      const exam = entry.exam === "" ? null : Number(entry.exam);

      if (ca !== null && (Number.isNaN(ca) || ca < 0 || ca > CA_MAX)) {
        toast.error(`${s.full_name}: CA score must be between 0 and ${CA_MAX}`);
        return;
      }
      if (exam !== null && (Number.isNaN(exam) || exam < 0 || exam > EXAM_MAX)) {
        toast.error(`${s.full_name}: Exam score must be between 0 and ${EXAM_MAX}`);
        return;
      }

      rows.push({ student_id: s.id, subject_id: subjectId, class_id: classId, term_id: termId, ca_score: ca, exam_score: exam });
    }

    if (rows.length === 0 && cleared.length === 0) {
      toast.error("Enter at least one score before saving");
      return;
    }

    setSaving(true);
    // Rows whose scores were blanked out are deleted, so a mistaken entry can
    // be removed rather than lingering as a zero.
    const [{ error }, { error: deleteError }] = await Promise.all([
      rows.length ? supabase.from("results").upsert(rows, { onConflict: "student_id,subject_id,term_id" }) : Promise.resolve({ error: null }),
      cleared.length
        ? supabase.from("results").delete().eq("subject_id", subjectId).eq("term_id", termId).in("student_id", cleared)
        : Promise.resolve({ error: null }),
    ]);
    setSaving(false);

    if (error || deleteError) {
      toast.error(error?.message || deleteError?.message || "Save failed");
      return;
    }

    toast.success("Results saved");
  };

  const downloadClassReportCards = async () => {
    if (!classId || !termId) {
      toast.error("Select a class and term first");
      return;
    }

    setExporting(true);
    try {
      const res = await authFetch(`/api/report-cards/class/${classId}?termId=${encodeURIComponent(termId)}`);
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        toast.error(payload?.error || "Could not generate report cards");
        return;
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch {
      toast.error("Failed to download report cards");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t("page.results.title")}</h1>
        {termId && (
          <span className={`rounded-full px-3 py-1 text-xs ${terms.find((t) => t.id === termId)?.results_published ? "bg-green-500/20 text-green-300" : "bg-amber-500/20 text-amber-300"}`}>
            {terms.find((t) => t.id === termId)?.results_published ? "Published to students & parents" : "Draft — not yet visible to students"}
          </span>
        )}
      </div>

      <div className="grid gap-3 rounded-xl border border-border bg-card/80 p-6 shadow-soft md:grid-cols-4">
        <select
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
        >
          <option value="">Select session</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.is_current ? " (current)" : ""}
            </option>
          ))}
        </select>

        <select
          value={termId}
          onChange={(e) => setTermId(e.target.value)}
          disabled={!sessionId || loadingTerms}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground disabled:opacity-50"
        >
          <option value="">Select term</option>
          {terms.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        <select
          value={classId}
          onChange={(e) => {
            setClassId(e.target.value);
            setSubjectId("");
          }}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
        >
          <option value="">Select class</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          disabled={!classId}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground disabled:opacity-50"
        >
          <option value="">Select subject</option>
          {availableSubjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {sessions.length === 0 && !loadingOptions ? (
        <EmptyState
          icon={<ClipboardList size={20} />}
          title="No sessions set up yet"
          description="Create an academic session and its terms from the Sessions page first."
        />
      ) : !classId || !subjectId || !termId ? (
        <EmptyState
          icon={<ClipboardList size={20} />}
          title="Pick a session, term, class, and subject"
          description={
            loadingOptions
              ? "Loading..."
              : classId && availableSubjects.length === 0
                ? "This class has no subjects assigned yet — add some from the Subjects page."
                : "Select all four above to enter CA and exam scores."
          }
        />
      ) : loadingStudents ? (
        <p className="text-sm text-muted-foreground">Loading students...</p>
      ) : students.length === 0 ? (
        <EmptyState icon={<ClipboardList size={20} />} title="No students in this class yet" />
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-xl border border-border bg-card/80 shadow-soft">
            <table className="w-full text-left text-sm">
              <thead className="bg-secondary/40 text-muted-foreground">
                <tr>
                  <th className="p-3">Student</th>
                  <th className="p-3">CA (0-{CA_MAX})</th>
                  <th className="p-3">Exam (0-{EXAM_MAX})</th>
                  <th className="p-3">Total</th>
                  <th className="p-3">Grade</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => {
                  const entry = scores[s.id] || { ca: "", exam: "" };
                  const hasEntry = entry.ca !== "" || entry.exam !== "";
                  const total = (Number(entry.ca) || 0) + (Number(entry.exam) || 0);
                  return (
                    <tr key={s.id} className="border-t border-border/60">
                      <td className="p-3 font-medium">{s.full_name}</td>
                      <td className="p-3">
                        <input
                          type="number"
                          min="0"
                          max={CA_MAX}
                          value={entry.ca}
                          onChange={(e) => updateScore(s.id, "ca", e.target.value)}
                          className="w-20 rounded border border-input bg-background p-2 text-sm"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          type="number"
                          min="0"
                          max={EXAM_MAX}
                          value={entry.exam}
                          onChange={(e) => updateScore(s.id, "exam", e.target.value)}
                          className="w-20 rounded border border-input bg-background p-2 text-sm"
                        />
                      </td>
                      <td className="p-3 text-muted-foreground">{hasEntry ? total : "—"}</td>
                      <td className="p-3 text-muted-foreground">{hasEntry ? getLetterGrade(total, settings.grading) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? t("common.saving") : t("page.results.save")}
            </button>
            <button
              onClick={downloadClassReportCards}
              disabled={exporting}
              className="flex items-center gap-2 rounded-md bg-secondary px-5 py-2 text-sm font-semibold text-secondary-foreground transition hover:bg-secondary/80 disabled:opacity-50"
            >
              <Download size={14} />
              {exporting ? "Preparing..." : "Download class report cards"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
