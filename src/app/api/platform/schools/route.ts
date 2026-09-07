import { NextResponse, type NextRequest } from "next/server";
import { requirePlatformAdmin } from "@/lib/server/platformAuth";
import { supabaseAdmin } from "@/lib/supabaseServer";

export async function GET(req: NextRequest) {
  const auth = await requirePlatformAdmin(req);
  if (!auth.ok) return auth.response;

  const { data: schools, error } = await supabaseAdmin
    .from("schools")
    .select("id, name, slug, status, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const withCounts = await Promise.all(
    (schools || []).map(async (school: any) => {
      const [{ count: studentCount }, { count: teacherCount }, { count: classCount }] = await Promise.all([
        supabaseAdmin.from("students").select("*", { count: "exact", head: true }).eq("school_id", school.id),
        supabaseAdmin.from("teachers").select("*", { count: "exact", head: true }).eq("school_id", school.id),
        supabaseAdmin.from("classes").select("*", { count: "exact", head: true }).eq("school_id", school.id),
      ]);

      return {
        ...school,
        studentCount: studentCount || 0,
        teacherCount: teacherCount || 0,
        classCount: classCount || 0,
      };
    })
  );

  return NextResponse.json({ data: withCounts });
}

export async function POST(req: NextRequest) {
  const auth = await requirePlatformAdmin(req);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const slugInput = typeof body?.slug === "string" ? body.slug.trim() : "";

  if (!name) {
    return NextResponse.json({ error: "School name is required" }, { status: 400 });
  }

  const derivedSlug =
    slugInput ||
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

  const { data, error } = await supabaseAdmin
    .from("schools")
    .insert([{ name, slug: derivedSlug || null }])
    .select("id, name, slug, status, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
