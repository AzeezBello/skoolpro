"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import toast from "react-hot-toast";
import { Users } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { useT } from "@/components/i18n/LocaleProvider";

interface TeacherItem {
  id: string;
  full_name: string;
  subject?: string | null;
  email?: string | null;
}

const emptyForm = { full_name: "", subject: "", email: "" };

export function ManageTeachers({ canEdit }: { canEdit: boolean }) {
  const { t } = useT();
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<TeacherItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeachers();
  }, []);

  const fetchTeachers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("teachers")
      .select("id, full_name, subject, email")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) toast.error(error.message);
    else setTeachers(data || []);
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditing(null);
  };

  const startEdit = (teacher: TeacherItem) => {
    setEditing(teacher);
    setForm({
      full_name: teacher.full_name,
      subject: teacher.subject || "",
      email: teacher.email || "",
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) {
      toast.error("Full name is required");
      return;
    }

    const payload = {
      full_name: form.full_name.trim(),
      subject: form.subject.trim() || null,
      email: form.email.trim() || null,
    };

    const { error } = editing
      ? await supabase.from("teachers").update(payload).eq("id", editing.id)
      : await supabase.from("teachers").insert([payload]);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(editing ? "Teacher updated" : "Teacher added");
    resetForm();
    fetchTeachers();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this teacher? Classes assigned to them will become unassigned.")) return;
    const { error } = await supabase.from("teachers").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Teacher deleted");
      fetchTeachers();
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t("page.teachers.title")}</h1>

      {canEdit && (
        <form
          onSubmit={submit}
          className="grid gap-3 rounded-xl border border-border bg-card/80 p-6 shadow-soft md:grid-cols-3"
        >
          <input
            placeholder="Full name"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
          <input
            placeholder="Subject (optional)"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
          <input
            placeholder="Email (optional)"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
          <div className="flex gap-2 md:col-span-3">
            <button
              type="submit"
              className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              {editing ? "Update teacher" : "Add teacher"}
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
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : teachers.length === 0 ? (
        <EmptyState
          icon={<Users size={20} />}
          title="No teachers yet"
          description={
            canEdit ? "Add your first teacher using the form above." : "Teachers will show up here once an admin adds them."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card/80 shadow-soft">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary/40 text-muted-foreground">
              <tr>
                <th className="p-3">{t("common.name")}</th>
                <th className="p-3">{t("common.subject")}</th>
                <th className="p-3">{t("common.email")}</th>
                {canEdit && <th className="p-3 text-right">{t("common.actions")}</th>}
              </tr>
            </thead>
            <tbody>
              {teachers.map((t) => (
                <tr key={t.id} className="border-t border-border/60">
                  <td className="p-3 font-medium">{t.full_name}</td>
                  <td className="p-3 text-muted-foreground">{t.subject || "—"}</td>
                  <td className="p-3 text-muted-foreground">{t.email || "—"}</td>
                  {canEdit && (
                    <td className="p-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => startEdit(t)}
                          className="rounded-md bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground transition hover:bg-secondary/80"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => remove(t.id)}
                          className="rounded-md bg-destructive px-3 py-1 text-xs font-semibold text-destructive-foreground transition hover:bg-destructive/80"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
