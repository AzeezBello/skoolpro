import { NextResponse, type NextRequest } from "next/server";
import { requirePlatformAdmin, findAuthUserByEmail } from "@/lib/server/platformAuth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { recordPlatformAudit } from "@/lib/server/platformAudit";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requirePlatformAdmin(req);
  if (!auth.ok) return auth.response;

  const { id: schoolId } = await ctx.params;
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const { data: school } = await supabaseAdmin.from("schools").select("id").eq("id", schoolId).maybeSingle();
  if (!school) {
    return NextResponse.json({ error: "School not found" }, { status: 404 });
  }

  let user;
  try {
    user = await findAuthUserByEmail(email);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Lookup failed" }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json(
      { error: "No account found for that email. Ask them to sign up first, then try again." },
      { status: 404 }
    );
  }

  const { data: updated, error } = await supabaseAdmin
    .from("profiles")
    .update({ role: "admin", school_id: schoolId })
    .eq("id", user.id)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!updated || updated.length === 0) {
    return NextResponse.json(
      { error: "That account has no profile yet — ask them to complete signup, then try again." },
      { status: 404 }
    );
  }

  await recordPlatformAudit({ adminId: auth.ctx.userId, action: "school.admin_assigned", schoolId, details: { email, userId: user.id } });

  return NextResponse.json({ ok: true });
}
