"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type Notification = {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

// In-app inbox backed by public.notifications (RLS: recipient only). Polls
// lightly and subscribes to realtime inserts when available.
export function NotificationBell() {
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    if (!userId) return;
    let mounted = true;

    const load = async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id, title, message, is_read, created_at")
        .eq("recipient_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (mounted) setItems((data as Notification[]) || []);
    };
    void load();

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${userId}` }, () => void load())
      .subscribe();
    const interval = window.setInterval(load, 60_000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const unread = items.filter((n) => !n.is_read).length;

  const markAllRead = async () => {
    const ids = items.filter((n) => !n.is_read).map((n) => n.id);
    if (ids.length === 0) return;
    await supabase.from("notifications").update({ is_read: true }).in("id", ids);
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-full bg-shell-hover text-shell-foreground transition hover:opacity-80"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-border bg-card p-2 shadow-soft">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-sm font-semibold">Notifications</span>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-primary">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">You&apos;re all caught up.</p>
            ) : (
              items.map((n) => (
                <div key={n.id} className={`rounded-md px-2 py-2 text-sm ${n.is_read ? "opacity-70" : "bg-shell-hover"}`}>
                  <p className="font-medium">{n.title}</p>
                  <p className="text-xs text-muted-foreground">{n.message}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
