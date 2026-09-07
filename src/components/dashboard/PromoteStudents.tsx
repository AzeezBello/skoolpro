"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import toast from "react-hot-toast";
import { Users } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import type { SessionItem } from "@/components/dashboard/ManageSessions";

interface ClassItem {
  id: string;
  name: string;
  next_class_id: string | null;
}

interface StudentItem {
  id: string;
  full_name: string;
  class_id: string | null;
}

const GRADUATE = "__graduate__";

export function PromoteStudents({ sessions }: { sessions: SessionItem[] }) {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [targetSessionId, setTargetSessionId] = useState("");
  const [sourceSessionId, setSourceSessionId] = useState("");
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchBaseData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (sessions.length > 0 && !targetSessionId) {
      const current = sessions.find((s) => s.is_current) || sessions[0];
      setTargetSessionId(current.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions]);

  useEffect(() => {
    if (targetSessionId && students.length > 0) loadAssignmentsForSession(targetSessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetSessionId, students]);

  const fetchBaseData = async () => {
    setLoading(true);
    const [{ data: classData }, { data: studentData, error: studentError }] = await Promise.all([
      supabase.from("classes").select("id, name, next_class_id").order("name"),
      supabase.from("students").select("id, full_name, class_id").eq("status", "active").order("full_name"),
    ]);
    setLoading(false);
    if (studentError) {
      toast.error(studentError.message);
      return;
    }
    setClasses(classData || []);
    setStudents(studentData || []);
  };

  const loadAssignmentsForSession = async (sessionId: string) => {
    const { data, error } = await supabase
      .from("student_enrollments")
      .select("student_id, class_id")
      .eq("session_id", sessionId);

    if (error) {
      toast.error(error.message);
      return;
    }

    const next: Record<string, string> = {};
    students.forEach((s) => {
      const existing = (data || []).find((e: any) => e.student_id === s.id);
      next[s.id] = existing?.class_id || s.class_id || "";
    });
    setAssignments(next);
  };

  const copyFromSession = async () => {
    if (!sourceSessionId) {
      toast.error("Pick a session to copy from");
      return;
    }
    const { data, error } = await supabase
      .from("student_enrollments")
      .select("student_id, class_id")
      .eq("session_id", sourceSessionId);

    if (error) {
      toast.error(error.message);
      return;
    }

    setAssignments((prev) => {
      const next = { ...prev };
      (data || []).forEach((e: any) => {
        if (e.class_id) next[e.student_id] = e.class_id;
      });
      return next;
    });
    toast.success("Copied — review and save");
  };

  const updateAssignment = (studentId: string, classId: string) => {
    setAssignments((prev) => ({ ...prev, [studentId]: classId }));
  };

  const promoteUpOneLevel = () => {
    if (classes.length === 0) {
      toast.error("No classes found");
      return;
    }
    if (
      !confirm(
        "This replaces every student's class below with their current class's configured \"Promotes to\" class. Continue?"
      )
    ) {
      return;
    }

    let skipped = 0;
    setAssignments((prev) => {
      const next = { ...prev };
      students.forEach((s) => {
        const currentClass = classes.find((c) => c.id === s.class_id);
        if (currentClass?.next_class_id) {
          next[s.id] = currentClass.next_class_id;
        } else if (currentClass) {
          // Top of the ladder: graduate instead of re-enrolling in the same class.
          next[s.id] = GRADUATE;
        } else {
          skipped += 1;
        }
      });
      return next;
    });

    if (skipped > 0) {
      toast.error(
        `${skipped} student(s) have no "Promotes to" class configured for their current class — review them manually before saving.`,
        { duration: 6000 }
      );
    } else {
      toast.success("Promoted everyone up one level — review and save");
    }
  };

  const save = async () => {
    if (!targetSessionId) {
      toast.error("Select a target session first");
      return;
    }

    const graduating = students.filter((s) => assignments[s.id] === GRADUATE);
    const rows = students
      .filter((s) => assignments[s.id] && assignments[s.id] !== GRADUATE)
      .map((s) => ({
        student_id: s.id,
        session_id: targetSessionId,
        class_id: assignments[s.id],
      }));

    if (rows.length === 0 && graduating.length === 0) {
      toast.error("Assign at least one student to a class first");
      return;
    }

    setSaving(true);
    const { error } = rows.length
      ? await supabase.from("student_enrollments").upsert(rows, { onConflict: "student_id,session_id" })
      : { error: null };

    if (error) {
      setSaving(false);
      toast.error(error.message);
      return;
    }

    if (graduating.length > 0) {
      const { error: gradError } = await supabase
        .from("students")
        .update({ status: "graduated", class_id: null })
        .in("id", graduating.map((s) => s.id));
      if (gradError) {
        setSaving(false);
        toast.error(gradError.message);
        return;
      }
    }

    // Only the current session's enrollment doubles as each student's
    // "current class" used by attendance/teacher/admin views elsewhere;
    // editing a past or future session's enrollment leaves that untouched.
    const targetSession = sessions.find((s) => s.id === targetSessionId);
    if (targetSession?.is_current) {
      const byClass = new Map<string, string[]>();
      for (const row of rows) (byClass.get(row.class_id) ?? byClass.set(row.class_id, []).get(row.class_id)!).push(row.student_id);
      for (const [classId, ids] of byClass) {
        const { error: updateError } = await supabase.from("students").update({ class_id: classId }).in("id", ids);
        if (updateError) toast.error(updateError.message);
      }
    }
    await fetchBaseData();

    setSaving(false);
    toast.success("Enrollment saved");
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Promote students</h2>
        <p className="text-sm text-muted-foreground">
          Assign each student&apos;s class for a session. Saving against the current session also updates their current
          class used across attendance and dashboards. The &quot;Promote everyone up one level&quot; shortcut uses each
          class&apos;s &quot;Promotes to&quot; setting from the Classes page; students in a class with no next class are graduated.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card/80 p-6 shadow-soft">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Session to edit</label>
          <select
            value={targetSessionId}
            onChange={(e) => setTargetSessionId(e.target.value)}
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
        </div>

        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Copy assignments from</label>
          <div className="flex gap-2">
            <select
              value={sourceSessionId}
              onChange={(e) => setSourceSessionId(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="">Select session</option>
              {sessions
                .filter((s) => s.id !== targetSessionId)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
            <button
              type="button"
              onClick={copyFromSession}
              className="rounded-md bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground transition hover:bg-secondary/80"
            >
              Copy
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Shortcut</label>
          <button
            type="button"
            onClick={promoteUpOneLevel}
            className="rounded-md bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground transition hover:bg-secondary/80"
          >
            Promote everyone up one level
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : students.length === 0 ? (
        <EmptyState icon={<Users size={20} />} title="No students yet" />
      ) : !targetSessionId ? (
        <EmptyState icon={<Users size={20} />} title="Select a session above to assign classes" />
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-xl border border-border bg-card/80 shadow-soft">
            <table className="w-full text-left text-sm">
              <thead className="bg-secondary/40 text-muted-foreground">
                <tr>
                  <th className="p-3">Student</th>
                  <th className="p-3">Current class</th>
                  <th className="p-3">Class for this session</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id} className="border-t border-border/60">
                    <td className="p-3 font-medium">{s.full_name}</td>
                    <td className="p-3 text-muted-foreground">
                      {classes.find((c) => c.id === s.class_id)?.name || "—"}
                    </td>
                    <td className="p-3">
                      <select
                        value={assignments[s.id] || ""}
                        onChange={(e) => updateAssignment(s.id, e.target.value)}
                        className="rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
                      >
                        <option value="">Unassigned</option>
                        <option value={GRADUATE}>Graduate (leave school)</option>
                        {classes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={save}
            disabled={saving}
            className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save enrollment"}
          </button>
        </div>
      )}
    </div>
  );
}
