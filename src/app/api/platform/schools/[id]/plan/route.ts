import { NextResponse, type NextRequest } from "next/server";
import { requirePlatformAdmin } from "@/lib/server/platformAuth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { recordPlatformAudit } from "@/lib/server/platformAudit";

// Platform operators set a school's plan after confirming payment (manual
// billing v1). Limits are enforced by database triggers.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requirePlatformAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const planId = typeof body?.plan_id === "string" ? body.plan_id : "";
  const months = Number(body?.months);

  const { data: plan } = await supabaseAdmin.from("plans").select("id").eq("id", planId).maybeSingle();
  if (!plan) return NextResponse.json({ error: "Unknown plan" }, { status: 400 });

  const expires = planId === "free" || !Number.isFinite(months) || months <= 0 ? null : new Date(Date.now() + months * 30 * 86_400_000).toISOString();

  const { error } = await supabaseAdmin.from("schools").update({ plan_id: planId, plan_expires_at: expires }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await recordPlatformAudit({ adminId: auth.ctx.userId, action: "school.plan_changed", schoolId: id, details: { plan_id: planId, expires } });
  return NextResponse.json({ ok: true, plan_id: planId, plan_expires_at: expires });
}
