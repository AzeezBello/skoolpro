"use client";

import { useEffect, useState } from "react";
import { Megaphone, Pin } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type Announcement = { id: string; title: string; body: string; pinned: boolean; published_at: string; classes?: { name?: string } | null };

// Read-only notice board. RLS filters by the viewer's role/school and hides
// expired notices, so no client-side filtering is needed.
export function AnnouncementsPanel({ limit = 5 }: { limit?: number }) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase
      .from("announcements")
      .select("id, title, body, pinned, published_at, classes(name)")
      .lte("published_at", new Date().toISOString())
      .order("pinned", { ascending: false })
      .order("published_at", { ascending: false })
      .limit(limit)
      .then(({ data }) => {
        setItems((data as any) || []);
        setLoaded(true);
      });
  }, [limit]);

  if (!loaded || items.length === 0) return null;

  return (
    <section className="rounded-xl border border-primary/30 bg-primary/5 p-4">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-primary">
        <Megaphone size={16} /> Announcements
      </h2>
      <ul className="space-y-3">
        {items.map((a) => (
          <li key={a.id} className="text-sm">
            <p className="flex items-center gap-2 font-medium">
              {a.pinned && <Pin size={12} className="text-primary" />}
              {a.title}
              {a.classes?.name && <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px]">{a.classes.name}</span>}
            </p>
            <p className="whitespace-pre-line text-muted-foreground">{a.body}</p>
            <p className="text-[10px] text-muted-foreground">{new Date(a.published_at).toLocaleDateString()}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
