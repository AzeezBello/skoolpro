"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Copy, KeyRound } from "lucide-react";
import { authFetch } from "@/lib/client/authFetch";

type Token = { id: string; label: string | null; created_at: string; expires_at: string | null; revoked_at: string | null; last_used_at: string | null };

// Per-school public API tokens. The plaintext is shown once at creation.
export function ApiTokensPanel() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [label, setLabel] = useState("");
  const [expiresDays, setExpiresDays] = useState("365");
  const [fresh, setFresh] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const res = await authFetch("/api/api-tokens");
    const json = await res.json();
    if (res.ok) setTokens(json.data || []);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await authFetch("/api/api-tokens", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label, expires_days: Number(expiresDays) }) });
      const json = await res.json();
      if (!res.ok) return toast.error(json.error || "Could not create token");
      setFresh(json.token);
      setLabel("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this token? Integrations using it will stop working immediately.")) return;
    const res = await authFetch(`/api/api-tokens/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) return toast.error(json.error || "Could not revoke");
    toast.success("Token revoked");
    await load();
  }

  return (
    <section className="rounded-xl border border-border bg-card/80 p-6 shadow-soft">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold"><KeyRound size={18} /> Public API tokens</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        For integrations that read students, fee items and invoices via <code>/api/public/*</code>. Send the token in an <code>X-API-Token</code> header.
      </p>
      <form onSubmit={create} className="flex flex-wrap gap-2">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (e.g. Accounting sync)" className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm" />
        <select value={expiresDays} onChange={(e) => setExpiresDays(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
          <option value="30">Expires in 30 days</option>
          <option value="90">Expires in 90 days</option>
          <option value="365">Expires in 1 year</option>
          <option value="0">Never expires</option>
        </select>
        <button type="submit" disabled={busy} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">Create token</button>
      </form>
      {fresh && (
        <div className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
          <p className="mb-1 font-semibold text-amber-300">Copy this token now — it won&apos;t be shown again.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all">{fresh}</code>
            <button onClick={() => navigator.clipboard?.writeText(fresh).then(() => toast.success("Copied"))} className="text-primary"><Copy size={14} /></button>
          </div>
        </div>
      )}
      {tokens.length > 0 && (
        <table className="mt-4 w-full text-left text-sm">
          <thead className="text-muted-foreground"><tr><th className="p-2">Label</th><th className="p-2">Created</th><th className="p-2">Expires</th><th className="p-2">Last used</th><th className="p-2"></th></tr></thead>
          <tbody>
            {tokens.map((t) => (
              <tr key={t.id} className={`border-t border-border/60 ${t.revoked_at ? "opacity-50" : ""}`}>
                <td className="p-2">{t.label || "—"}{t.revoked_at && <span className="ml-2 text-xs text-red-300">revoked</span>}</td>
                <td className="p-2 text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</td>
                <td className="p-2 text-muted-foreground">{t.expires_at ? new Date(t.expires_at).toLocaleDateString() : "never"}</td>
                <td className="p-2 text-muted-foreground">{t.last_used_at ? new Date(t.last_used_at).toLocaleString() : "—"}</td>
                <td className="p-2 text-right">{!t.revoked_at && <button onClick={() => revoke(t.id)} className="text-xs text-red-400">Revoke</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
