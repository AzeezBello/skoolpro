"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { BedDouble, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentProfile } from "@/lib/hooks/useCurrentProfile";
import { EmptyState } from "@/components/ui/empty-state";
import { useT } from "@/components/i18n/LocaleProvider";

type Hostel = { id: string; name: string; gender: string | null; warden_name: string | null; warden_phone: string | null };
type Room = { id: string; hostel_id: string; name: string; capacity: number };
type Allocation = { id: string; room_id: string; student_id: string; bed_label: string | null; allocated_at: string; vacated_at: string | null; students?: { full_name?: string; classes?: { name?: string } | null } | null };

export default function HostelPage() {
  const { t } = useT();
  const { profile, loading: profileLoading } = useCurrentProfile();
  const isAdmin = profile?.role === "admin";
  const isStaff = isAdmin || profile?.role === "teacher";
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [students, setStudents] = useState<Array<{ id: string; full_name: string }>>([]);
  const [selected, setSelected] = useState("");
  const [hostelForm, setHostelForm] = useState({ name: "", gender: "", warden_name: "", warden_phone: "" });
  const [roomForm, setRoomForm] = useState({ name: "", capacity: "4" });
  const [allocForm, setAllocForm] = useState({ room_id: "", student_id: "", bed_label: "" });

  useEffect(() => {
    if (profileLoading) return;
    void load();
    if (isAdmin) supabase.from("students").select("id, full_name").eq("status", "active").order("full_name").then(({ data }) => setStudents(data || []));
  }, [profileLoading, isAdmin]);

  async function load() {
    const [{ data: h }, { data: r }, { data: a }] = await Promise.all([
      supabase.from("hostels").select("*").order("name"),
      supabase.from("hostel_rooms").select("*").order("name"),
      supabase.from("hostel_allocations").select("*, students(full_name, classes(name))").is("vacated_at", null),
    ]);
    setHostels((h as Hostel[]) || []);
    setRooms((r as Room[]) || []);
    setAllocations((a as Allocation[]) || []);
    setSelected((prev) => prev || h?.[0]?.id || "");
  }

  async function addHostel(e: React.FormEvent) {
    e.preventDefault();
    if (!hostelForm.name.trim()) return;
    const { error } = await supabase.from("hostels").insert([{ name: hostelForm.name.trim(), gender: hostelForm.gender || null, warden_name: hostelForm.warden_name || null, warden_phone: hostelForm.warden_phone || null }]);
    if (error) return toast.error(error.message);
    setHostelForm({ name: "", gender: "", warden_name: "", warden_phone: "" });
    await load();
  }

  async function removeHostel(h: Hostel) {
    if (!confirm(`Delete ${h.name} and all its rooms?`)) return;
    const { error } = await supabase.from("hostels").delete().eq("id", h.id);
    if (error) return toast.error(error.message);
    setSelected("");
    await load();
  }

  async function addRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !roomForm.name.trim()) return;
    const { error } = await supabase.from("hostel_rooms").insert([{ hostel_id: selected, name: roomForm.name.trim(), capacity: Math.max(1, Number(roomForm.capacity) || 1) }]);
    if (error) return toast.error(error.code === "23505" ? "A room with that name already exists" : error.message);
    setRoomForm({ name: "", capacity: "4" });
    await load();
  }

  async function allocate(e: React.FormEvent) {
    e.preventDefault();
    if (!allocForm.room_id || !allocForm.student_id) return toast.error("Choose a room and a student");
    const { error } = await supabase.from("hostel_allocations").insert([{ room_id: allocForm.room_id, student_id: allocForm.student_id, bed_label: allocForm.bed_label || null }]);
    if (error) return toast.error(error.code === "23505" ? "That student already has a bed" : error.message);
    toast.success("Bed allocated");
    setAllocForm({ room_id: "", student_id: "", bed_label: "" });
    await load();
  }

  async function vacate(a: Allocation) {
    const { error } = await supabase.from("hostel_allocations").update({ vacated_at: new Date().toISOString().slice(0, 10) }).eq("id", a.id);
    if (error) return toast.error(error.message);
    await load();
  }

  const hostel = hostels.find((h) => h.id === selected);
  const hostelRooms = rooms.filter((r) => r.hostel_id === selected);

  if (profileLoading) return <p className="text-sm text-muted-foreground">Loading...</p>;

  if (!isStaff) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold">{t("page.hostel.title")}</h1>
        {allocations.length === 0 ? (
          <EmptyState icon={<BedDouble size={20} />} title="No hostel allocation" description="No bed is currently allocated." />
        ) : (
          allocations.map((a) => {
            const room = rooms.find((r) => r.id === a.room_id);
            const h = hostels.find((x) => x.id === room?.hostel_id);
            return (
              <div key={a.id} className="rounded-xl border border-border bg-card/80 p-4">
                <p className="font-semibold">{a.students?.full_name}</p>
                <p className="text-sm text-muted-foreground">{h?.name} · Room {room?.name}{a.bed_label ? ` · Bed ${a.bed_label}` : ""} · since {a.allocated_at}</p>
                {h?.warden_name && <p className="text-sm text-muted-foreground">Warden: {h.warden_name}{h.warden_phone ? ` · ${h.warden_phone}` : ""}</p>}
              </div>
            );
          })
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">{t("page.hostel.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("page.hostel.subtitle")}</p>
      </div>

      {isAdmin && (
        <form onSubmit={addHostel} className="grid gap-2 rounded-xl border border-border bg-card/80 p-4 shadow-soft md:grid-cols-5">
          <input value={hostelForm.name} onChange={(e) => setHostelForm({ ...hostelForm, name: e.target.value })} placeholder="Hostel name" className="rounded-md border border-input bg-background px-3 py-2 text-sm" required />
          <select value={hostelForm.gender} onChange={(e) => setHostelForm({ ...hostelForm, gender: e.target.value })} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="">Gender</option><option value="male">Boys</option><option value="female">Girls</option><option value="mixed">Mixed</option>
          </select>
          <input value={hostelForm.warden_name} onChange={(e) => setHostelForm({ ...hostelForm, warden_name: e.target.value })} placeholder="Warden" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <input value={hostelForm.warden_phone} onChange={(e) => setHostelForm({ ...hostelForm, warden_phone: e.target.value })} placeholder="Warden phone" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Add hostel</button>
        </form>
      )}

      {hostels.length === 0 ? (
        <EmptyState icon={<BedDouble size={20} />} title="No hostels yet" description={isAdmin ? "Add a hostel above." : "No hostels have been set up."} />
      ) : (
        <div className="grid gap-4 md:grid-cols-[240px_1fr]">
          <div className="space-y-1 rounded-xl border border-border bg-card/80 p-2">
            {hostels.map((h) => {
              const hr = rooms.filter((r) => r.hostel_id === h.id);
              const cap = hr.reduce((s, r) => s + r.capacity, 0);
              const used = allocations.filter((a) => hr.some((r) => r.id === a.room_id)).length;
              return (
                <button key={h.id} onClick={() => setSelected(h.id)} className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ${selected === h.id ? "bg-primary/15" : "hover:bg-white/5"}`}>
                  <span>{h.name}</span><span className="text-xs text-muted-foreground">{used}/{cap}</span>
                </button>
              );
            })}
          </div>

          {hostel && (
            <div className="space-y-4">
              <div className="flex items-start justify-between rounded-xl border border-border bg-card/80 p-4">
                <div>
                  <h2 className="text-lg font-semibold">{hostel.name}</h2>
                  <p className="text-sm text-muted-foreground">{[hostel.gender && (hostel.gender === "male" ? "Boys" : hostel.gender === "female" ? "Girls" : "Mixed"), hostel.warden_name, hostel.warden_phone].filter(Boolean).join(" · ")}</p>
                </div>
                {isAdmin && <button onClick={() => removeHostel(hostel)} className="text-red-400" aria-label="Delete hostel"><Trash2 size={16} /></button>}
              </div>

              {isAdmin && (
                <div className="grid gap-3 md:grid-cols-2">
                  <form onSubmit={addRoom} className="flex gap-2 rounded-xl border border-border bg-card/80 p-3">
                    <input value={roomForm.name} onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })} placeholder="Room name" className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm" required />
                    <input type="number" min={1} value={roomForm.capacity} onChange={(e) => setRoomForm({ ...roomForm, capacity: e.target.value })} className="w-20 rounded-md border border-input bg-background px-3 py-2 text-sm" title="Beds" />
                    <button type="submit" className="rounded-md bg-secondary px-3 py-2 text-sm font-semibold text-secondary-foreground">Add room</button>
                  </form>
                  <form onSubmit={allocate} className="flex flex-wrap gap-2 rounded-xl border border-border bg-card/80 p-3">
                    <select value={allocForm.room_id} onChange={(e) => setAllocForm({ ...allocForm, room_id: e.target.value })} className="rounded-md border border-input bg-background px-3 py-2 text-sm" required>
                      <option value="">Room</option>
                      {hostelRooms.map((r) => { const used = allocations.filter((a) => a.room_id === r.id).length; return <option key={r.id} value={r.id} disabled={used >= r.capacity}>{r.name} ({used}/{r.capacity})</option>; })}
                    </select>
                    <select value={allocForm.student_id} onChange={(e) => setAllocForm({ ...allocForm, student_id: e.target.value })} className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm" required>
                      <option value="">Student</option>
                      {students.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                    </select>
                    <input value={allocForm.bed_label} onChange={(e) => setAllocForm({ ...allocForm, bed_label: e.target.value })} placeholder="Bed" className="w-20 rounded-md border border-input bg-background px-3 py-2 text-sm" />
                    <button type="submit" className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">Allocate</button>
                  </form>
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-2">
                {hostelRooms.length === 0 && <p className="text-sm text-muted-foreground">No rooms yet.</p>}
                {hostelRooms.map((r) => {
                  const occupants = allocations.filter((a) => a.room_id === r.id);
                  return (
                    <div key={r.id} className="rounded-xl border border-border bg-card/80 p-3">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold">Room {r.name}</p>
                        <span className={`text-xs ${occupants.length >= r.capacity ? "text-red-300" : "text-muted-foreground"}`}>{occupants.length}/{r.capacity} beds</span>
                      </div>
                      <ul className="mt-2 space-y-1 text-sm">
                        {occupants.length === 0 && <li className="text-xs text-muted-foreground">Empty</li>}
                        {occupants.map((a) => (
                          <li key={a.id} className="flex items-center justify-between rounded-md bg-white/5 px-2 py-1">
                            <span>{a.students?.full_name}<span className="ml-2 text-xs text-muted-foreground">{a.students?.classes?.name}{a.bed_label ? ` · bed ${a.bed_label}` : ""}</span></span>
                            {isAdmin && <button onClick={() => vacate(a)} className="text-xs text-red-400">Vacate</button>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
