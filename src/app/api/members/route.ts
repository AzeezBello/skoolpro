import { NextResponse, type NextRequest } from "next/server";
import { requireRequestUser } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

// Everyone with a login in this school (plus unassigned self-signups an admin
// may claim), with their auth email for display.
export async function GET(req: NextRequest) {
  const auth = await requireRequestUser(req, { roles: ["admin"] });
  if (!auth.ok) return auth.response;

  const schoolId = auth.ctx.tenant!.value;
  const includeUnassigned = req.nextUrl.searchParams.get("unassigned") === "1";

  let query = supabaseAdmin.from("profiles").select("id, full_name, role, related_id, school_id, created_at").order("created_at", { ascending: false });
  query = includeUnassigned ? query.or(`school_id.eq.${schoolId},school_id.is.null`) : query.eq("school_id", schoolId);

  const { data: profiles, error } = await query.limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const emails = new Map<string, string | null>();
  await Promise.all(
    (profiles || []).map(async (p: any) => {
      const { data } = await supabaseAdmin.auth.admin.getUserById(p.id);
      emails.set(p.id, data?.user?.email ?? null);
    })
  );

  const shaped = (profiles || []).map((p: any) => ({
    ...p,
    email: emails.get(p.id) ?? null,
    is_self: p.id === auth.ctx.userId,
    unassigned: !p.school_id,
  }));

  return NextResponse.json({ data: shaped });
}
