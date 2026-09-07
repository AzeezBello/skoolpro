"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { MessageSquare, Send } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentProfile } from "@/lib/hooks/useCurrentProfile";
import { EmptyState } from "@/components/ui/empty-state";
import { useT } from "@/components/i18n/LocaleProvider";

type Contact = { id: string; full_name: string; role: string };
type Message = { id: string; sender_id: string; receiver_id: string; content: string; created_at: string; read_at: string | null };

// Direct messages within a school. Students and parents can reach staff;
// staff can reach anyone. Threads are grouped per contact.
export default function MessagesPage() {
  const { t } = useT();
  const { profile, loading } = useCurrentProfile();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [active, setActive] = useState<string>("");
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (loading || !profile) return;
    (async () => {
      let query = supabase.from("profiles").select("id, full_name, role").neq("id", profile.userId).order("full_name");
      if (profile.role === "student" || profile.role === "parent") query = query.in("role", ["admin", "teacher"]);
      const { data, error } = await query;
      if (error) toast.error(error.message);
      setContacts((data as Contact[]) || []);
    })();
    void loadMessages();

    const channel = supabase
      .channel(`messages-${profile.userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => void loadMessages())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, profile]);

  async function loadMessages() {
    const { data } = await supabase.from("messages").select("*").order("created_at", { ascending: true }).limit(1000);
    setMessages((data as Message[]) || []);
  }

  const threads = useMemo(() => {
    const map = new Map<string, { last: Message; unread: number }>();
    for (const m of messages) {
      const other = m.sender_id === profile?.userId ? m.receiver_id : m.sender_id;
      const entry = map.get(other) || { last: m, unread: 0 };
      entry.last = m;
      if (m.receiver_id === profile?.userId && !m.read_at) entry.unread += 1;
      map.set(other, entry);
    }
    return map;
  }, [messages, profile]);

  const contactList = useMemo(() => {
    const list = contacts.filter((c) => c.full_name.toLowerCase().includes(search.toLowerCase()));
    return list.sort((a, b) => {
      const ta = threads.get(a.id)?.last.created_at || "";
      const tb = threads.get(b.id)?.last.created_at || "";
      return tb.localeCompare(ta);
    });
  }, [contacts, search, threads]);

  const thread = messages.filter((m) => m.sender_id === active || m.receiver_id === active);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    if (!active || !profile) return;
    const unread = thread.filter((m) => m.receiver_id === profile.userId && !m.read_at).map((m) => m.id);
    if (unread.length) {
      supabase.from("messages").update({ read_at: new Date().toISOString() }).in("id", unread).then(() => loadMessages());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, thread.length]);

  async function send() {
    if (!draft.trim() || !active || !profile) return;
    const content = draft.trim();
    setDraft("");
    const { error } = await supabase.from("messages").insert([{ sender_id: profile.userId, receiver_id: active, content }]);
    if (error) {
      toast.error(error.message);
      setDraft(content);
      return;
    }
    await loadMessages();
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading...</p>;

  const activeContact = contacts.find((c) => c.id === active);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t("page.messages.title")}</h1>
      <div className="grid min-h-[60vh] grid-cols-1 overflow-hidden rounded-xl border border-border bg-card/80 shadow-soft md:grid-cols-[280px_1fr]">
        <aside className={`border-b border-border md:border-b-0 md:border-r ${active ? "hidden md:block" : ""}`}>
          <div className="p-3">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search people" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <ul className="max-h-[60vh] overflow-y-auto">
            {contactList.length === 0 && <li className="p-3 text-xs text-muted-foreground">No contacts found.</li>}
            {contactList.map((c) => {
              const t = threads.get(c.id);
              return (
                <li key={c.id}>
                  <button
                    onClick={() => setActive(c.id)}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition hover:bg-white/5 ${active === c.id ? "bg-white/10" : ""}`}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{c.full_name}</p>
                      <p className="truncate text-xs text-muted-foreground">{t?.last.content || <span className="capitalize">{c.role}</span>}</p>
                    </div>
                    {t?.unread ? <span className="ml-2 rounded-full bg-primary px-2 text-[10px] font-semibold text-primary-foreground">{t.unread}</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <section className={`flex flex-col ${!active ? "hidden md:flex" : ""}`}>
          {!active ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <EmptyState icon={<MessageSquare size={20} />} title="Pick a conversation" description="Choose someone on the left to start messaging." />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <button onClick={() => setActive("")} className="text-xs text-muted-foreground md:hidden">
                  ← Back
                </button>
                <p className="font-medium">{activeContact?.full_name}</p>
                <span className="text-xs capitalize text-muted-foreground">{activeContact?.role}</span>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto p-4">
                {thread.length === 0 && <p className="text-center text-xs text-muted-foreground">No messages yet. Say hello!</p>}
                {thread.map((m) => (
                  <div key={m.id} className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${m.sender_id === profile?.userId ? "ml-auto bg-primary text-primary-foreground" : "bg-white/10"}`}>
                    <p className="whitespace-pre-line">{m.content}</p>
                    <p className="mt-1 text-[10px] opacity-70">{new Date(m.created_at).toLocaleString()}</p>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void send();
                }}
                className="flex gap-2 border-t border-border p-3"
              >
                <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type a message" className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm" />
                <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90" aria-label="Send">
                  <Send size={16} />
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
