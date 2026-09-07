import { NextResponse, type NextRequest } from "next/server";
import { requirePlatformAdmin } from "@/lib/server/platformAuth";
import { supabaseAdmin } from "@/lib/supabaseServer";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requirePlatformAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  const { data: school, error: schoolError } = await supabaseAdmin
    .from("schools")
    .select("id, name, slug, status, created_at, plan_id, plan_expires_at")
    .eq("id", id)
    .maybeSingle();

  if (schoolError || !school) {
    return NextResponse.json({ error: "School not found" }, { status: 404 });
  }

  const [{ count: studentCount }, { count: teacherCount }, { count: classCount }, { data: staffProfiles }] =
    await Promise.all([
      supabaseAdmin.from("students").select("*", { count: "exact", head: true }).eq("school_id", id),
      supabaseAdmin.from("teachers").select("*", { count: "exact", head: true }).eq("school_id", id),
      supabaseAdmin.from("classes").select("*", { count: "exact", head: true }).eq("school_id", id),
      supabaseAdmin.from("profiles").select("id, full_name, role").eq("school_id", id).in("role", ["admin", "teacher"]),
    ]);

  // Emails live only in auth.users, not profiles, so this is a small N+1 —
  // acceptable since a school's admin/teacher roster is typically tiny.
  const staff = await Promise.all(
    (staffProfiles || []).map(async (p: any) => {
      const { data } = await supabaseAdmin.auth.admin.getUserById(p.id);
      return { id: p.id, fullName: p.full_name, role: p.role, email: data?.user?.email || null };
    })
  );

  return NextResponse.json({
    data: {
      school,
      counts: { students: studentCount || 0, teachers: teacherCount || 0, classes: classCount || 0 },
      staff,
    },
  });
}
