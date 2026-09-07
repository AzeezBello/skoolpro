"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Copy, Mail, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react";
import { authFetch } from "@/lib/client/authFetch";
import { supabase } from "@/lib/supabaseClient";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/components/i18n/LocaleProvider";

type Member = {
  id: string;
  full_name: string;
  role: string;
  related_id: string | null;
  school_id: string | null;
  email: string | null;
  is_self: boolean;
  unassigned: boolean;
  created_at: string;
};

type Invitation = {
  id: string;
  email: string;
  role: string;
  related_id: string | null;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

type Option = { id: string; full_name: string; email?: string | null };

const ROLES = ["admin", "teacher", "student", "parent"] as const;

export function ManageTeam() {
  const { t } = useT();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [teachers, setTeachers] = useState<Option[]>([]);
  const [students, setStudents] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<(typeof ROLES)[number]>("teacher");
  const [inviteRelated, setInviteRelated] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [lastLink, setLastLink] = useState<string | null>(null);

  useEffect(() => {
    void loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [mRes, iRes, tRes, sRes] = await Promise.all([
        authFetch("/api/members?unassigned=1"),
        authFetch("/api/invitations"),
        supabase.from("teachers").select("id, full_name, email").order("full_name"),
        supabase.from("students").select("id, full_name, email").order("full_name"),
      ]);
      const mJson = await mRes.json();
      const iJson = await iRes.json();
      if (!mRes.ok) toast.error(mJson.error || "Could not load members");
      else setMembers(mJson.data || []);
      if (!iRes.ok) toast.error(iJson.error || "Could not load invitations");
      else setInvites(iJson.data || []);
      setTeachers(tRes.data || []);
      setStudents(sRes.data || []);
    } catch {
      toast.error("Could not load team");
    } finally {
      setLoading(false);
    }
  }

  const relatedOptions = useMemo(() => {
    if (inviteRole === "teacher") return teachers;
    if (inviteRole === "student" || inviteRole === "parent") return students;
    return [];
  }, [inviteRole, teachers, students]);

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return toast.error("Enter an email address");
    setBusy(true);
    try {
      const res = await authFetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
          related_id: inviteRelated || null,
          full_name: inviteName,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Could not send invitation");
        return;
      }
      setLastLink(json.link);
      if (json.emailed) toast.success(`Invitation emailed to ${inviteEmail}`);
      else toast.success(`Invitation created${json.emailError ? " (email not sent: " + json.emailError + ")" : ". Share the link below."}`);
      setInviteEmail("");
      setInviteName("");
      setInviteRelated("");
      await loadAll();
    } finally {
      setBusy(false);
    }
  }

  async function revokeInvite(id: string) {
    if (!confirm("Revoke this invitation?")) return;
    const res = await authFetch(`/api/invitations/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) return toast.error(json.error || "Could not revoke");
    toast.success("Invitation revoked");
    setInvites((prev) => prev.filter((i) => i.id !== id));
  }

  async function updateMember(id: string, patch: { role?: string; related_id?: string | null }) {
    const res = await authFetch(`/api/members/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const json = await res.json();
    if (!res.ok) return toast.error(json.error || "Update failed");
    toast.success("Member updated");
    await loadAll();
  }

  async function removeMember(m: Member) {
    if (!confirm(`Remove ${m.full_name} from this school? Their login stays, but they lose access.`)) return;
    const res = await authFetch(`/api/members/${m.id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) return toast.error(json.error || "Could not remove member");
    toast.success("Member removed");
    await loadAll();
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text).then(() => toast.success("Copied"));
  }

  const pending = invites.filter((i) => !i.accepted_at);
  const active = members.filter((m) => !m.unassigned);
  const unassigned = members.filter((m) => m.unassigned);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">{t("page.team.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("page.team.subtitle")}</p>
      </div>

      <section className="rounded-xl border border-border bg-card/80 p-6 shadow-soft">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <UserPlus size={18} /> Invite someone
        </h2>
        <form onSubmit={sendInvite} className="grid gap-3 md:grid-cols-5">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="email@example.com"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm md:col-span-2"
            required
          />
          <input
            value={inviteName}
            onChange={(e) => setInviteName(e.target.value)}
            placeholder="Name (optional)"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <select
            value={inviteRole}
            onChange={(e) => {
              setInviteRole(e.target.value as (typeof ROLES)[number]);
              setInviteRelated("");
            }}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm capitalize"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? "Sending..." : "Send invite"}
          </button>
          {relatedOptions.length > 0 && (
            <select
              value={inviteRelated}
              onChange={(e) => setInviteRelated(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm md:col-span-3"
            >
              <option value="">
                {inviteRole === "parent" ? "Link to child (optional, otherwise matched by parent email)" : `Link to existing ${inviteRole} record (optional)`}
              </option>
              {relatedOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.full_name}
                  {o.email ? ` — ${o.email}` : ""}
                </option>
              ))}
            </select>
          )}
        </form>
        {lastLink && (
          <div className="mt-4 flex flex-col gap-2 rounded-md border border-dashed border-border bg-background/60 p-3 text-xs sm:flex-row sm:items-center">
            <span className="text-muted-foreground">Invitation link:</span>
            <code className="flex-1 truncate">{lastLink}</code>
            <button type="button" onClick={() => copy(lastLink)} className="flex items-center gap-1 text-primary">
              <Copy size={12} /> Copy
            </button>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card/80 p-6 shadow-soft">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Mail size={18} /> Pending invitations <Badge variant="secondary">{pending.length}</Badge>
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending invitations.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="p-2">Email</th>
                  <th className="p-2">Role</th>
                  <th className="p-2">Expires</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {pending.map((i) => (
                  <tr key={i.id} className="border-t border-border/60">
                    <td className="p-2">{i.email}</td>
                    <td className="p-2 capitalize">{i.role}</td>
                    <td className="p-2 text-muted-foreground">{new Date(i.expires_at).toLocaleDateString()}</td>
                    <td className="p-2 text-right">
                      <button onClick={() => revokeInvite(i.id)} className="text-xs text-red-400 hover:text-red-300">
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card/80 p-6 shadow-soft">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <ShieldCheck size={18} /> Members <Badge variant="secondary">{active.length}</Badge>
        </h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : active.length === 0 ? (
          <EmptyState icon={<Users size={20} />} title="No members yet" description="Invite your staff to get started." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="p-2">Name</th>
                  <th className="p-2">Email</th>
                  <th className="p-2">Role</th>
                  <th className="p-2">Linked record</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {active.map((m) => (
                  <MemberRow
                    key={m.id}
                    member={m}
                    teachers={teachers}
                    students={students}
                    onUpdate={updateMember}
                    onRemove={removeMember}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {unassigned.length > 0 && (
        <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6">
          <h2 className="mb-1 text-lg font-semibold">Unassigned sign-ups</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            These accounts registered without an invitation. Claim them into your school with a role, or leave them.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <tbody>
                {unassigned.map((m) => (
                  <tr key={m.id} className="border-t border-border/60">
                    <td className="p-2">{m.full_name}</td>
                    <td className="p-2 text-muted-foreground">{m.email || "-"}</td>
                    <td className="p-2">
                      <div className="flex gap-2">
                        {ROLES.map((r) => (
                          <button
                            key={r}
                            onClick={() => updateMember(m.id, { role: r })}
                            className="rounded-md border border-input px-2 py-1 text-xs capitalize hover:bg-white/5"
                          >
                            Claim as {r}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function MemberRow({
  member,
  teachers,
  students,
  onUpdate,
  onRemove,
}: {
  member: Member;
  teachers: Option[];
  students: Option[];
  onUpdate: (id: string, patch: { role?: string; related_id?: string | null }) => Promise<unknown>;
  onRemove: (m: Member) => Promise<unknown>;
}) {
  const options = member.role === "teacher" ? teachers : member.role === "student" ? students : [];
  const linked = options.find((o) => o.id === member.related_id);

  return (
    <tr className="border-t border-border/60">
      <td className="p-2">
        {member.full_name} {member.is_self && <Badge variant="secondary">you</Badge>}
      </td>
      <td className="p-2 text-muted-foreground">{member.email || "-"}</td>
      <td className="p-2">
        <select
          value={member.role}
          disabled={member.is_self}
          onChange={(e) => onUpdate(member.id, { role: e.target.value })}
          className="rounded-md border border-input bg-background px-2 py-1 text-xs capitalize disabled:opacity-60"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </td>
      <td className="p-2">
        {options.length > 0 ? (
          <select
            value={member.related_id || ""}
            onChange={(e) => onUpdate(member.id, { related_id: e.target.value || null })}
            className="rounded-md border border-input bg-background px-2 py-1 text-xs"
          >
            <option value="">Not linked</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.full_name}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-xs text-muted-foreground">{linked?.full_name || "—"}</span>
        )}
      </td>
      <td className="p-2 text-right">
        {!member.is_self && (
          <button onClick={() => onRemove(member)} className="text-red-400 hover:text-red-300" aria-label="Remove member">
            <Trash2 size={14} />
          </button>
        )}
      </td>
    </tr>
  );
}
