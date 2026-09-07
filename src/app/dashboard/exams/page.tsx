"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { FileQuestion, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentProfile } from "@/lib/hooks/useCurrentProfile";
import { EmptyState } from "@/components/ui/empty-state";
import { useT } from "@/components/i18n/LocaleProvider";

type Exam = { id: string; class_id: string; subject_id: string | null; title: string; instructions: string | null; duration_minutes: number; opens_at: string | null; closes_at: string | null; status: "draft" | "published" | "closed"; max_attempts: number; show_results: boolean; classes?: { name?: string } | null; subjects?: { name?: string } | null; exam_questions?: Array<{ count: number }>; exam_attempts?: Array<{ count: number }> };
type QType = "mcq" | "short" | "essay";
type Question = { id: string; position: number; type: QType; prompt: string; options: string[]; correct_index: number | null; accepted_answers: string[]; model_answer: string | null; marks: number };
type Attempt = { id: string; exam_id: string; submitted_at: string | null; score: number | null; max_score: number | null; attempt_number: number; needs_grading?: boolean };
type ResultRow = { id: string; score: number | null; max_score: number | null; auto_score: number | null; submitted_at: string | null; needs_grading: boolean; answers: Record<string, unknown>; manual_scores: Record<string, number>; students?: { full_name?: string } | null };

const toLocalInput = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");

