import { NextResponse, type NextRequest } from "next/server";
import { getRequestUserContext } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

// Who am I, for client-side routing: role, school, and whether onboarding is
// still needed. Works for accounts with no school yet.
export async function GET(req: NextRequest) {
  const ctx = await getRequestUserContext(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let school: { id: string; name: string; status: string } | null = null;
  if (ctx.tenant) {
    const { data } = await supabaseAdmin.from("schools").select("id, name, status").eq("id", ctx.tenant.value).maybeSingle();
    school = data ?? null;
  }

  const { data: platformAdmin } = await supabaseAdmin.from("platform_admins").select("id").eq("id", ctx.userId).maybeSingle();

  return NextResponse.json({
    userId: ctx.userId,
    email: ctx.email,
    fullName: ctx.profile?.full_name ?? null,
    role: ctx.role,
    relatedId: ctx.profile?.related_id ?? null,
    hasProfile: Boolean(ctx.profile),
    school,
    isPlatformAdmin: Boolean(platformAdmin),
    needsOnboarding: !ctx.tenant,
  });
}
