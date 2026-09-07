import { NextResponse, type NextRequest } from "next/server";
import { requirePlatformAdmin } from "@/lib/server/platformAuth";
import { supabaseAdmin } from "@/lib/supabaseServer";

export async function GET(req: NextRequest) {
  const auth = await requirePlatformAdmin(req);
  if (!auth.ok) return auth.response;

  const { data: rows, error } = await supabaseAdmin
    .from("impersonation_audit_log")
    .select("id, platform_admin_id, target_user_id, target_school_id, started_at")
    .order("started_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const enriched = await Promise.all(
    (rows || []).map(async (row: any) => {
      const [adminUser, targetUser, school] = await Promise.all([
        row.platform_admin_id ? supabaseAdmin.auth.admin.getUserById(row.platform_admin_id) : null,
        row.target_user_id ? supabaseAdmin.auth.admin.getUserById(row.target_user_id) : null,
        row.target_school_id
          ? supabaseAdmin.from("schools").select("name").eq("id", row.target_school_id).maybeSingle()
          : null,
      ]);

      return {
        id: row.id,
        startedAt: row.started_at,
        platformAdminEmail: adminUser?.data?.user?.email || null,
        targetUserEmail: targetUser?.data?.user?.email || null,
        targetSchoolName: (school as any)?.data?.name || null,
      };
    })
  );

  return NextResponse.json({ data: enriched });
}
