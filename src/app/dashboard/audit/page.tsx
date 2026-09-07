"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ScrollText } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentProfile } from "@/lib/hooks/useCurrentProfile";
import { RestrictedNotice } from "@/components/dashboard/RestrictedNotice";
import { EmptyState } from "@/components/ui/empty-state";
import { useT } from "@/components/i18n/LocaleProvider";

type AuditRow = { id: string; action: string; actor_email: string | null; entity_type: string | null; entity_id: string | null; details: Record<string, unknown>; created_at: string };
type EmailRow = { id: string; to_email: string; subject: string; status: string; error: string | null; created_at: string; sent_at: string | null };

const PAGE = 50;

export default function AuditPage() {
  const { t } = useT();
  const { profile, loading: profileLoading } = useCurrentProfile();
  const [tab, setTab] = useState<"audit" | "email">("audit");
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [emails, setEmails] = useState<EmailRow[]>([]);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);

  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      setLoading(true);
      if (tab === "audit") {
        let q = supabase.from("audit_log").select("id, action, actor_email, entity_type, entity_id, details, created_at").order("created_at", { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
        if (filter) q = q.ilike("action", `${filter}%`);
        const { data, error } = await q;
        if (error) toast.error(error.message);
        setAudit((data as any) || []);
      } else {
        const { data, error } = await supabase.from("email_log").select("id, to_email, subject, status, error, created_at, sent_at").order("created_at", { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
        if (error) toast.error(error.message);
        setEmails((data as any) || []);
      }
      setLoading(false);
    })();
  }, [isAdmin, tab, page, filter]);

  if (profileLoading) return <p className="text-sm text-muted-foreground">Loading...</p>;
  if (!isAdmin) return <RestrictedNotice message="The activity log is visible to school admins." />;

  const rows = tab === "audit" ? audit.length : emails.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">{t("page.audit.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("page.audit.subtitle")}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-md border border-input text-sm">
          <button onClick={() => { setTab("audit"); setPage(0); }} className={`px-3 py-2 ${tab === "audit" ? "bg-white/10" : ""}`}>Actions</button>
          <button onClick={() => { setTab("email"); setPage(0); }} className={`px-3 py-2 ${tab === "email" ? "bg-white/10" : ""}`}>Emails</button>
        </div>
        {tab === "audit" && (
          <select value={filter} onChange={(e) => { setFilter(e.target.value); setPage(0); }} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="">All actions</option>
            <option value="invoice">Invoices</option>
            <option value="member">Members</option>
            <option value="invitation">Invitations</option>
            <option value="api_token">API tokens</option>
            <option value="school">School</option>
          </select>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card/80 shadow-soft">
        {loading ? (
          <p className="p-4 text-sm text-muted-foreground">Loading...</p>
        ) : rows === 0 ? (
          <div className="p-4"><EmptyState icon={<ScrollText size={20} />} title="Nothing here yet" /></div>
        ) : tab === "audit" ? (
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary/40 text-muted-foreground">
              <tr><th className="p-3">When</th><th className="p-3">Who</th><th className="p-3">Action</th><th className="p-3">Details</th></tr>
            </thead>
            <tbody>
              {audit.map((r) => (
                <tr key={r.id} className="border-t border-border/60 align-top">
                  <td className="p-3 whitespace-nowrap text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="p-3">{r.actor_email || "system"}</td>
                  <td className="p-3 font-mono text-xs">{r.action}</td>
                  <td className="p-3 text-xs text-muted-foreground">{summarize(r.details)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary/40 text-muted-foreground">
              <tr><th className="p-3">When</th><th className="p-3">To</th><th className="p-3">Subject</th><th className="p-3">Status</th></tr>
            </thead>
            <tbody>
              {emails.map((r) => (
                <tr key={r.id} className="border-t border-border/60 align-top">
                  <td className="p-3 whitespace-nowrap text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="p-3">{r.to_email}</td>
                  <td className="p-3">{r.subject}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${r.status === "sent" ? "bg-green-500/20 text-green-300" : r.status === "failed" ? "bg-red-500/20 text-red-300" : "bg-white/10"}`}>{r.status}</span>
                    {r.error && <p className="mt-1 text-xs text-red-300">{r.error}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex justify-end gap-2 text-sm">
        <button onClick={() => setPage((p) => Math.max(p - 1, 0))} disabled={page === 0 || loading} className="rounded-md border border-input px-3 py-1 disabled:opacity-50">Previous</button>
        <button onClick={() => setPage((p) => p + 1)} disabled={rows < PAGE || loading} className="rounded-md border border-input px-3 py-1 disabled:opacity-50">Next</button>
      </div>
    </div>
  );
}

function summarize(details: Record<string, unknown>) {
  return Object.entries(details || {})
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(" · ");
}
