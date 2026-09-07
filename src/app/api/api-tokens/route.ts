import { NextResponse, type NextRequest } from "next/server";
import { requireRequestUser } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { generateApiToken, hashApiToken } from "@/lib/server/publicApi";
import { recordAudit } from "@/lib/server/audit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireRequestUser(req, { roles: ["admin"] });
  if (!auth.ok) return auth.response;

  const { data, error } = await supabaseAdmin
    .from("api_tokens")
    .select("id, label, created_at, expires_at, revoked_at, last_used_at")
    .eq("school_id", auth.ctx.tenant!.value)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// The plaintext token is returned exactly once; only its hash is stored.
export async function POST(req: NextRequest) {
  const auth = await requireRequestUser(req, { roles: ["admin"] });
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const label = typeof body?.label === "string" ? body.label.trim().slice(0, 80) : "";
  const expiresDays = Number(body?.expires_days);
  const expiresAt = Number.isFinite(expiresDays) && expiresDays > 0 ? new Date(Date.now() + expiresDays * 86_400_000).toISOString() : null;

  const token = generateApiToken();
  const { data, error } = await supabaseAdmin
    .from("api_tokens")
    .insert([{ school_id: auth.ctx.tenant!.value, label: label || null, token_hash: hashApiToken(token), expires_at: expiresAt, created_by: auth.ctx.userId }])
    .select("id, label, created_at, expires_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await recordAudit({ schoolId: auth.ctx.tenant!.value, actorId: auth.ctx.userId, actorEmail: auth.ctx.email, action: "api_token.created", entityType: "api_token", entityId: data.id, details: { label } });

  return NextResponse.json({ token, record: data }, { status: 201 });
}
