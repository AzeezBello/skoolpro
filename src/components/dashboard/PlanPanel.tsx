"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Gem } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { authFetch } from "@/lib/client/authFetch";
import { formatMoney } from "@/lib/money";

type Plan = { id: string; name: string; max_students: number | null; max_teachers: number | null; price_monthly: number; features: Record<string, boolean> };

// Plan, usage and self-service upgrade/renewal via Paystack.
export function PlanPanel() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [current, setCurrent] = useState<{ plan_id: string; plan_expires_at: string | null } | null>(null);
  const [usage, setUsage] = useState({ students: 0, teachers: 0 });
  const [choice, setChoice] = useState("");
  const [months, setMonths] = useState("12");
  const [gateway, setGateway] = useState<"paystack" | "flutterwave">("paystack");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<Array<{ id: string; plan_id: string; months: number; amount: number; status: string; created_at: string }>>([]);

  useEffect(() => {
    (async () => {
      const [{ data: planRows }, { data: school }, { count: students }, { count: teachers }, { data: payments }] = await Promise.all([
        supabase.from("plans").select("*").order("price_monthly"),
        supabase.from("schools").select("plan_id, plan_expires_at").maybeSingle(),
        supabase.from("students").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("teachers").select("*", { count: "exact", head: true }),
        supabase.from("plan_payments").select("id, plan_id, months, amount, status, created_at").order("created_at", { ascending: false }).limit(10),
      ]);
      setPlans((planRows as Plan[]) || []);
      setCurrent(school ?? null);
      setChoice(school?.plan_id && school.plan_id !== "free" ? school.plan_id : (planRows as Plan[])?.find((p) => p.price_monthly > 0)?.id || "");
      setUsage({ students: students || 0, teachers: teachers || 0 });
      setHistory((payments as any) || []);
    })();
  }, []);

  const plan = plans.find((p) => p.id === current?.plan_id);
  const chosen = plans.find((p) => p.id === choice);
  const pct = (used: number, max: number | null) => (max ? Math.min(100, Math.round((used / max) * 100)) : 0);

  const checkout = async () => {
    if (!chosen) return;
    setBusy(true);
    try {
      const res = await authFetch("/api/billing/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan_id: chosen.id, months: Number(months), gateway }) });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Could not start checkout");
        return;
      }
      window.location.href = json.authorization_url;
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-border bg-card/80 p-6 shadow-soft">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold"><Gem size={18} /> Subscription</h2>
      {!plan ? (
        <p className="text-sm text-muted-foreground">Loading plan…</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            You&apos;re on the <strong className="text-foreground">{plan.name}</strong> plan
            {current?.plan_expires_at ? ` until ${new Date(current.plan_expires_at).toLocaleDateString()}` : ""}.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Usage label="Active students" used={usage.students} max={plan.max_students} pct={pct(usage.students, plan.max_students)} />
            <Usage label="Teachers" used={usage.teachers} max={plan.max_teachers} pct={pct(usage.teachers, plan.max_teachers)} />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {plans.map((p) => (
              <button key={p.id} type="button" disabled={p.price_monthly <= 0} onClick={() => setChoice(p.id)} className={`rounded-lg border p-3 text-left text-sm transition ${choice === p.id ? "border-primary bg-primary/10" : "border-border"} ${p.id === plan.id ? "ring-1 ring-primary/40" : ""} disabled:opacity-60`}>
                <p className="font-semibold">{p.name}{p.id === plan.id && <span className="ml-2 text-[10px] text-primary">CURRENT</span>}</p>
                <p className="text-xs text-muted-foreground">{p.price_monthly ? `${formatMoney(p.price_monthly, "NGN")}/month` : "Free"}</p>
                <p className="mt-1 text-xs text-muted-foreground">{p.max_students ? `${p.max_students} students` : "Unlimited students"} · {p.max_teachers ? `${p.max_teachers} teachers` : "Unlimited teachers"}</p>
              </button>
            ))}
          </div>
          {chosen && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <select value={months} onChange={(e) => setMonths(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="1">1 month</option>
                <option value="3">3 months</option>
                <option value="6">6 months</option>
                <option value="12">12 months</option>
              </select>
              <select value={gateway} onChange={(e) => setGateway(e.target.value as "paystack" | "flutterwave")} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="paystack">Pay with Paystack</option>
                <option value="flutterwave">Pay with Flutterwave</option>
              </select>
              <span className="text-sm text-muted-foreground">Total {formatMoney(Number(chosen.price_monthly) * Number(months), "NGN")}</span>
              <button onClick={checkout} disabled={busy} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {busy ? "Redirecting..." : chosen.id === plan.id ? "Renew" : `Upgrade to ${chosen.name}`}
              </button>
            </div>
          )}
          {history.length > 0 && (
            <table className="mt-4 w-full text-left text-xs">
              <thead className="text-muted-foreground"><tr><th className="p-2">Date</th><th className="p-2">Plan</th><th className="p-2">Months</th><th className="p-2">Amount</th><th className="p-2">Status</th></tr></thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-t border-border/60">
                    <td className="p-2">{new Date(h.created_at).toLocaleDateString()}</td>
                    <td className="p-2 capitalize">{h.plan_id}</td>
                    <td className="p-2">{h.months}</td>
                    <td className="p-2">{formatMoney(h.amount, "NGN")}</td>
                    <td className="p-2 capitalize">{h.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </section>
  );
}

function Usage({ label, used, max, pct }: { label: string; used: number; max: number | null; pct: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-muted-foreground"><span>{label}</span><span>{used}{max ? ` / ${max}` : ""}</span></div>
      <div className="mt-1 h-2 rounded-full bg-secondary">
        <div className={`h-2 rounded-full ${pct >= 90 ? "bg-red-500" : "bg-primary"}`} style={{ width: `${max ? pct : 5}%` }} />
      </div>
    </div>
  );
}
