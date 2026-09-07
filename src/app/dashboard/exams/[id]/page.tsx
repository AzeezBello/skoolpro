"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Clock } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type Question = { id: string; type: "mcq" | "short" | "essay"; prompt: string; options: string[]; marks: number };
type Answer = number | string;
type Session = { attempt_id: string; started_at: string; ends_at: string; answers: Record<string, Answer>; questions: Question[] };

// Student exam runner: starts/resumes an attempt through start_exam_attempt
// (which never returns correct answers), autosaves every 20s, and submits
// automatically when the timer runs out.
export default function TakeExamPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const examId = params?.id || "";
  const [session, setSession] = useState<Session | null>(null);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [remaining, setRemaining] = useState(0);
  const [result, setResult] = useState<{ score: number | null; max_score: number; needs_grading?: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [index, setIndex] = useState(0);
  const answersRef = useRef(answers);
  answersRef.current = answers;

  useEffect(() => {
    if (!examId) return;
    supabase.rpc("start_exam_attempt", { p_exam_id: examId }).then(({ data, error }) => {
      if (error) {
        setError(error.message);
        return;
      }
      const s = data as Session;
      setSession(s);
      setAnswers(s.answers || {});
    });
  }, [examId]);

  const submit = useCallback(
    async (final: boolean) => {
      if (!session || submitting) return;
      if (final) setSubmitting(true);
      const { data, error } = await supabase.rpc("submit_exam_attempt", { p_attempt_id: session.attempt_id, p_answers: answersRef.current, p_final: final });
      if (final) setSubmitting(false);
      if (error) {
        if (final) toast.error(error.message);
        return;
      }
      if (data?.submitted) setResult({ score: data.score, max_score: data.max_score, needs_grading: data.needs_grading });
    },
    [session, submitting]
  );

  // Timer + autosave.
  useEffect(() => {
    if (!session || result) return;
    const tick = () => {
      const left = Math.max(0, Math.floor((new Date(session.ends_at).getTime() - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) void submit(true);
    };
    tick();
    const t = window.setInterval(tick, 1000);
    const save = window.setInterval(() => void submit(false), 20_000);
    return () => {
      window.clearInterval(t);
      window.clearInterval(save);
    };
  }, [session, result, submit]);

  if (error) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-border bg-card/80 p-6 text-center">
        <p className="text-red-300">{error}</p>
        <button onClick={() => router.push("/dashboard/exams")} className="mt-4 rounded-md bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground">Back to exams</button>
      </div>
    );
  }
  if (!session) return <p className="text-sm text-muted-foreground">Preparing your exam...</p>;

  if (result) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-border bg-card/80 p-8 text-center">
        <h1 className="text-2xl font-semibold">Submitted</h1>
        {result.score != null ? (
          <p className="mt-2 text-4xl font-bold">{result.score} <span className="text-lg text-muted-foreground">/ {result.max_score}</span></p>
        ) : (
          <p className="mt-2 text-muted-foreground">{result.needs_grading ? "Your answers are in. Essay questions will be marked by your teacher and your score will appear on the exams page." : "Your answers have been recorded. Your teacher will release the score."}</p>
        )}
        <button onClick={() => router.push("/dashboard/exams")} className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Back to exams</button>
      </div>
    );
  }

  const q = session.questions[index];
  const isAnswered = (id: string) => answers[id] !== undefined && answers[id] !== "";
  const answered = session.questions.filter((x) => isAnswered(x.id)).length;
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between rounded-xl border border-border bg-card/80 px-4 py-3">
        <span className="text-sm text-muted-foreground">Question {index + 1} of {session.questions.length} · {answered} answered</span>
        <span className={`flex items-center gap-1 font-mono text-lg ${remaining < 60 ? "text-red-300" : ""}`}><Clock size={16} /> {mm}:{ss}</span>
      </div>

      {q && (
        <div className="rounded-xl border border-border bg-card/80 p-6">
          <p className="text-lg font-medium">{q.prompt}</p>
          <p className="text-xs text-muted-foreground">{q.marks} mark{Number(q.marks) === 1 ? "" : "s"}</p>
          {q.type === "short" && (
            <input value={String(answers[q.id] ?? "")} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} placeholder="Type your answer" className="mt-4 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          )}
          {q.type === "essay" && (
            <textarea value={String(answers[q.id] ?? "")} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} placeholder="Write your answer" rows={8} className="mt-4 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          )}
          <div className={`mt-4 space-y-2 ${q.type !== "mcq" ? "hidden" : ""}`}>
            {q.options.map((o, i) => (
              <button
                key={i}
                onClick={() => setAnswers({ ...answers, [q.id]: i })}
                className={`flex w-full items-center gap-3 rounded-md border px-4 py-3 text-left text-sm transition ${answers[q.id] === i ? "border-primary bg-primary/15" : "border-border hover:bg-white/5"}`}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-xs">{String.fromCharCode(65 + i)}</span>
                {o}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {session.questions.map((x, i) => (
            <button key={x.id} onClick={() => setIndex(i)} className={`h-8 w-8 rounded-md text-xs ${i === index ? "bg-primary text-primary-foreground" : isAnswered(x.id) ? "bg-green-500/20 text-green-300" : "bg-white/5"}`}>{i + 1}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0} className="rounded-md border border-input px-3 py-2 text-sm disabled:opacity-50">Previous</button>
          {index < session.questions.length - 1 ? (
            <button onClick={() => setIndex((i) => i + 1)} className="rounded-md bg-secondary px-3 py-2 text-sm font-semibold text-secondary-foreground">Next</button>
          ) : (
            <button onClick={() => confirm(`Submit ${answered} of ${session.questions.length} answers?`) && submit(true)} disabled={submitting} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{submitting ? "Submitting..." : "Submit exam"}</button>
          )}
        </div>
      </div>
    </div>
  );
}
