import { NextResponse, type NextRequest } from "next/server";
import { requirePlatformAdmin } from "@/lib/server/platformAuth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { getClientIp } from "@/lib/server/rateLimit";

// Generates a real Supabase login session for the target user via a
// server-issued magic link. This is the one deliberate "master key" in the
// app, so: the audit row is written *before* the link is generated (and the
// request fails if it can't be), platform admins cannot be impersonated,
// a reason is required, and IP/user-agent are recorded.
export async function POST(req: NextRequest) {
  const auth = await requirePlatformAdmin(req);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const userId = typeof body?.userId === "string" ? body.userId : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 300) : "";

  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });
  if (reason.length < 5) return NextResponse.json({ error: "A reason (at least 5 characters) is required" }, { status: 400 });

  const { data: targetIsPlatformAdmin } = await supabaseAdmin.from("platform_admins").select("id").eq("id", userId).maybeSingle();
  if (targetIsPlatformAdmin) {
    return NextResponse.json({ error: "Platform admins cannot be impersonated" }, { status: 403 });
  }

  const { data: targetUser, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (userError || !targetUser?.user?.email) {
    return NextResponse.json({ error: "Target user not found" }, { status: 404 });
  }

  const { data: profile } = await supabaseAdmin.from("profiles").select("school_id").eq("id", userId).maybeSingle();

  const { data: auditRow, error: auditError } = await supabaseAdmin
    .from("impersonation_audit_log")
    .insert([
      {
        platform_admin_id: auth.ctx.userId,
        target_user_id: userId,
        target_school_id: profile?.school_id || null,
        reason,
        ip_address: getClientIp(req),
        user_agent: req.headers.get("user-agent")?.slice(0, 300) || null,
      },
    ])
    .select("id")
    .single();

  if (auditError || !auditRow) {
    return NextResponse.json({ error: "Could not record audit entry; impersonation refused" }, { status: 500 });
  }

  const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");

  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email: targetUser.user.email,
    options: baseUrl ? { redirectTo: `${baseUrl}/auth/callback?next=/dashboard` } : undefined,
  });

  if (linkError || !linkData) {
    await supabaseAdmin.from("impersonation_audit_log").update({ failed: true }).eq("id", auditRow.id);
    return NextResponse.json({ error: linkError?.message || "Could not generate impersonation link" }, { status: 500 });
  }

  return NextResponse.json({ actionLink: linkData.properties?.action_link || null });
}
