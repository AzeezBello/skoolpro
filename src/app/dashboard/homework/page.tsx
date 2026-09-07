"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { BookMarked } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentProfile } from "@/lib/hooks/useCurrentProfile";
import { EmptyState } from "@/components/ui/empty-state";
import { useT } from "@/components/i18n/LocaleProvider";

type Assignment = { id: string; class_id: string; subject_id: string | null; title: string; instructions: string | null; due_date: string | null; max_score: number | null; created_at: string; classes?: { name?: string } | null; subjects?: { name?: string } | null };
type Submission = { id: string; assignment_id: string; student_id: string; content: string | null; submitted_at: string; score: number | null; feedback: string | null; students?: { full_name?: string } | null };
type Option = { id: string; name: string };

export default function HomeworkPage() {
  const { t } = useT();
  const { profile, loading: profileLoading } = useCurrentProfile();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [classes, setClasses] = useState<Option[]>([]);
  const [subjects, setSubjects] = useState<Option[]>([]);
  const [form, setForm] = useState({ class_id: "", subject_id: "", title: "", instructions: "", due_date: "", max_score: "" });
  const [open, setOpen] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [mySubmission, setMySubmission] = useState("");
  const [saving, setSaving] = useState(false);

  const isStaff = profile?.role === "admin" || profile?.role === "teacher";
  const isStudent = profile?.role === "student";
  const ownStudentId = isStudent ? profile?.relatedId || profile?.userId : null;

  useEffect(() => {
    if (profileLoading) return;
    void load();
    if (isStaff) {
      supabase.from("classes").select("id, name").order("name").then(({ data }) => setClasses(data || []));
      supabase.from("subjects").select("id, name").order("name").then(({ data }) => setSubjects(data || []));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileLoading, isStaff]);

  async function load() {
    const { data, error } = await supabase
      .from("assignments")
      .select("id, class_id, subject_id, title, instructions, due_date, max_score, created_at, classes(name), subjects(name)")
      .order("due_date", { ascending: false, nullsFirst: false })
      .limit(200);
    if (error) toast.error(error.message);
    setAssignments((data as any) || []);
  }

  async function openAssignment(a: Assignment) {
    setOpen(a);
    const { data } = await supabase
      .from("assignment_submissions")
      .select("id, assignment_id, student_id, content, submitted_at, score, feedback, students(full_name)")
      .eq("assignment_id", a.id)
      .order("submitted_at", { ascending: false });
    const list = (data as any as Submission[]) || [];
    setSubmissions(list);
    setMySubmission(list.find((s) => s.student_id === ownStudentId)?.content || "");
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form.class_id || !form.title.trim()) return toast.error("Class and title are required");
    setSaving(true);
    const { error } = await supabase.from("assignments").insert([{ class_id: form.class_id, subject_id: form.subject_id || null, title: form.title.trim(), instructions: form.instructions.trim() || null, due_date: form.due_date || null, max_score: form.max_score ? Number(form.max_score) : null, created_by: profile?.userId }]);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Homework posted");
    setForm({ class_id: form.class_id, subject_id: "", title: "", instructions: "", due_date: "", max_score: "" });
    await load();
  }

  async function submit() {
    if (!open || !ownStudentId) return;
    if (!mySubmission.trim()) return toast.error("Write your answer first");
    setSaving(true);
    const { error } = await supabase.from("assignment_submissions").upsert([{ assignment_id: open.id, student_id: ownStudentId, content: mySubmission.trim(), submitted_at: new Date().toISOString() }], { onConflict: "assignment_id,student_id" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Submitted");
    await openAssignment(open);
  }

  async function grade(s: Submission, score: string, feedback: string) {
    const { error } = await supabase.from("assignment_submissions").update({ score: score === "" ? null : Number(score), feedback: feedback || null, graded_by: profile?.userId, graded_at: new Date().toISOString() }).eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success("Graded");
    if (open) await openAssignment(open);
  }

  async function remove(a: Assignment) {
    if (!confirm(`Delete "${a.title}"?`)) return;
    const { error } = await supabase.from("assignments").delete().eq("id", a.id);
    if (error) return toast.error(error.message);
    setOpen(null);
    await load();
  }

  if (profileLoading) return <p className="text-sm text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">{t("page.homework.title")}</h1>
        <p className="text-sm text-muted-foreground">{isStaff ? t("page.homework.staff") : t("page.homework.student")}</p>
      </div>

      {isStaff && (
        <form onSubmit={create} className="grid gap-2 rounded-xl border border-border bg-card/80 p-4 shadow-soft md:grid-cols-6">
          <select value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })} className="rounded-md border border-input bg-background px-3 py-2 text-sm" required>
            <option value="">Class</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="">Subject</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" className="rounded-md border border-input bg-background px-3 py-2 text-sm md:col-span-2" required />
          <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <input type="number" min={0} value={form.max_score} onChange={(e) => setForm({ ...form, max_score: e.target.value })} placeholder="Max score" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <textarea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="Instructions" rows={2} className="rounded-md border border-input bg-background px-3 py-2 text-sm md:col-span-5" />
          <button type="submit" disabled={saving} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">Post</button>
        </form>
      )}

      {assignments.length === 0 ? (
        <EmptyState icon={<BookMarked size={20} />} title="No homework yet" description={isStaff ? "Post the first assignment above." : "Assignments from your teachers will appear here."} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {assignments.map((a) => (
            <button key={a.id} onClick={() => openAssignment(a)} className="rounded-xl border border-border bg-card/80 p-4 text-left transition hover:border-primary/60">
              <p className="font-semibold">{a.title}</p>
              <p className="text-xs text-muted-foreground">{a.classes?.name}{a.subjects?.name ? ` · ${a.subjects.name}` : ""}{a.due_date ? ` · due ${new Date(a.due_date).toLocaleDateString()}` : ""}</p>
              {a.instructions && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{a.instructions}</p>}
            </button>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setOpen(null)}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-soft" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">{open.title}</h2>
                <p className="text-xs text-muted-foreground">{open.classes?.name}{open.subjects?.name ? ` · ${open.subjects.name}` : ""}{open.due_date ? ` · due ${new Date(open.due_date).toLocaleDateString()}` : ""}{open.max_score ? ` · ${open.max_score} marks` : ""}</p>
              </div>
              {isStaff && <button onClick={() => remove(open)} className="text-xs text-red-400">Delete</button>}
            </div>
            {open.instructions && <p className="mt-3 whitespace-pre-line text-sm">{open.instructions}</p>}

            {isStudent && (
              <div className="mt-5 space-y-2">
                <h3 className="text-sm font-semibold">Your submission</h3>
                {submissions.find((s) => s.student_id === ownStudentId)?.score != null ? (
                  <div className="rounded-md bg-white/5 p-3 text-sm">
                    <p>Score: <strong>{submissions.find((s) => s.student_id === ownStudentId)?.score}{open.max_score ? ` / ${open.max_score}` : ""}</strong></p>
                    {submissions.find((s) => s.student_id === ownStudentId)?.feedback && <p className="text-muted-foreground">{submissions.find((s) => s.student_id === ownStudentId)?.feedback}</p>}
                    <p className="mt-2 whitespace-pre-line text-muted-foreground">{mySubmission}</p>
                  </div>
                ) : (
                  <>
                    <textarea value={mySubmission} onChange={(e) => setMySubmission(e.target.value)} rows={5} placeholder="Type your answer or a link to your work" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                    <button onClick={submit} disabled={saving} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">Submit</button>
                  </>
                )}
              </div>
            )}

            {isStaff && (
              <div className="mt-5">
                <h3 className="mb-2 text-sm font-semibold">Submissions ({submissions.length})</h3>
                {submissions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No submissions yet.</p>
                ) : (
                  <div className="space-y-3">
                    {submissions.map((s) => (
                      <GradeRow key={s.id} submission={s} maxScore={open.max_score} onGrade={grade} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function GradeRow({ submission, maxScore, onGrade }: { submission: Submission; maxScore: number | null; onGrade: (s: Submission, score: string, feedback: string) => Promise<unknown> }) {
  const [score, setScore] = useState(submission.score != null ? String(submission.score) : "");
  const [feedback, setFeedback] = useState(submission.feedback || "");
  return (
    <div className="rounded-md border border-border p-3 text-sm">
      <div className="flex items-center justify-between">
        <p className="font-medium">{submission.students?.full_name}</p>
        <p className="text-xs text-muted-foreground">{new Date(submission.submitted_at).toLocaleString()}</p>
      </div>
      <p className="mt-1 whitespace-pre-line text-muted-foreground">{submission.content}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <input type="number" min={0} max={maxScore ?? undefined} value={score} onChange={(e) => setScore(e.target.value)} placeholder="Score" className="w-24 rounded-md border border-input bg-background px-2 py-1 text-xs" />
        <input value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Feedback" className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs" />
        <button onClick={() => onGrade(submission, score, feedback)} className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">Save</button>
      </div>
    </div>
  );
}