export default function ExamsPage() {
  const { t } = useT();
  const { profile, loading: profileLoading } = useCurrentProfile();
  const isStaff = profile?.role === "admin" || profile?.role === "teacher";
  const [exams, setExams] = useState<Exam[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [subjects, setSubjects] = useState<Array<{ id: string; name: string }>>([]);
  const [form, setForm] = useState({ class_id: "", subject_id: "", title: "", instructions: "", duration_minutes: "30", opens_at: "", closes_at: "", max_attempts: "1", show_results: true });
  const [editing, setEditing] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [qForm, setQForm] = useState({ type: "mcq" as QType, prompt: "", options: ["", "", "", ""], correct_index: 0, accepted: "", model_answer: "", marks: "1" });
  const [results, setResults] = useState<ResultRow[]>([]);
  const [grading, setGrading] = useState<ResultRow | null>(null);
  const [gradeScores, setGradeScores] = useState<Record<string, string>>({});

  useEffect(() => {
    if (profileLoading) return;
    void load();
    if (isStaff) {
      supabase.from("classes").select("id, name").order("name").then(({ data }) => setClasses(data || []));
      supabase.from("subjects").select("id, name").order("name").then(({ data }) => setSubjects(data || []));
    }
  }, [profileLoading, isStaff]);

  async function load() {
    const [{ data: e, error }, { data: a }] = await Promise.all([
      supabase.from("exams").select("*, classes(name), subjects(name), exam_questions(count), exam_attempts(count)").order("created_at", { ascending: false }),
      supabase.from("exam_attempts").select("id, exam_id, submitted_at, score, max_score, attempt_number, needs_grading"),
    ]);
    if (error) toast.error(error.message);
    setExams((e as any) || []);
    setAttempts((a as Attempt[]) || []);
  }

  async function createExam(e: React.FormEvent) {
    e.preventDefault();
    if (!form.class_id || !form.title.trim()) return toast.error("Class and title are required");
    const { data, error } = await supabase
      .from("exams")
      .insert([{ class_id: form.class_id, subject_id: form.subject_id || null, title: form.title.trim(), instructions: form.instructions || null, duration_minutes: Number(form.duration_minutes) || 30, opens_at: form.opens_at ? new Date(form.opens_at).toISOString() : null, closes_at: form.closes_at ? new Date(form.closes_at).toISOString() : null, max_attempts: Number(form.max_attempts) || 1, show_results: form.show_results, created_by: profile?.userId }])
      .select("*, classes(name), subjects(name)")
      .single();
    if (error) return toast.error(error.message);
    toast.success("Exam created — add questions");
    setForm({ class_id: form.class_id, subject_id: "", title: "", instructions: "", duration_minutes: "30", opens_at: "", closes_at: "", max_attempts: "1", show_results: true });
    await load();
    openExam(data as Exam);
  }

  async function openExam(exam: Exam) {
    setEditing(exam);
    const [{ data: q }, { data: r }] = await Promise.all([
      supabase.from("exam_questions").select("*").eq("exam_id", exam.id).order("position"),
      supabase.from("exam_attempts").select("id, score, max_score, auto_score, submitted_at, needs_grading, answers, manual_scores, students(full_name)").eq("exam_id", exam.id).order("submitted_at", { ascending: false }),
    ]);
    setQuestions((q as Question[]) || []);
    setResults((r as any) || []);
  }

  async function addQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    if (!qForm.prompt.trim()) return toast.error("Enter the question");
    const base = { exam_id: editing.id, position: questions.length, type: qForm.type, prompt: qForm.prompt.trim(), marks: Number(qForm.marks) || 1 };
    let payload: Record<string, unknown> = base;
    if (qForm.type === "mcq") {
      const options = qForm.options.map((o) => o.trim()).filter(Boolean);
      if (options.length < 2) return toast.error("Enter at least two options");
      if (qForm.correct_index >= options.length) return toast.error("Pick the correct option");
      payload = { ...base, options, correct_index: qForm.correct_index };
    } else if (qForm.type === "short") {
      const accepted = qForm.accepted.split("|").map((a) => a.trim()).filter(Boolean);
      if (accepted.length === 0) return toast.error("Enter at least one accepted answer (separate alternatives with |)");
      payload = { ...base, options: [], correct_index: null, accepted_answers: accepted };
    } else {
      payload = { ...base, options: [], correct_index: null, model_answer: qForm.model_answer.trim() || null };
    }
    const { error } = await supabase.from("exam_questions").insert([payload]);
    if (error) return toast.error(error.message);
    setQForm({ type: qForm.type, prompt: "", options: ["", "", "", ""], correct_index: 0, accepted: "", model_answer: "", marks: "1" });
    await openExam(editing);
  }

  async function removeQuestion(id: string) {
    if (!editing) return;
    const { error } = await supabase.from("exam_questions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await openExam(editing);
  }

  async function setStatus(exam: Exam, status: Exam["status"]) {
    if (status === "published" && (exam.exam_questions?.[0]?.count || questions.length) === 0) return toast.error("Add questions before publishing");
    const { error } = await supabase.from("exams").update({ status }).eq("id", exam.id);
    if (error) return toast.error(error.message);
    toast.success(status === "published" ? "Exam published" : status === "closed" ? "Exam closed" : "Back to draft");
    await load();
    if (editing?.id === exam.id) setEditing({ ...exam, status });
  }

  async function removeExam(exam: Exam) {
    if (!confirm(`Delete "${exam.title}" and all attempts?`)) return;
    const { error } = await supabase.from("exams").delete().eq("id", exam.id);
    if (error) return toast.error(error.message);
    setEditing(null);
    await load();
  }

  function openGrading(r: ResultRow) {
    setGrading(r);
    const init: Record<string, string> = {};
    questions.filter((q) => q.type === "essay").forEach((q) => (init[q.id] = r.manual_scores?.[q.id] != null ? String(r.manual_scores[q.id]) : ""));
    setGradeScores(init);
  }

  async function submitGrades() {
    if (!grading) return;
    const scores: Record<string, number> = {};
    for (const [k, v] of Object.entries(gradeScores)) if (v !== "") scores[k] = Number(v);
    const { data, error } = await supabase.rpc("grade_exam_attempt", { p_attempt_id: grading.id, p_scores: scores });
    if (error) return toast.error(error.message);
    toast.success(`Graded: ${data?.score} / ${data?.max_score}`);
    setGrading(null);
    if (editing) await openExam(editing);
  }

  async function saveSchedule() {
    if (!editing) return;
    const { error } = await supabase.from("exams").update({ opens_at: form.opens_at ? new Date(form.opens_at).toISOString() : null, closes_at: form.closes_at ? new Date(form.closes_at).toISOString() : null, duration_minutes: Number(form.duration_minutes) || editing.duration_minutes, max_attempts: Number(form.max_attempts) || 1, show_results: form.show_results }).eq("id", editing.id);
    if (error) return toast.error(error.message);
    toast.success("Settings saved");
    await load();
  }

  if (profileLoading) return <p className="text-sm text-muted-foreground">Loading...</p>;

  // ---------- Student view
  if (!isStaff) {
    const now = Date.now();
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold">{t("page.exams.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("page.exams.student")}</p>
        </div>
        {exams.length === 0 ? (
          <EmptyState icon={<FileQuestion size={20} />} title="No exams available" description="Published exams for your class will appear here." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {exams.map((ex) => {
              const mine = attempts.filter((a) => a.exam_id === ex.id);
              const done = mine.filter((a) => a.submitted_at);
              const open = (!ex.opens_at || new Date(ex.opens_at).getTime() <= now) && (!ex.closes_at || new Date(ex.closes_at).getTime() >= now);
              const remaining = ex.max_attempts - done.length;
              const best = done.reduce<Attempt | null>((b, a) => (b === null || (a.score ?? 0) > (b.score ?? 0) ? a : b), null);
              return (
                <div key={ex.id} className="rounded-xl border border-border bg-card/80 p-4">
                  <p className="font-semibold">{ex.title}</p>
                  <p className="text-xs text-muted-foreground">{ex.subjects?.name ? `${ex.subjects.name} · ` : ""}{ex.duration_minutes} min · {ex.exam_questions?.[0]?.count ?? "?"} questions{ex.closes_at ? ` · closes ${new Date(ex.closes_at).toLocaleString()}` : ""}</p>
                  {ex.instructions && <p className="mt-1 text-sm text-muted-foreground">{ex.instructions}</p>}
                  <div className="mt-3 flex items-center justify-between">
                    {best && best.score != null ? <span className="text-sm">Best: <strong>{best.score}</strong> / {best.max_score}</span> : <span className="text-xs text-muted-foreground">{done.some((a) => a.needs_grading) ? "Awaiting teacher marking" : done.length ? "Submitted" : "Not attempted"}</span>}
                    {open && remaining > 0 ? (
                      <Link href={`/dashboard/exams/${ex.id}`} className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
                        {mine.some((a) => !a.submitted_at) ? "Resume" : done.length ? "Retake" : "Start"}
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">{!open ? "Not open" : "No attempts left"}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ---------- Staff view
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">{t("page.exams.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("page.exams.staff")}</p>
      </div>

      <form onSubmit={createExam} className="grid gap-2 rounded-xl border border-border bg-card/80 p-4 shadow-soft md:grid-cols-6">
        <select value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })} className="rounded-md border border-input bg-background px-3 py-2 text-sm" required>
          <option value="">Class</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
          <option value="">Subject</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Exam title" className="rounded-md border border-input bg-background px-3 py-2 text-sm md:col-span-2" required />
        <input type="number" min={1} value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} placeholder="Minutes" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
        <button type="submit" className="flex items-center justify-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"><Plus size={14} /> Create</button>
      </form>

      {exams.length === 0 ? (
        <EmptyState icon={<FileQuestion size={20} />} title="No exams yet" description="Create one above, then add questions and publish." />
      ) : (
        <div className="grid gap-4 md:grid-cols-[320px_1fr]">
          <div className="space-y-1 rounded-xl border border-border bg-card/80 p-2">
            {exams.map((ex) => (
              <button key={ex.id} onClick={() => { openExam(ex); setForm({ ...form, opens_at: toLocalInput(ex.opens_at), closes_at: toLocalInput(ex.closes_at), duration_minutes: String(ex.duration_minutes), max_attempts: String(ex.max_attempts), show_results: ex.show_results }); }} className={`w-full rounded-md px-3 py-2 text-left text-sm ${editing?.id === ex.id ? "bg-primary/15" : "hover:bg-white/5"}`}>
                <p className="font-medium">{ex.title}</p>
                <p className="text-xs text-muted-foreground">{ex.classes?.name}{ex.subjects?.name ? ` · ${ex.subjects.name}` : ""} · {ex.exam_questions?.[0]?.count ?? 0} Q · {ex.exam_attempts?.[0]?.count ?? 0} attempts · <span className="capitalize">{ex.status}</span></p>
              </button>
            ))}
          </div>

          {editing ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-card/80 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold">{editing.title}</h2>
                    <p className="text-xs text-muted-foreground">{editing.classes?.name} · <span className="capitalize">{editing.status}</span></p>
                  </div>
                  <div className="flex gap-2">
                    {editing.status !== "published" && <button onClick={() => setStatus(editing, "published")} className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white">Publish</button>}
                    {editing.status === "published" && <button onClick={() => setStatus(editing, "closed")} className="rounded-md bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-300">Close</button>}
                    {editing.status === "closed" && <button onClick={() => setStatus(editing, "draft")} className="rounded-md border border-input px-3 py-1.5 text-xs">Reopen as draft</button>}
                    <button onClick={() => removeExam(editing)} className="text-red-400" aria-label="Delete exam"><Trash2 size={16} /></button>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-5">
                  <label className="text-xs text-muted-foreground">Opens<input type="datetime-local" value={form.opens_at} onChange={(e) => setForm({ ...form, opens_at: e.target.value })} className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground" /></label>
                  <label className="text-xs text-muted-foreground">Closes<input type="datetime-local" value={form.closes_at} onChange={(e) => setForm({ ...form, closes_at: e.target.value })} className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground" /></label>
                  <label className="text-xs text-muted-foreground">Minutes<input type="number" min={1} value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground" /></label>
                  <label className="text-xs text-muted-foreground">Attempts<input type="number" min={1} value={form.max_attempts} onChange={(e) => setForm({ ...form, max_attempts: e.target.value })} className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground" /></label>
                  <div className="flex flex-col justify-end gap-1">
                    <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={form.show_results} onChange={(e) => setForm({ ...form, show_results: e.target.checked })} /> Show score to student</label>
                    <button onClick={saveSchedule} className="rounded-md bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground">Save settings</button>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card/80 p-4">
                <h3 className="mb-2 text-sm font-semibold">Questions ({questions.length})</h3>
                <ol className="space-y-2">
                  {questions.map((q, i) => (
                    <li key={q.id} className="rounded-md bg-white/5 p-3 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium">{i + 1}. {q.prompt} <span className="text-xs text-muted-foreground">({q.marks} mark{Number(q.marks) === 1 ? "" : "s"})</span></p>
                        <button onClick={() => removeQuestion(q.id)} className="text-red-400" aria-label="Remove question"><Trash2 size={14} /></button>
                      </div>
                      {q.type === "mcq" && (
                        <ul className="mt-1 grid gap-1 md:grid-cols-2">
                          {q.options.map((o, oi) => <li key={oi} className={`rounded px-2 py-1 text-xs ${oi === q.correct_index ? "bg-green-500/20 text-green-300" : "text-muted-foreground"}`}>{String.fromCharCode(65 + oi)}. {o}</li>)}
                        </ul>
                      )}
                      {q.type === "short" && <p className="mt-1 text-xs text-muted-foreground">Short answer · accepted: {q.accepted_answers.join(" | ")}</p>}
                      {q.type === "essay" && <p className="mt-1 text-xs text-muted-foreground">Essay · marked by teacher{q.model_answer ? ` · guide: ${q.model_answer}` : ""}</p>}
                    </li>
                  ))}
                </ol>
                {editing.status === "draft" ? (
                  <form onSubmit={addQuestion} className="mt-4 space-y-2 rounded-md border border-dashed border-border p-3">
                    <div className="flex gap-1 text-xs">
                      {(["mcq", "short", "essay"] as QType[]).map((t) => (
                        <button key={t} type="button" onClick={() => setQForm({ ...qForm, type: t })} className={`rounded-md px-3 py-1.5 ${qForm.type === t ? "bg-primary text-primary-foreground" : "border border-input"}`}>
                          {t === "mcq" ? "Multiple choice" : t === "short" ? "Short answer" : "Essay"}
                        </button>
                      ))}
                    </div>
                    <textarea value={qForm.prompt} onChange={(e) => setQForm({ ...qForm, prompt: e.target.value })} placeholder="Question" rows={2} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" required />
                    {qForm.type === "short" && (
                      <input value={qForm.accepted} onChange={(e) => setQForm({ ...qForm, accepted: e.target.value })} placeholder="Accepted answers, separated by | (case-insensitive)" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                    )}
                    {qForm.type === "essay" && (
                      <textarea value={qForm.model_answer} onChange={(e) => setQForm({ ...qForm, model_answer: e.target.value })} placeholder="Marking guide for the teacher (optional, never shown to students)" rows={2} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                    )}
                    <div className={`grid gap-2 md:grid-cols-2 ${qForm.type !== "mcq" ? "hidden" : ""}`}>
                      {qForm.options.map((o, i) => (
                        <label key={i} className="flex items-center gap-2 text-sm">
                          <input type="radio" name="correct" checked={qForm.correct_index === i} onChange={() => setQForm({ ...qForm, correct_index: i })} title="Correct answer" />
                          <span className="w-4 text-xs text-muted-foreground">{String.fromCharCode(65 + i)}</span>
                          <input value={o} onChange={(e) => setQForm({ ...qForm, options: qForm.options.map((x, xi) => (xi === i ? e.target.value : x)) })} placeholder={`Option ${String.fromCharCode(65 + i)}`} className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm" />
                        </label>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="number" min={0.5} step={0.5} value={qForm.marks} onChange={(e) => setQForm({ ...qForm, marks: e.target.value })} className="w-20 rounded-md border border-input bg-background px-2 py-1.5 text-sm" title="Marks" />
                      <span className="text-xs text-muted-foreground">marks{qForm.type === "mcq" ? " · select the radio next to the correct option" : ""}</span>
                      <button type="submit" className="ml-auto rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">Add question</button>
                    </div>
                  </form>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">Questions can only be edited while the exam is a draft.</p>
                )}
              </div>

              <div className="rounded-xl border border-border bg-card/80 p-4">
                <h3 className="mb-2 text-sm font-semibold">Results ({results.filter((r) => r.submitted_at).length} submitted)</h3>
                {results.length === 0 ? <p className="text-xs text-muted-foreground">No attempts yet.</p> : (
                  <table className="w-full text-left text-sm">
                    <thead className="text-muted-foreground"><tr><th className="p-2">Student</th><th className="p-2">Score</th><th className="p-2">Submitted</th><th className="p-2"></th></tr></thead>
                    <tbody>
                      {results.map((r) => (
                        <tr key={r.id} className="border-t border-border/60">
                          <td className="p-2">{r.students?.full_name}</td>
                          <td className="p-2">
                            {!r.submitted_at ? <span className="text-xs text-amber-300">in progress</span> : r.needs_grading ? <span className="text-xs text-amber-300">auto {r.auto_score} · essay pending</span> : `${r.score} / ${r.max_score}`}
                          </td>
                          <td className="p-2 text-muted-foreground">{r.submitted_at ? new Date(r.submitted_at).toLocaleString() : "—"}</td>
                          <td className="p-2 text-right">{r.submitted_at && questions.some((q) => q.type === "essay") && <button onClick={() => openGrading(r)} className="text-xs text-primary">{r.needs_grading ? "Grade" : "Re-grade"}</button>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ) : (
            <EmptyState icon={<FileQuestion size={20} />} title="Select an exam" description="Pick an exam on the left to add questions, schedule it and see results." />
          )}
        </div>
      )}

      {grading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setGrading(null)}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-soft" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">Grade essays · {grading.students?.full_name}</h2>
            <p className="text-xs text-muted-foreground">Auto-marked part: {grading.auto_score} of {grading.max_score}. Enter marks for each essay below.</p>
            <div className="mt-4 space-y-4">
              {questions.filter((q) => q.type === "essay").map((q) => (
                <div key={q.id} className="rounded-md border border-border p-3 text-sm">
                  <p className="font-medium">{q.prompt} <span className="text-xs text-muted-foreground">({q.marks} marks)</span></p>
                  {q.model_answer && <p className="mt-1 text-xs text-muted-foreground">Guide: {q.model_answer}</p>}
                  <p className="mt-2 whitespace-pre-line rounded bg-white/5 p-2">{String(grading.answers?.[q.id] ?? "") || <span className="italic text-muted-foreground">No answer</span>}</p>
                  <input type="number" min={0} max={q.marks} step={0.5} value={gradeScores[q.id] ?? ""} onChange={(e) => setGradeScores({ ...gradeScores, [q.id]: e.target.value })} placeholder={`0–${q.marks}`} className="mt-2 w-28 rounded-md border border-input bg-background px-2 py-1 text-sm" />
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setGrading(null)} className="rounded-md bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground">Cancel</button>
              <button onClick={submitGrades} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Save grades</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
