"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import toast from "react-hot-toast";
import { CalendarRange } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { TERM_NAME_SUGGESTIONS } from "@/lib/grading";
import { useT } from "@/components/i18n/LocaleProvider";

export interface SessionItem {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
}

interface TermItem {
  id: string;
  session_id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  results_published: boolean;
}

const emptySessionForm = { name: "", start_date: "", end_date: "" };
const emptyTermForm = { name: "", start_date: "", end_date: "" };

type ManageSessionsProps = {
  onSessionsChange?: (sessions: SessionItem[]) => void;
};

export function ManageSessions({ onSessionsChange }: ManageSessionsProps) {
  const { t } = useT();
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [terms, setTerms] = useState<TermItem[]>([]);
  const [sessionForm, setSessionForm] = useState(emptySessionForm);
  const [editingSession, setEditingSession] = useState<SessionItem | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [termForm, setTermForm] = useState(emptyTermForm);
  const [editingTerm, setEditingTerm] = useState<TermItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [termsLoading, setTermsLoading] = useState(false);

  useEffect(() => {
    fetchSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedSessionId) fetchTerms(selectedSessionId);
    else setTerms([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSessionId]);

  const fetchSessions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("sessions")
      .select("id, name, start_date, end_date, is_current")
      .order("start_date", { ascending: false });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const list = data || [];
    setSessions(list);
    onSessionsChange?.(list);
    setSelectedSessionId((prev) => {
      if (prev && list.some((s) => s.id === prev)) return prev;
      const current = list.find((s) => s.is_current) || list[0];
      return current?.id || "";
    });
  };

  const fetchTerms = async (sessionId: string) => {
    setTermsLoading(true);
    const { data, error } = await supabase
      .from("terms")
      .select("id, session_id, name, start_date, end_date, is_current, results_published")
      .eq("session_id", sessionId)
      .order("start_date", { ascending: true });
    setTermsLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setTerms(data || []);
  };

  const resetSessionForm = () => {
    setSessionForm(emptySessionForm);
    setEditingSession(null);
  };

  const startEditSession = (session: SessionItem) => {
    setEditingSession(session);
    setSessionForm({
      name: session.name,
      start_date: session.start_date || "",
      end_date: session.end_date || "",
    });
  };

  const submitSession = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = sessionForm.name.trim();
    if (!name) {
      toast.error("Session name is required (e.g. 2025/2026)");
      return;
    }

    const payload = {
      name,
      start_date: sessionForm.start_date || null,
      end_date: sessionForm.end_date || null,
    };

    const { error } = editingSession
      ? await supabase.from("sessions").update(payload).eq("id", editingSession.id)
      : await supabase.from("sessions").insert([payload]);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(editingSession ? "Session updated" : "Session added");
    resetSessionForm();
    fetchSessions();
  };

  const removeSession = async (id: string) => {
    if (!confirm("Delete this session? Its terms and any results tied to them will be removed too.")) return;
    const { error } = await supabase.from("sessions").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Session deleted");
      if (selectedSessionId === id) setSelectedSessionId("");
      fetchSessions();
    }
  };

  const setAsCurrent = async (id: string) => {
    const { error: clearError } = await supabase.from("sessions").update({ is_current: false }).eq("is_current", true);
    if (clearError) {
      toast.error(clearError.message);
      return;
    }
    const { error } = await supabase.from("sessions").update({ is_current: true }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Current session updated");
    fetchSessions();
  };

  const setCurrentTerm = async (id: string) => {
    const { error: clearError } = await supabase.from("terms").update({ is_current: false }).eq("is_current", true);
    if (clearError) return toast.error(clearError.message);
    const { error } = await supabase.from("terms").update({ is_current: true }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Current term updated");
    fetchTerms(selectedSessionId);
  };

  const togglePublished = async (term: TermItem) => {
    const next = !term.results_published;
    if (
      !confirm(
        next
          ? "Publish results for this term? Students and parents will be able to see their scores and download report cards."
          : "Unpublish results? Students and parents will no longer see scores for this term."
      )
    )
      return;
    const { error } = await supabase
      .from("terms")
      .update({ results_published: next, results_published_at: next ? new Date().toISOString() : null })
      .eq("id", term.id);
    if (error) return toast.error(error.message);
    toast.success(next ? "Results published" : "Results unpublished");
    fetchTerms(selectedSessionId);
  };

  const resetTermForm = () => {
    setTermForm(emptyTermForm);
    setEditingTerm(null);
  };

  const startEditTerm = (term: TermItem) => {
    setEditingTerm(term);
    setTermForm({
      name: term.name,
      start_date: term.start_date || "",
      end_date: term.end_date || "",
    });
  };

  const submitTerm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSessionId) {
      toast.error("Select a session first");
      return;
    }
    const name = termForm.name.trim();
    if (!name) {
      toast.error("Term name is required");
      return;
    }

    const payload = {
      session_id: selectedSessionId,
      name,
      start_date: termForm.start_date || null,
      end_date: termForm.end_date || null,
    };

    const { error } = editingTerm
      ? await supabase.from("terms").update(payload).eq("id", editingTerm.id)
      : await supabase.from("terms").insert([payload]);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(editingTerm ? "Term updated" : "Term added");
    resetTermForm();
    fetchTerms(selectedSessionId);
  };

  const removeTerm = async (id: string) => {
    if (!confirm("Delete this term? Any results tied to it will be removed too.")) return;
    const { error } = await supabase.from("terms").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Term deleted");
      fetchTerms(selectedSessionId);
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">{t("page.sessions.title")}</h1>

        <form
          onSubmit={submitSession}
          className="grid gap-3 rounded-xl border border-border bg-card/80 p-6 shadow-soft md:grid-cols-4"
        >
          <input
            placeholder="Session name (e.g. 2025/2026)"
            value={sessionForm.name}
            onChange={(e) => setSessionForm({ ...sessionForm, name: e.target.value })}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
          <input
            type="date"
            value={sessionForm.start_date}
            onChange={(e) => setSessionForm({ ...sessionForm, start_date: e.target.value })}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
          <input
            type="date"
            value={sessionForm.end_date}
            onChange={(e) => setSessionForm({ ...sessionForm, end_date: e.target.value })}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              {editingSession ? "Update" : "Add session"}
            </button>
            {editingSession && (
              <button
                type="button"
                onClick={resetSessionForm}
                className="rounded-md bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground transition hover:bg-secondary/80"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : sessions.length === 0 ? (
          <EmptyState
            icon={<CalendarRange size={20} />}
            title="No sessions yet"
            description="Add your first academic session above (e.g. 2025/2026)."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card/80 shadow-soft">
            <table className="w-full text-left text-sm">
              <thead className="bg-secondary/40 text-muted-foreground">
                <tr>
                  <th className="p-3">Name</th>
                  <th className="p-3">Start</th>
                  <th className="p-3">End</th>
                  <th className="p-3">Current</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr
                    key={s.id}
                    className={`cursor-pointer border-t border-border/60 ${
                      selectedSessionId === s.id ? "bg-secondary/30" : ""
                    }`}
                    onClick={() => setSelectedSessionId(s.id)}
                  >
                    <td className="p-3 font-medium">{s.name}</td>
                    <td className="p-3 text-muted-foreground">{s.start_date || "—"}</td>
                    <td className="p-3 text-muted-foreground">{s.end_date || "—"}</td>
                    <td className="p-3">
                      {s.is_current ? (
                        <span className="rounded-full bg-green-500/20 px-2 py-1 text-xs font-semibold text-green-300">
                          Current
                        </span>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setAsCurrent(s.id);
                          }}
                          className="rounded-md bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground transition hover:bg-secondary/80"
                        >
                          Set current
                        </button>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditSession(s);
                          }}
                          className="rounded-md bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground transition hover:bg-secondary/80"
                        >
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeSession(s.id);
                          }}
                          className="rounded-md bg-destructive px-3 py-1 text-xs font-semibold text-destructive-foreground transition hover:bg-destructive/80"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedSessionId && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">
            Terms for {sessions.find((s) => s.id === selectedSessionId)?.name}
          </h2>

          <form
            onSubmit={submitTerm}
            className="grid gap-3 rounded-xl border border-border bg-card/80 p-6 shadow-soft md:grid-cols-4"
          >
            <div className="flex flex-wrap gap-2 md:col-span-4">
              {TERM_NAME_SUGGESTIONS.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setTermForm({ ...termForm, name })}
                  className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-primary"
                >
                  {name}
                </button>
              ))}
            </div>
            <input
              placeholder="Term name"
              value={termForm.name}
              onChange={(e) => setTermForm({ ...termForm, name: e.target.value })}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            />
            <input
              type="date"
              value={termForm.start_date}
              onChange={(e) => setTermForm({ ...termForm, start_date: e.target.value })}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            />
            <input
              type="date"
              value={termForm.end_date}
              onChange={(e) => setTermForm({ ...termForm, end_date: e.target.value })}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
              >
                {editingTerm ? "Update" : "Add term"}
              </button>
              {editingTerm && (
                <button
                  type="button"
                  onClick={resetTermForm}
                  className="rounded-md bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground transition hover:bg-secondary/80"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          {termsLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : terms.length === 0 ? (
            <EmptyState
              icon={<CalendarRange size={20} />}
              title="No terms yet"
              description="Add First/Second/Third Term above, with their date ranges."
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card/80 shadow-soft">
              <table className="w-full text-left text-sm">
                <thead className="bg-secondary/40 text-muted-foreground">
                  <tr>
                    <th className="p-3">Name</th>
                    <th className="p-3">Start</th>
                    <th className="p-3">End</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {terms.map((t) => (
                    <tr key={t.id} className="border-t border-border/60">
                      <td className="p-3 font-medium">
                        {t.name}
                        {t.is_current && <span className="ml-2 rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] text-green-300">current</span>}
                        {t.results_published && <span className="ml-2 rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] text-sky-300">published</span>}
                      </td>
                      <td className="p-3 text-muted-foreground">{t.start_date || "—"}</td>
                      <td className="p-3 text-muted-foreground">{t.end_date || "—"}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap justify-end gap-2">
                          {!t.is_current && (
                            <button
                              onClick={() => setCurrentTerm(t.id)}
                              className="rounded-md border border-input px-3 py-1 text-xs hover:bg-white/5"
                            >
                              Set current
                            </button>
                          )}
                          <button
                            onClick={() => togglePublished(t)}
                            className={`rounded-md px-3 py-1 text-xs font-semibold ${t.results_published ? "bg-amber-500/20 text-amber-300" : "bg-green-600 text-white hover:bg-green-700"}`}
                          >
                            {t.results_published ? "Unpublish results" : "Publish results"}
                          </button>
                          <button
                            onClick={() => startEditTerm(t)}
                            className="rounded-md bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground transition hover:bg-secondary/80"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => removeTerm(t.id)}
                            className="rounded-md bg-destructive px-3 py-1 text-xs font-semibold text-destructive-foreground transition hover:bg-destructive/80"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
