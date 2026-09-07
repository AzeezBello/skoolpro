"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ClipboardCheck, Copy } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentProfile } from "@/lib/hooks/useCurrentProfile";
import { RestrictedNotice } from "@/components/dashboard/RestrictedNotice";
import { EmptyState } from "@/components/ui/empty-state";
import { useT } from "@/components/i18n/LocaleProvider";

type App = { id: string; applicant_name: string; date_of_birth: string | null; gender: string | null; applying_for_class_id: string | null; applying_for_class_name: string | null; previous_school: string | null; parent_name: string; parent_email: string; parent_phone: string | null; address: string | null; notes: string | null; status: string; review_note: string | null; created_at: string; student_id: string | null };

export default function AdmissionsPage() {
  const { t } = useT();
  const { profile, loading: profileLoading } = useCurrentProfile();
  const [apps, setApps] = useState<App[]>([]);
  const [status, setStatus] = useState("pending");
  const [school, setSchool] = useState<{ id: string; slug: string | null; admissions_open: boolean } | null>(null);
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [open, setOpen] = useState<App | null>(null);
  const [classChoice, setClassChoice] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    if (!isAdmin) return;
    supabase.from("schools").select("id, slug, admissions_open").maybeSingle().then(({ data }) => setSchool(data));
    supabase.from("classes").select("id, name").order("name").then(({ data }) => setClasses(data || []));
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, status]);

  async function load() {
    let q = supabase.from("admission_applications").select("*").order("created_at", { ascending: false }).limit(200);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setApps((data as App[]) || []);
  }

  async function toggleOpen() {
    if (!school) return;
    const { error } = await supabase.from("schools").update({ admissions_open: !school.admissions_open }).eq("id", school.id);
    if (error) return toast.error(error.message);
    setSchool({ ...school, admissions_open: !school.admissions_open });
  }

  async function decide(decision: "accepted" | "rejected" | "waitlisted") {
    if (!open) return;
    setBusy(true);
    try {
      let studentId: string | null = null;
      if (decision === "accepted") {
        const { data: student, error } = await supabase
          .from("students")
          .insert([{ full_name: open.applicant_name, date_of_birth: open.date_of_birth, gender: open.gender, class_id: classChoice || open.applying_for_class_id || null, parent_name: open.parent_name, parent_email: open.parent_email, parent_phone: open.parent_phone }])
          .select("id")
          .single();
        if (error) return toast.error(error.message);
        studentId = student.id;
      }
      const { error } = await supabase
        .from("admission_applications")
        .update({ status: decision, reviewed_by: profile?.userId, reviewed_at: new Date().toISOString(), review_note: note || null, student_id: studentId })
        .eq("id", open.id);
      if (error) return toast.error(error.message);
      toast.success(decision === "accepted" ? "Accepted and student record created" : `Marked ${decision}`);
      setOpen(null);
      setNote("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  const applyUrl = school?.slug ? `${typeof window !== "undefined" ? window.location.origin : ""}/apply/${school.slug}` : "";

  if (profileLoading) return <p className="text-sm text-muted-foreground">Loading...</p>;
  if (!isAdmin) return <RestrictedNotice message="Admissions are managed by school admins." />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">{t("page.admissions.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("page.admissions.subtitle")}</p>
        </div>
        {school && (
          <button onClick={toggleOpen} className={`rounded-md px-4 py-2 text-sm font-semibold ${school.admissions_open ? "bg-amber-500/20 text-amber-300" : "bg-primary text-primary-foreground"}`}>
            {school.admissions_open ? "Close admissions" : "Open admissions"}
          </button>
        )}
      </div>

      {applyUrl && (
        <div className="flex flex-col gap-2 rounded-md border border-dashed border-border bg-card/60 p-3 text-xs sm:flex-row sm:items-center">
          <span className="text-muted-foreground">Public application link:</span>
          <code className="flex-1 truncate">{applyUrl}</code>
          <button onClick={() => navigator.clipboard?.writeText(applyUrl).then(() => toast.success("Copied"))} className="flex items-center gap-1 text-primary"><Copy size={12} /> Copy</button>
        </div>
      )}

      <div className="flex gap-1 rounded-lg border border-border bg-card/60 p-1 text-sm">
        {["pending", "waitlisted", "accepted", "rejected", ""].map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={`rounded-md px-3 py-1.5 capitalize ${status === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-white/5"}`}>{s || "all"}</button>
        ))}
      </div>

      {apps.length === 0 ? (
        <EmptyState icon={<ClipboardCheck size={20} />} title="No applications" description={status === "pending" ? "New applications will appear here." : "Nothing in this list."} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card/80 shadow-soft">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary/40 text-muted-foreground"><tr><th className="p-3">Applicant</th><th className="p-3">Class</th><th className="p-3">Parent</th><th className="p-3">Submitted</th><th className="p-3">Status</th><th className="p-3"></th></tr></thead>
            <tbody>
              {apps.map((a) => (
                <tr key={a.id} className="border-t border-border/60">
                  <td className="p-3 font-medium">{a.applicant_name}</td>
                  <td className="p-3 text-muted-foreground">{a.applying_for_class_name || "—"}</td>
                  <td className="p-3 text-muted-foreground">{a.parent_name}<br /><span className="text-xs">{a.parent_email}{a.parent_phone ? ` · ${a.parent_phone}` : ""}</span></td>
                  <td className="p-3 text-muted-foreground">{new Date(a.created_at).toLocaleDateString()}</td>
                  <td className="p-3 capitalize">{a.status}</td>
                  <td className="p-3 text-right"><button onClick={() => { setOpen(a); setClassChoice(a.applying_for_class_id || ""); setNote(a.review_note || ""); }} className="text-xs text-primary">Review</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setOpen(null)}>
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-soft" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-semibold">{open.applicant_name}</h2>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Date of birth</dt><dd>{open.date_of_birth || "—"}</dd>
              <dt className="text-muted-foreground">Gender</dt><dd className="capitalize">{open.gender || "—"}</dd>
              <dt className="text-muted-foreground">Previous school</dt><dd>{open.previous_school || "—"}</dd>
              <dt className="text-muted-foreground">Parent</dt><dd>{open.parent_name}</dd>
              <dt className="text-muted-foreground">Contact</dt><dd>{open.parent_email}{open.parent_phone ? ` · ${open.parent_phone}` : ""}</dd>
              <dt className="text-muted-foreground">Address</dt><dd>{open.address || "—"}</dd>
            </dl>
            {open.notes && <p className="mt-3 whitespace-pre-line rounded-md bg-white/5 p-3 text-sm">{open.notes}</p>}
            {open.status === "pending" || open.status === "waitlisted" ? (
              <div className="mt-4 space-y-3">
                <label className="block text-sm">
                  <span className="mb-1 block text-muted-foreground">Admit into class</span>
                  <select value={classChoice} onChange={(e) => setClassChoice(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="">No class yet</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                <div className="flex flex-wrap justify-end gap-2">
                  <button onClick={() => decide("rejected")} disabled={busy} className="rounded-md border border-red-500/40 px-4 py-2 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-50">Reject</button>
                  <button onClick={() => decide("waitlisted")} disabled={busy} className="rounded-md bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground disabled:opacity-50">Waitlist</button>
                  <button onClick={() => decide("accepted")} disabled={busy} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">Accept &amp; create student</button>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">Reviewed: <span className="capitalize">{open.status}</span>{open.review_note ? ` — ${open.review_note}` : ""}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
