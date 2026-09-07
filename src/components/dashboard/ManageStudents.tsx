"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import toast from "react-hot-toast";
import { Contact, Download, GraduationCap, Upload } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { authFetch } from "@/lib/client/authFetch";
import { parseCsv } from "@/lib/client/csv";
import { exportCsv } from "@/lib/client/exportTable";
import { useT } from "@/components/i18n/LocaleProvider";

interface ClassOption {
  id: string;
  name: string;
}

interface StudentItem {
  id: string;
  full_name: string;
  email?: string | null;
  admission_number?: string | null;
  gender?: string | null;
  date_of_birth?: string | null;
  status?: string;
  parent_name?: string | null;
  parent_email?: string | null;
  parent_phone?: string | null;
  class_id?: string | null;
  classes?: { name?: string } | null;
}

const emptyForm = {
  full_name: "",
  email: "",
  admission_number: "",
  gender: "",
  date_of_birth: "",
  status: "active",
  parent_name: "",
  parent_email: "",
  parent_phone: "",
  class_id: "",
};
const PAGE_SIZE = 25;
const CSV_TEMPLATE = "full_name,admission_number,class_name,gender,date_of_birth,email,parent_name,parent_email,parent_phone\nAda Okafor,ADM001,JSS1A,female,2012-05-14,,Mrs Okafor,parent@example.com,+2348000000000\n";

