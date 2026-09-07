import { NextResponse, type NextRequest } from "next/server";
import { requireRequestUser } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { recordAudit } from "@/lib/server/audit";

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireRequestUser(req, { roles: ["admin"] });
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const { data, error } = await supabaseAdmin
    .from("api_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("school_id", auth.ctx.tenant!.value)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Token not found" }, { status: 404 });

  await recordAudit({ schoolId: auth.ctx.tenant!.value, actorId: auth.ctx.userId, actorEmail: auth.ctx.email, action: "api_token.revoked", entityType: "api_token", entityId: id });
  return NextResponse.json({ ok: true });
}
