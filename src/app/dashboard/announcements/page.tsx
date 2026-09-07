"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Megaphone } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentProfile } from "@/lib/hooks/useCurrentProfile";
import { RestrictedNotice } from "@/components/dashboard/RestrictedNotice";
import { EmptyState } from "@/components/ui/empty-state";
import { useT } from "@/components/i18n/LocaleProvider";

type Announcement = {
  id: string;
  title: string;
  body: string;
  audience: string[] | null;
  class_id: string | null;
  pinned: boolean;
  published_at: string;
  expires_at: string | null;
  classes?: { name?: string } | null;
};

const AUDIENCES = ["teacher", "student", "parent"] as const;

export default function AnnouncementsPage() {
  const { t } = useT();
  const { profile, loading: profileLoading } = useCurrentProfile();
  const [items, setItems] = useState<Announcement[]>([]);
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [form, setForm] = useState({ title: "", body: "", audience: [] as string[], class_id: "", pinned: false, expires_at: "" });
  const [saving, setSaving] = useState(false);

  const canManage = profile?.role === "admin" || profile?.role === "teacher";

  useEffect(() => {
    if (!canManage) return;
    void load();
    supabase.from("classes").select("id, name").order("name").then(({ data }) => setClasses(data || []));
  }, [canManage]);

  async function load() {
    const { data, error } = await supabase
      .from("announcements")
      .select("id, title, body, audience, class_id, pinned, published_at, expires_at, classes(name)")
      .order("pinned", { ascending: false })
      .order("published_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems((data as any) || []);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) return toast.error("Title and message are required");
    setSaving(true);
    const { error } = await supabase.from("announcements").insert([
      {
        title: form.title.trim(),
        body: form.body.trim(),
        audience: form.audience.length ? form.audience : null,
        class_id: form.class_id || null,
        pinned: form.pinned,
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
        created_by: profile?.userId,
      },
    ]);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Announcement posted");
    setForm({ title: "", body: "", audience: [], class_id: "", pinned: false, expires_at: "" });
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this announcement?")) return;
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setItems((prev) => prev.filter((a) => a.id !== id));
  }

  async function togglePin(a: Announcement) {
    const { error } = await supabase.from("announcements").update({ pinned: !a.pinned }).eq("id", a.id);
    if (error) return toast.error(error.message);
    await load();
  }

  if (profileLoading) return <p className="text-sm text-muted-foreground">Loading...</p>;
  if (!canManage) return <RestrictedNotice message="Announcements are posted by admins and teachers." />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">{t("page.announcements.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("page.announcements.subtitle")}</p>
      </div>

      <form onSubmit={submit} className="grid gap-3 rounded-xl border border-border bg-card/80 p-6 shadow-soft">
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" className="rounded-md border border-input bg-background px-3 py-2 text-sm" required />
        <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Message" rows={4} className="rounded-md border border-input bg-background px-3 py-2 text-sm" required />
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="text-muted-foreground">Audience:</span>
          {AUDIENCES.map((a) => (
            <label key={a} className="flex items-center gap-1 capitalize">
              <input
                type="checkbox"
                checked={form.audience.includes(a)}
                onChange={(e) => setForm({ ...form, audience: e.target.checked ? [...form.audience, a] : form.audience.filter((x) => x !== a) })}
              />
              {a}
            </label>
          ))}
          <span className="text-xs text-muted-foreground">(none selected = everyone)</span>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <select value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="">Whole school</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} only
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Expires</span>
            <input type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} /> Pin to top
          </label>
        </div>
        <button type="submit" disabled={saving} className="w-fit rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {saving ? "Posting..." : "Post announcement"}
        </button>
      </form>

      {items.length === 0 ? (
        <EmptyState icon={<Megaphone size={20} />} title="No announcements yet" description="Post your first notice above." />
      ) : (
        <ul className="space-y-3">
          {items.map((a) => (
            <li key={a.id} className="rounded-xl border border-border bg-card/80 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {a.pinned && <span className="mr-2 text-xs text-primary">PINNED</span>}
                    {a.title}
                  </p>
                  <p className="whitespace-pre-line text-sm text-muted-foreground">{a.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(a.published_at).toLocaleString()} · {a.audience?.length ? a.audience.join(", ") : "everyone"}
                    {a.classes?.name ? ` · ${a.classes.name}` : ""}
                    {a.expires_at ? ` · expires ${new Date(a.expires_at).toLocaleDateString()}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2 text-xs">
                  <button onClick={() => togglePin(a)} className="text-primary">
                    {a.pinned ? "Unpin" : "Pin"}
                  </button>
                  <button onClick={() => remove(a.id)} className="text-red-400">
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