export function ManageStudents({ canEdit }: { canEdit: boolean }) {
  const { t } = useT();
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<StudentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [page, setPage] = useState(1);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchStudents();
    fetchClasses();
  }, []);

  const fetchStudents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("students")
      .select("id, full_name, email, admission_number, gender, date_of_birth, status, parent_name, parent_email, parent_phone, class_id, classes(name)")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) toast.error(error.message);
    else setStudents((data as any) || []);
  };

  const fetchClasses = async () => {
    const { data } = await supabase.from("classes").select("id, name").order("name");
    setClasses(data || []);
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditing(null);
  };

  const startEdit = (student: StudentItem) => {
    setEditing(student);
    setForm({
      full_name: student.full_name,
      email: student.email || "",
      admission_number: student.admission_number || "",
      gender: student.gender || "",
      date_of_birth: student.date_of_birth || "",
      status: student.status || "active",
      parent_name: student.parent_name || "",
      parent_email: student.parent_email || "",
      parent_phone: student.parent_phone || "",
      class_id: student.class_id || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) {
      toast.error("Full name is required");
      return;
    }

    const payload = {
      full_name: form.full_name.trim(),
      email: form.email.trim() || null,
      admission_number: form.admission_number.trim() || null,
      gender: form.gender || null,
      date_of_birth: form.date_of_birth || null,
      status: form.status || "active",
      parent_name: form.parent_name.trim() || null,
      parent_email: form.parent_email.trim() || null,
      parent_phone: form.parent_phone.trim() || null,
      class_id: form.class_id || null,
    };

    const { error } = editing
      ? await supabase.from("students").update(payload).eq("id", editing.id)
      : await supabase.from("students").insert([payload]);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(editing ? "Student updated" : "Student added");
    resetForm();
    fetchStudents();
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter(
      (s) =>
        (!statusFilter || (s.status || "active") === statusFilter) &&
        (!classFilter || s.class_id === classFilter) &&
        (!q || s.full_name.toLowerCase().includes(q) || (s.admission_number || "").toLowerCase().includes(q) || (s.parent_email || "").toLowerCase().includes(q))
    );
  }, [students, search, classFilter, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, classFilter, statusFilter]);

  const exportStudents = () => {
    exportCsv(
      filtered,
      [
        { header: "full_name", value: (s) => s.full_name },
        { header: "admission_number", value: (s) => s.admission_number || "" },
        { header: "class_name", value: (s) => s.classes?.name || "" },
        { header: "gender", value: (s) => s.gender || "" },
        { header: "date_of_birth", value: (s) => s.date_of_birth || "" },
        { header: "status", value: (s) => s.status || "active" },
        { header: "email", value: (s) => s.email || "" },
        { header: "parent_name", value: (s) => s.parent_name || "" },
        { header: "parent_email", value: (s) => s.parent_email || "" },
        { header: "parent_phone", value: (s) => s.parent_phone || "" },
      ],
      "students.csv"
    );
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "students-template.csv";
    a.click();
  };

  const printIdCards = async () => {
    if (!classFilter) return toast.error("Choose a class in the filter first");
    try {
      const res = await authFetch(`/api/id-cards/class/${classFilter}`);
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        toast.error(payload?.error || "Could not generate ID cards");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      toast.error("Could not generate ID cards");
    }
  };

  const importCsv = async (file: File) => {
    const rows = parseCsv(await file.text());
    if (rows.length === 0) return toast.error("The file has no data rows");
    if (!confirm(`Import ${rows.length} student(s)? Rows with a matching admission number will be updated.`)) return;
    setImporting(true);
    try {
      const res = await authFetch("/api/students/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows }) });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Import failed");
        if (json.errors?.length) console.warn("Import errors", json.errors);
        return;
      }
      toast.success(`Imported: ${json.inserted} added, ${json.updated} updated${json.errors?.length ? `, ${json.errors.length} row(s) skipped` : ""}`, { duration: 6000 });
      if (json.errors?.length) {
        toast.error(json.errors.slice(0, 3).map((e: any) => `Row ${e.row}: ${e.message}`).join("\n"), { duration: 10000 });
      }
      fetchStudents();
      fetchClasses();
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this student? This cannot be undone.")) return;
    const { error } = await supabase.from("students").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Student deleted");
      fetchStudents();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-semibold">{t("page.students.title")}</h1>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportStudents} className="flex items-center gap-1 rounded-md bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80">
            <Download size={14} /> {t("common.export")} CSV
          </button>
          {canEdit && (
            <>
              <button onClick={printIdCards} disabled={!classFilter} title={classFilter ? "Print ID cards for the selected class" : "Select a class first"} className="flex items-center gap-1 rounded-md border border-input px-3 py-2 text-xs hover:bg-white/5 disabled:opacity-50">
                <Contact size={14} /> ID cards
              </button>
              <button onClick={downloadTemplate} className="rounded-md border border-input px-3 py-2 text-xs hover:bg-white/5">CSV template</button>
              <button onClick={() => fileRef.current?.click()} disabled={importing} className="flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                <Upload size={14} /> {importing ? t("common.saving") : `${t("common.import")} CSV`}
              </button>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])} />
            </>
          )}
        </div>
      </div>

      {canEdit && (
        <form
          onSubmit={submit}
          className="grid gap-3 rounded-xl border border-border bg-card/80 p-6 shadow-soft md:grid-cols-2"
        >
          <input
            placeholder="Full name"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
          <select
            value={form.class_id}
            onChange={(e) => setForm({ ...form, class_id: e.target.value })}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="">No class assigned</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            placeholder="Admission number (optional)"
            value={form.admission_number}
            onChange={(e) => setForm({ ...form, admission_number: e.target.value })}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
          <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground">
            <option value="">Gender (optional)</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="whitespace-nowrap">Date of birth</span>
            <input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
          </label>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground">
            <option value="active">Active</option>
            <option value="graduated">Graduated</option>
            <option value="withdrawn">Withdrawn</option>
            <option value="suspended">Suspended</option>
          </select>
          <input
            placeholder="Student email (optional)"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
          <input
            placeholder="Parent name (optional)"
            value={form.parent_name}
            onChange={(e) => setForm({ ...form, parent_name: e.target.value })}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
          <input
            placeholder="Parent email (optional)"
            value={form.parent_email}
            onChange={(e) => setForm({ ...form, parent_email: e.target.value })}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
          <input
            placeholder="Parent phone (optional)"
            value={form.parent_phone}
            onChange={(e) => setForm({ ...form, parent_phone: e.target.value })}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
          <div className="flex gap-2 md:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              {editing ? t("common.update") : t("common.add")}
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

      <div className="flex flex-wrap gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, admission no. or parent email" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:w-72" />
        <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
          <option value="">All classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
          <option value="active">Active</option>
          <option value="graduated">Graduated</option>
          <option value="withdrawn">Withdrawn</option>
          <option value="suspended">Suspended</option>
          <option value="">All statuses</option>
        </select>
        <span className="self-center text-xs text-muted-foreground">{filtered.length} student(s)</span>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<GraduationCap size={20} />}
          title="No students yet"
          description={
            students.length > 0 ? "No students match these filters." : canEdit ? "Add your first student using the form above, or import a CSV." : "Students will show up here once an admin adds them."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card/80 shadow-soft">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary/40 text-muted-foreground">
              <tr>
                <th className="p-3">{t("common.name")}</th>
                <th className="p-3">Adm. No.</th>
                <th className="p-3">{t("common.class")}</th>
                <th className="p-3">{t("common.parent")}</th>
                {canEdit && <th className="p-3 text-right">{t("common.actions")}</th>}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((s) => (
                <tr key={s.id} className="border-t border-border/60">
                  <td className="p-3 font-medium">
                    {s.full_name}
                    {s.status && s.status !== "active" && <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[10px] capitalize">{s.status}</span>}
                  </td>
                  <td className="p-3 text-muted-foreground">{s.admission_number || "—"}</td>
                  <td className="p-3 text-muted-foreground">{s.classes?.name || "—"}</td>
                  <td className="p-3 text-muted-foreground">{s.parent_name || s.parent_email || "—"}</td>
                  {canEdit && (
                    <td className="p-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => startEdit(s)}
                          className="rounded-md bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground transition hover:bg-secondary/80"
                        >
                          {t("common.edit")}
                        </button>
                        <button
                          onClick={() => remove(s.id)}
                          className="rounded-md bg-destructive px-3 py-1 text-xs font-semibold text-destructive-foreground transition hover:bg-destructive/80"
                        >
                          {t("common.delete")}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border/60 p-3 text-sm">
              <span className="text-muted-foreground">Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <button onClick={() => setPage((p) => Math.max(p - 1, 1))} disabled={page <= 1} className="rounded-md border border-input px-3 py-1 disabled:opacity-50">{t("common.previous")}</button>
                <button onClick={() => setPage((p) => Math.min(p + 1, totalPages))} disabled={page >= totalPages} className="rounded-md border border-input px-3 py-1 disabled:opacity-50">{t("common.next")}</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
