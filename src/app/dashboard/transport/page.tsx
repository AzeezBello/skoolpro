"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Bus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentProfile } from "@/lib/hooks/useCurrentProfile";
import { useSchoolSettings } from "@/lib/hooks/useSchoolSettings";
import { formatMoney } from "@/lib/money";
import { EmptyState } from "@/components/ui/empty-state";
import { useT } from "@/components/i18n/LocaleProvider";

type Route = { id: string; name: string; vehicle_plate: string | null; driver_name: string | null; driver_phone: string | null; capacity: number | null; fee_amount: number | null };
type Stop = { id: string; route_id: string; name: string; pickup_time: string | null; dropoff_time: string | null; position: number };
type Assignment = { id: string; student_id: string; route_id: string; stop_id: string | null; students?: { full_name?: string; classes?: { name?: string } | null } | null };

export default function TransportPage() {
  const { t } = useT();
  const { profile, loading: profileLoading } = useCurrentProfile();
  const { settings } = useSchoolSettings();
  const isAdmin = profile?.role === "admin";
  const isStaff = isAdmin || profile?.role === "teacher";
  const [routes, setRoutes] = useState<Route[]>([]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [students, setStudents] = useState<Array<{ id: string; full_name: string }>>([]);
  const [selected, setSelected] = useState("");
  const [routeForm, setRouteForm] = useState({ name: "", vehicle_plate: "", driver_name: "", driver_phone: "", capacity: "", fee_amount: "" });
  const [stopForm, setStopForm] = useState({ name: "", pickup_time: "", dropoff_time: "" });
  const [assignForm, setAssignForm] = useState({ student_id: "", stop_id: "" });

  useEffect(() => {
    if (profileLoading) return;
    void load();
    if (isAdmin) supabase.from("students").select("id, full_name").eq("status", "active").order("full_name").then(({ data }) => setStudents(data || []));
  }, [profileLoading, isAdmin]);

  async function load() {
    const [{ data: r }, { data: s }, { data: a }] = await Promise.all([
      supabase.from("transport_routes").select("*").order("name"),
      supabase.from("transport_stops").select("*").order("position"),
      supabase.from("transport_assignments").select("*, students(full_name, classes(name))"),
    ]);
    setRoutes((r as Route[]) || []);
    setStops((s as Stop[]) || []);
    setAssignments((a as Assignment[]) || []);
    setSelected((prev) => prev || r?.[0]?.id || "");
  }

  async function addRoute(e: React.FormEvent) {
    e.preventDefault();
    if (!routeForm.name.trim()) return toast.error("Route name is required");
    const { error } = await supabase.from("transport_routes").insert([{ name: routeForm.name.trim(), vehicle_plate: routeForm.vehicle_plate || null, driver_name: routeForm.driver_name || null, driver_phone: routeForm.driver_phone || null, capacity: routeForm.capacity ? Number(routeForm.capacity) : null, fee_amount: routeForm.fee_amount ? Number(routeForm.fee_amount) : null }]);
    if (error) return toast.error(error.message);
    toast.success("Route added");
    setRouteForm({ name: "", vehicle_plate: "", driver_name: "", driver_phone: "", capacity: "", fee_amount: "" });
    await load();
  }

  async function removeRoute(r: Route) {
    if (!confirm(`Delete route ${r.name} and its stops/assignments?`)) return;
    const { error } = await supabase.from("transport_routes").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    setSelected("");
    await load();
  }

  async function addStop(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !stopForm.name.trim()) return;
    const position = stops.filter((s) => s.route_id === selected).length;
    const { error } = await supabase.from("transport_stops").insert([{ route_id: selected, name: stopForm.name.trim(), pickup_time: stopForm.pickup_time || null, dropoff_time: stopForm.dropoff_time || null, position }]);
    if (error) return toast.error(error.message);
    setStopForm({ name: "", pickup_time: "", dropoff_time: "" });
    await load();
  }

  async function removeStop(id: string) {
    const { error } = await supabase.from("transport_stops").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await load();
  }

  async function assign(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !assignForm.student_id) return toast.error("Choose a student");
    const route = routes.find((r) => r.id === selected);
    const onRoute = assignments.filter((a) => a.route_id === selected).length;
    if (route?.capacity && onRoute >= route.capacity) return toast.error("This route is at capacity");
    const { error } = await supabase.from("transport_assignments").upsert([{ student_id: assignForm.student_id, route_id: selected, stop_id: assignForm.stop_id || null }], { onConflict: "student_id" });
    if (error) return toast.error(error.message);
    toast.success("Student assigned");
    setAssignForm({ student_id: "", stop_id: "" });
    await load();
  }

  async function unassign(id: string) {
    const { error } = await supabase.from("transport_assignments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await load();
  }

  const route = routes.find((r) => r.id === selected);
  const routeStops = stops.filter((s) => s.route_id === selected);
  const riders = assignments.filter((a) => a.route_id === selected);

  if (profileLoading) return <p className="text-sm text-muted-foreground">Loading...</p>;

  if (!isStaff) {
    // Student/parent: show their assignment(s).
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold">{t("page.transport.title")}</h1>
        {assignments.length === 0 ? (
          <EmptyState icon={<Bus size={20} />} title="No bus assignment" description="You are not currently assigned to a school bus route." />
        ) : (
          assignments.map((a) => {
            const r = routes.find((x) => x.id === a.route_id);
            const st = stops.find((x) => x.id === a.stop_id);
            return (
              <div key={a.id} className="rounded-xl border border-border bg-card/80 p-4">
                <p className="font-semibold">{a.students?.full_name} · {r?.name}</p>
                <p className="text-sm text-muted-foreground">Stop: {st?.name || "—"}{st?.pickup_time ? ` · pickup ${st.pickup_time.slice(0, 5)}` : ""}{st?.dropoff_time ? ` · drop-off ${st.dropoff_time.slice(0, 5)}` : ""}</p>
                {r?.driver_name && <p className="text-sm text-muted-foreground">Driver: {r.driver_name}{r.driver_phone ? ` · ${r.driver_phone}` : ""}{r.vehicle_plate ? ` · ${r.vehicle_plate}` : ""}</p>}
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
        <h1 className="text-3xl font-semibold">{t("page.transport.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("page.transport.subtitle")}</p>
      </div>

      {isAdmin && (
        <form onSubmit={addRoute} className="grid gap-2 rounded-xl border border-border bg-card/80 p-4 shadow-soft md:grid-cols-7">
          <input value={routeForm.name} onChange={(e) => setRouteForm({ ...routeForm, name: e.target.value })} placeholder="Route name" className="rounded-md border border-input bg-background px-3 py-2 text-sm" required />
          <input value={routeForm.vehicle_plate} onChange={(e) => setRouteForm({ ...routeForm, vehicle_plate: e.target.value })} placeholder="Vehicle plate" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <input value={routeForm.driver_name} onChange={(e) => setRouteForm({ ...routeForm, driver_name: e.target.value })} placeholder="Driver" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <input value={routeForm.driver_phone} onChange={(e) => setRouteForm({ ...routeForm, driver_phone: e.target.value })} placeholder="Driver phone" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <input type="number" min={1} value={routeForm.capacity} onChange={(e) => setRouteForm({ ...routeForm, capacity: e.target.value })} placeholder="Seats" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <input type="number" min={0} value={routeForm.fee_amount} onChange={(e) => setRouteForm({ ...routeForm, fee_amount: e.target.value })} placeholder="Fee / term" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Add route</button>
        </form>
      )}

      {routes.length === 0 ? (
        <EmptyState icon={<Bus size={20} />} title="No routes yet" description={isAdmin ? "Add a route above." : "No transport routes have been set up."} />
      ) : (
        <div className="grid gap-4 md:grid-cols-[240px_1fr]">
          <div className="space-y-1 rounded-xl border border-border bg-card/80 p-2">
            {routes.map((r) => {
              const count = assignments.filter((a) => a.route_id === r.id).length;
              return (
                <button key={r.id} onClick={() => setSelected(r.id)} className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ${selected === r.id ? "bg-primary/15" : "hover:bg-white/5"}`}>
                  <span>{r.name}</span>
                  <span className="text-xs text-muted-foreground">{count}{r.capacity ? `/${r.capacity}` : ""}</span>
                </button>
              );
            })}
          </div>

          {route && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-card/80 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">{route.name}</h2>
                    <p className="text-sm text-muted-foreground">{[route.vehicle_plate, route.driver_name, route.driver_phone].filter(Boolean).join(" · ") || "No vehicle details"}{route.fee_amount ? ` · ${formatMoney(route.fee_amount, settings.currency)} per term` : ""}</p>
                  </div>
                  {isAdmin && <button onClick={() => removeRoute(route)} className="text-red-400" aria-label="Delete route"><Trash2 size={16} /></button>}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card/80 p-4">
                <h3 className="mb-2 text-sm font-semibold">Stops</h3>
                {routeStops.length === 0 ? <p className="text-xs text-muted-foreground">No stops yet.</p> : (
                  <ol className="space-y-1 text-sm">
                    {routeStops.map((s, i) => (
                      <li key={s.id} className="flex items-center justify-between rounded-md bg-white/5 px-3 py-1.5">
                        <span>{i + 1}. {s.name}<span className="ml-2 text-xs text-muted-foreground">{s.pickup_time ? `↑ ${s.pickup_time.slice(0, 5)}` : ""} {s.dropoff_time ? `↓ ${s.dropoff_time.slice(0, 5)}` : ""}</span></span>
                        {isAdmin && <button onClick={() => removeStop(s.id)} className="text-xs text-red-400">Remove</button>}
                      </li>
                    ))}
                  </ol>
                )}
                {isAdmin && (
                  <form onSubmit={addStop} className="mt-3 grid gap-2 md:grid-cols-4">
                    <input value={stopForm.name} onChange={(e) => setStopForm({ ...stopForm, name: e.target.value })} placeholder="Stop name" className="rounded-md border border-input bg-background px-3 py-2 text-sm" required />
                    <input type="time" value={stopForm.pickup_time} onChange={(e) => setStopForm({ ...stopForm, pickup_time: e.target.value })} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
                    <input type="time" value={stopForm.dropoff_time} onChange={(e) => setStopForm({ ...stopForm, dropoff_time: e.target.value })} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
                    <button type="submit" className="rounded-md bg-secondary px-3 py-2 text-sm font-semibold text-secondary-foreground">Add stop</button>
                  </form>
                )}
              </div>

              <div className="rounded-xl border border-border bg-card/80 p-4">
                <h3 className="mb-2 text-sm font-semibold">Riders ({riders.length}{route.capacity ? ` / ${route.capacity}` : ""})</h3>
                {isAdmin && (
                  <form onSubmit={assign} className="mb-3 grid gap-2 md:grid-cols-3">
                    <select value={assignForm.student_id} onChange={(e) => setAssignForm({ ...assignForm, student_id: e.target.value })} className="rounded-md border border-input bg-background px-3 py-2 text-sm" required>
                      <option value="">Student</option>
                      {students.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                    </select>
                    <select value={assignForm.stop_id} onChange={(e) => setAssignForm({ ...assignForm, stop_id: e.target.value })} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
                      <option value="">Stop (optional)</option>
                      {routeStops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <button type="submit" className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">Assign</button>
                  </form>
                )}
                {riders.length === 0 ? <p className="text-xs text-muted-foreground">No students on this route.</p> : (
                  <table className="w-full text-left text-sm">
                    <thead className="text-muted-foreground"><tr><th className="p-2">Student</th><th className="p-2">Class</th><th className="p-2">Stop</th>{isAdmin && <th className="p-2"></th>}</tr></thead>
                    <tbody>
                      {riders.map((a) => (
                        <tr key={a.id} className="border-t border-border/60">
                          <td className="p-2">{a.students?.full_name}</td>
                          <td className="p-2 text-muted-foreground">{a.students?.classes?.name || "—"}</td>
                          <td className="p-2 text-muted-foreground">{stops.find((s) => s.id === a.stop_id)?.name || "—"}</td>
                          {isAdmin && <td className="p-2 text-right"><button onClick={() => unassign(a.id)} className="text-xs text-red-400">Remove</button></td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
