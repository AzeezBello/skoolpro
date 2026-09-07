import { NextResponse, type NextRequest } from "next/server";
import { requirePlatformAdmin } from "@/lib/server/platformAuth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { recordPlatformAudit } from "@/lib/server/platformAudit";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requirePlatformAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const status = body?.status;

  if (status !== "active" && status !== "suspended") {
    return NextResponse.json({ error: "status must be 'active' or 'suspended'" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("schools").update({ status }).eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await recordPlatformAudit({ adminId: auth.ctx.userId, action: "school.status_changed", schoolId: id, details: { status } });

  return NextResponse.json({ ok: true });
}
