import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { getAccessTokenFromRequest } from "@/lib/server/auth";

export type PlatformAdminContext = {
  userId: string;
  email: string | null;
};

type PlatformAuthResult =
  | { ok: true; ctx: PlatformAdminContext }
  | { ok: false; response: NextResponse<{ error: string }> };

// Deliberately not requireRequestUser: that checks profiles.role and
// current_app_role(), the tenant-scoped role system every school-facing
// route uses. Platform admins aren't part of that system at all — this
// checks a completely separate allowlist table instead.
export async function requirePlatformAdmin(req: Request): Promise<PlatformAuthResult> {
  const accessToken = await getAccessTokenFromRequest(req);
  if (!accessToken) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
  if (authError || !authData.user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: admin } = await supabaseAdmin
    .from("platform_admins")
    .select("id")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (!admin) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { ok: true, ctx: { userId: authData.user.id, email: authData.user.email ?? null } };
}

// Bounded linear scan over auth.users, since the Admin API's listUsers()
// doesn't reliably support server-side email filtering across supabase-js
// versions. Fine for an internal ops tool at this scale; would need a real
// index-backed lookup (or a users-by-email view) if the user base grows
// large enough for this to matter.
export async function findAuthUserByEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  const perPage = 200;

  for (let page = 1; page <= 10; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const match = data.users.find((u: any) => u.email?.toLowerCase() === normalized);
    if (match) return match;

    if (data.users.length < perPage) break;
  }

  return null;
}
