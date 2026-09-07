"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { CalendarDays, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentProfile } from "@/lib/hooks/useCurrentProfile";
import { EmptyState } from "@/components/ui/empty-state";
import { useT } from "@/components/i18n/LocaleProvider";

type Slot = { id: string; class_id: string; subject_id: string | null; teacher_id: string | null; day_of_week: number; start_time: string; end_time: string; room: string | null; subjects?: { name?: string } | null; teachers?: { full_name?: string } | null };
type Option = { id: string; name: string };

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function TimetablePage() {
  const { t } = useT();
  const { profile, loading: profileLoading } = useCurrentProfile();
  const [classes, setClasses] = useState<Option[]>([]);
  const [subjects, setSubjects] = useState<Option[]>([]);
  const [teachers, setTeachers] = useState<Array<{ id: string; full_name: string }>>([]);
  const [classId, setClassId] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [form, setForm] = useState({ day_of_week: 1, start_time: "08:00", end_time: "08:40", subject_id: "", teacher_id: "", room: "" });
  const [saving, setSaving] = useState(false);

  const isAdmin = profile?.role === "admin";
  const isStaff = isAdmin || profile?.role === "teacher";

  useEffect(() => {
    if (profileLoading || !profile) return;
    (async () => {
      if (isStaff) {
        const [{ data: c }, { data: s }, { data: t }] = await Promise.all([
          supabase.from("classes").select("id, name").order("name"),
          supabase.from("subjects").select("id, name").order("name"),
          supabase.from("teachers").select("id, full_name").order("full_name"),
        ]);
        setClasses(c || []);
        setSubjects(s || []);
        setTeachers(t || []);
        setClassId((prev) => prev || c?.[0]?.id || "");
      } else {
        // Student/parent: resolve their (child's) class.
        const own = profile.relatedId || profile.userId;
        const { data: student } = await supabase.from("students").select("class_id, classes(id, name)").eq("id", own).maybeSingle();
        let cls: any = student?.classes;
        if (!cls) {
          const { data: link } = await supabase.from("parent_students").select("students(class_id, classes(id, name))").limit(1).maybeSingle();
          cls = (link as any)?.students?.classes;
        }
        if (cls) {
          setClasses([cls]);
          setClassId(cls.id);
        }
      }
    })();
  }, [profile, profileLoading, isStaff]);

  useEffect(() => {
    if (!classId) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  async function load() {
    const { data, error } = await supabase
      .from("timetable_slots")
      .select("id, class_id, subject_id, teacher_id, day_of_week, start_time, end_time, room, subjects(name), teachers(full_name)")
      .eq("class_id", classId)
      .order("day_of_week")
      .order("start_time");
    if (error) toast.error(error.message);
    setSlots((data as any) || []);
  }

  async function addSlot(e: React.FormEvent) {
    e.preventDefault();
    if (!classId) return;
    if (form.end_time <= form.start_time) return toast.error("End time must be after start time");
    const clash = slots.find((s) => s.day_of_week === form.day_of_week && form.start_time < s.end_time && form.end_time > s.start_time);
    if (clash) return toast.error(`Overlaps with ${clash.subjects?.name || "another period"} (${clash.start_time.slice(0, 5)}–${clash.end_time.slice(0, 5)})`);
    setSaving(true);
    const { error } = await supabase.from("timetable_slots").insert([{ class_id: classId, subject_id: form.subject_id || null, teacher_id: form.teacher_id || null, day_of_week: form.day_of_week, start_time: form.start_time, end_time: form.end_time, room: form.room || null }]);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Period added");
    setForm((f) => ({ ...f, start_time: f.end_time, end_time: addMinutes(f.end_time, 40) }));
    await load();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("timetable_slots").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setSlots((prev) => prev.filter((s) => s.id !== id));
  }

  const byDay = useMemo(() => {
    const map = new Map<number, Slot[]>();
    for (const s of slots) (map.get(s.day_of_week) ?? map.set(s.day_of_week, []).get(s.day_of_week)!).push(s);
    return map;
  }, [slots]);
  const activeDays = DAYS.map((d, i) => ({ label: d, n: i + 1 })).filter((d) => d.n <= 5 || byDay.has(d.n));

  if (profileLoading) return <p className="text-sm text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">{t("page.timetable.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("page.timetable.subtitle")}</p>
        </div>
        {classes.length > 1 && (
          <select value={classId} onChange={(e) => setClassId(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      {isAdmin && classId && (
        <form onSubmit={addSlot} className="grid gap-2 rounded-xl border border-border bg-card/80 p-4 shadow-soft md:grid-cols-7">
          <select value={form.day_of_week} onChange={(e) => setForm({ ...form, day_of_week: Number(e.target.value) })} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
            {DAYS.map((d, i) => (
              <option key={d} value={i + 1}>{d}</option>
            ))}
          </select>
          <input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} className="rounded-md border border-input bg-background px-3 py-2 text-sm" required />
          <input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} className="rounded-md border border-input bg-background px-3 py-2 text-sm" required />
          <select value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="">Subject</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select value={form.teacher_id} onChange={(e) => setForm({ ...form, teacher_id: e.target.value })} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="">Teacher</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>{t.full_name}</option>
            ))}
          </select>
          <input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} placeholder="Room" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <button type="submit" disabled={saving} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">Add</button>
        </form>
      )}

      {!classId ? (
        <EmptyState icon={<CalendarDays size={20} />} title="No class selected" description={isStaff ? "Create a class first." : "You're not assigned to a class yet."} />
      ) : slots.length === 0 ? (
        <EmptyState icon={<CalendarDays size={20} />} title="No periods yet" description={isAdmin ? "Add periods with the form above." : "The timetable for this class hasn't been published yet."} />
      ) : (
        <div className="grid gap-3 md:grid-cols-5">
          {activeDays.map((d) => (
            <div key={d.n} className="rounded-xl border border-border bg-card/80 p-3">
              <p className="mb-2 text-sm font-semibold">{d.label}</p>
              <div className="space-y-2">
                {(byDay.get(d.n) || []).map((s) => (
                  <div key={s.id} className="rounded-md bg-white/5 p-2 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{s.subjects?.name || "—"}</p>
                        <p className="text-muted-foreground">{s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}</p>
                        {s.teachers?.full_name && <p className="text-muted-foreground">{s.teachers.full_name}</p>}
                        {s.room && <p className="text-muted-foreground">Room {s.room}</p>}
                      </div>
                      {isAdmin && (
                        <button onClick={() => remove(s.id)} className="text-red-400" aria-label="Remove period"><Trash2 size={12} /></button>
                      )}
                    </div>
                  </div>
                ))}
                {!(byDay.get(d.n) || []).length && <p className="text-xs text-muted-foreground">—</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function addMinutes(time: string, minutes: number) {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
