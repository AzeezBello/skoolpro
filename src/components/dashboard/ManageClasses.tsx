"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import toast from "react-hot-toast";
import { BookOpen } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { useT } from "@/components/i18n/LocaleProvider";

interface Teacher {
  id: string;
  full_name: string;
}

interface ClassItem {
  id: string;
  name: string;
  teacher_id?: string | null;
  next_class_id?: string | null;
  teachers?: { full_name?: string } | null;
  students?: Array<{ count: number }>;
}

const emptyForm = { name: "", teacher_id: "", next_class_id: "" };

export function ManageClasses() {
  const { t } = useT();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<ClassItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void fetchClasses();
    supabase.from("teachers").select("id, full_name").order("full_name").then(({ data }) => setTeachers(data || []));
  }, []);

  const fetchClasses = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("classes")
      .select("id, name, teacher_id, next_class_id, teachers(full_name), students(count)")
      .order("name");
    setLoading(false);
    if (error) toast.error(error.message);
    else setClasses((data as any) || []);
  };

  const startEdit = (cls: ClassItem) => {
    setEditing(cls);
    setForm({ name: cls.name, teacher_id: cls.teacher_id || "", next_class_id: cls.next_class_id || "" });
    nameInputRef.current?.focus();
  };

  const reset = () => {
    setEditing(null);
    setForm(emptyForm);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) return toast.error("Class name is required");
    if (editing && form.next_class_id === editing.id) return toast.error("A class cannot promote to itself");

    const payload = { name, teacher_id: form.teacher_id || null, next_class_id: form.next_class_id || null };
    setSaving(true);
    const { error } = editing
      ? await supabase.from("classes").update(payload).eq("id", editing.id)
      : await supabase.from("classes").insert([payload]);
    setSaving(false);

    if (error) return toast.error(error.code === "23505" ? "A class with that name already exists" : error.message);
    toast.success(editing ? "Class updated" : "Class added");
    reset();
    await fetchClasses();
  };

  const remove = async (cls: ClassItem) => {
    const count = cls.students?.[0]?.count || 0;
    if (count > 0) return toast.error(`${cls.name} still has ${count} student(s). Move them first.`);
    if (!confirm(`Delete ${cls.name}?`)) return;
    const { error } = await supabase.from("classes").delete().eq("id", cls.id);
    if (error) return toast.error(error.message);
    toast.success("Class deleted");
    await fetchClasses();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t("page.classes.title")}</h1>

      <form onSubmit={submit} className="grid gap-3 rounded-xl border border-border bg-card/80 p-6 shadow-soft md:grid-cols-4">
        <input
          ref={nameInputRef}
          placeholder="Class name (e.g. JSS1A)"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          required
        />
        <select value={form.teacher_id} onChange={(e) => setForm({ ...form, teacher_id: e.target.value })} className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground">
          <option value="">Class teacher (optional)</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>{t.full_name}</option>
          ))}
        </select>
        <select value={form.next_class_id} onChange={(e) => setForm({ ...form, next_class_id: e.target.value })} className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground">
          <option value="">Promotes to (none = graduating class)</option>
          {classes.filter((c) => c.id !== editing?.id).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <button type="submit" disabled={saving} className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50">
            {editing ? t("common.update") : t("common.add")}
          </button>
          {editing && (
            <button type="button" onClick={reset} className="rounded-md bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground hover:bg-secondary/80">{t("common.cancel")}</button>
          )}
        </div>
      </form>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : classes.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={20} />}
          title="No classes yet"
          description="Create your first class above, then assign a teacher and students to it."
          action={
            <button type="button" onClick={() => nameInputRef.current?.focus()} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Add a class</button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card/80 shadow-soft">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary/40 text-muted-foreground">
              <tr>
                <th className="p-3">{t("common.class")}</th>
                <th className="p-3">{t("common.teacher")}</th>
                <th className="p-3">{t("page.students.title")}</th>
                <th className="p-3">Promotes to</th>
                <th className="p-3 text-right">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((cls) => (
                <tr key={cls.id} className="border-t border-border/60">
                  <td className="p-3 font-medium">{cls.name}</td>
                  <td className="p-3 text-muted-foreground">{cls.teachers?.full_name || "—"}</td>
                  <td className="p-3 text-muted-foreground">{cls.students?.[0]?.count ?? 0}</td>
                  <td className="p-3 text-muted-foreground">{classes.find((c) => c.id === cls.next_class_id)?.name || "Graduates"}</td>
                  <td className="p-3">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => startEdit(cls)} className="rounded-md bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80">{t("common.edit")}</button>
                      <button onClick={() => remove(cls)} className="rounded-md bg-destructive px-3 py-1 text-xs font-semibold text-destructive-foreground hover:bg-destructive/80">{t("common.delete")}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
