"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import toast from "react-hot-toast";
import { BookOpen } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { useT } from "@/components/i18n/LocaleProvider";

interface Subject {
  id: string;
  name: string;
}

interface ClassItem {
  id: string;
  name: string;
}

type Assignment = { class_id: string; subject_id: string };

export function ManageSubjects() {
  const { t } = useT();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<Subject | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: subjectData, error: subjectError }, { data: classData }, { data: assignmentData }] =
      await Promise.all([
        supabase.from("subjects").select("id, name").order("name"),
        supabase.from("classes").select("id, name").order("name"),
        supabase.from("class_subjects").select("class_id, subject_id"),
      ]);
    setLoading(false);
    if (subjectError) toast.error(subjectError.message);
    setSubjects(subjectData || []);
    setClasses(classData || []);
    setAssignments(assignmentData || []);
  };

  const resetForm = () => {
    setName("");
    setEditing(null);
  };

  const startEdit = (subject: Subject) => {
    setEditing(subject);
    setName(subject.name);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Name is required");
      return;
    }

    const { error } = editing
      ? await supabase.from("subjects").update({ name: trimmed }).eq("id", editing.id)
      : await supabase.from("subjects").insert([{ name: trimmed }]);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(editing ? "Subject updated" : "Subject added");
    resetForm();
    fetchAll();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this subject? It will be removed from every class it's assigned to.")) return;
    const { error } = await supabase.from("subjects").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Subject deleted");
      fetchAll();
    }
  };

  const isAssigned = (classId: string, subjectId: string) =>
    assignments.some((a) => a.class_id === classId && a.subject_id === subjectId);

  const toggleAssignment = async (classId: string, subjectId: string) => {
    const key = `${classId}:${subjectId}`;
    setSavingKey(key);

    if (isAssigned(classId, subjectId)) {
      const { error } = await supabase
        .from("class_subjects")
        .delete()
        .eq("class_id", classId)
        .eq("subject_id", subjectId);
      setSavingKey(null);
      if (error) return toast.error(error.message);
      setAssignments((prev) => prev.filter((a) => !(a.class_id === classId && a.subject_id === subjectId)));
      return;
    }

    const { error } = await supabase.from("class_subjects").insert([{ class_id: classId, subject_id: subjectId }]);
    setSavingKey(null);
    if (error) return toast.error(error.message);
    setAssignments((prev) => [...prev, { class_id: classId, subject_id: subjectId }]);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t("page.subjects.title")}</h1>

      <form
        onSubmit={submit}
        className="grid gap-3 rounded-xl border border-border bg-card/80 p-6 shadow-soft md:grid-cols-3"
      >
        <input
          placeholder="Subject name (e.g. Mathematics)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground md:col-span-2"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            {editing ? "Update" : "Add subject"}
          </button>
          {editing && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-md bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground transition hover:bg-secondary/80"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : subjects.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={20} />}
          title="No subjects yet"
          description="Add your first subject above, then assign it to classes below."
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-border bg-card/80 shadow-soft">
            <table className="w-full text-left text-sm">
              <thead className="bg-secondary/40 text-muted-foreground">
                <tr>
                  <th className="p-3">Name</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((s) => (
                  <tr key={s.id} className="border-t border-border/60">
                    <td className="p-3 font-medium">{s.name}</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => startEdit(s)}
                          className="rounded-md bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground transition hover:bg-secondary/80"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => remove(s.id)}
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

          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold">Assign subjects to classes</h2>
              <p className="text-sm text-muted-foreground">
                Every student in a class takes that class&apos;s assigned subjects.
              </p>
            </div>

            {classes.length === 0 ? (
              <EmptyState
                icon={<BookOpen size={20} />}
                title="No classes yet"
                description="Create a class first (see Classes), then assign subjects to it here."
              />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border bg-card/80 shadow-soft">
                <table className="w-full text-left text-sm">
                  <thead className="bg-secondary/40 text-muted-foreground">
                    <tr>
                      <th className="p-3">Class</th>
                      {subjects.map((s) => (
                        <th key={s.id} className="p-3 text-center">
                          {s.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {classes.map((c) => (
                      <tr key={c.id} className="border-t border-border/60">
                        <td className="p-3 font-medium">{c.name}</td>
                        {subjects.map((s) => {
                          const key = `${c.id}:${s.id}`;
                          return (
                            <td key={s.id} className="p-3 text-center">
                              <input
                                type="checkbox"
                                checked={isAssigned(c.id, s.id)}
                                disabled={savingKey === key}
                                onChange={() => toggleAssignment(c.id, s.id)}
                                className="h-4 w-4 accent-primary"
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
