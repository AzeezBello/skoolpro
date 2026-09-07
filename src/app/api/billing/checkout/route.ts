import { randomUUID } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requireRequestUser } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { enforceRateLimit } from "@/lib/server/rateLimit";

// School admin buys/renews a plan via Paystack. The transaction's metadata
// marks it as a plan purchase so the shared webhook/verify handlers route it
// to apply_plan_payment instead of an invoice.
export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, "billing-checkout", 10, 60_000);
  if (limited) return limited;

  const auth = await requireRequestUser(req, { roles: ["admin"] });
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const planId = typeof body?.plan_id === "string" ? body.plan_id : "";
  const months = Math.min(Math.max(Math.floor(Number(body?.months) || 0), 1), 24);
  const gateway = body?.gateway === "flutterwave" ? "flutterwave" : "paystack";

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const secret = gateway === "paystack" ? process.env.PAYSTACK_SECRET_KEY : process.env.FLW_SECRET_KEY;
  if (!secret || !baseUrl) return NextResponse.json({ error: `Online billing via ${gateway} is not configured` }, { status: 500 });

  const { data: plan } = await supabaseAdmin.from("plans").select("id, name, price_monthly").eq("id", planId).maybeSingle();
  if (!plan || Number(plan.price_monthly) <= 0) return NextResponse.json({ error: "Choose a paid plan" }, { status: 400 });

  const amount = Number(plan.price_monthly) * months;
  const schoolId = auth.ctx.tenant!.value;
  const reference = `PLAN-${randomUUID().slice(0, 12).toUpperCase()}`;

  const { error: insertError } = await supabaseAdmin.from("plan_payments").insert([
    { school_id: schoolId, plan_id: plan.id, months, amount, reference, gateway, initiated_by: auth.ctx.userId },
  ]);
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  if (gateway === "flutterwave") {
    const res = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        tx_ref: reference,
        amount,
        currency: "NGN",
        redirect_url: `${baseUrl}/payments/verify/flutterwave`,
        customer: { email: auth.ctx.email },
        meta: { type: "plan", school_id: schoolId, plan_id: plan.id, months },
        customizations: { title: "SkoolPro subscription", description: `${plan.name} plan · ${months} month(s)` },
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.data?.link) {
      await supabaseAdmin.from("plan_payments").update({ status: "failed", gateway_response: json }).eq("reference", reference);
      return NextResponse.json({ error: json?.message || "Gateway error" }, { status: 502 });
    }
    return NextResponse.json({ authorization_url: json.data.link, reference, amount });
  }

  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: auth.ctx.email,
      amount: Math.round(amount * 100),
      currency: "NGN",
      reference,
      metadata: { type: "plan", school_id: schoolId, plan_id: plan.id, months },
      callback_url: `${baseUrl}/payments/verify/paystack`,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.data?.authorization_url) {
    await supabaseAdmin.from("plan_payments").update({ status: "failed", gateway_response: json }).eq("reference", reference);
    return NextResponse.json({ error: json?.message || "Gateway error" }, { status: 502 });
  }

  return NextResponse.json({ authorization_url: json.data.authorization_url, reference, amount });
}
