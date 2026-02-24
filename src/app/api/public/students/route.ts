import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { requirePublicApiAccess } from "@/lib/server/publicApi";

export async function GET(req: NextRequest) {
  const access = requirePublicApiAccess(req);
  if (!access.ok) return access.response;

  const { data, error } = await supabaseAdmin
    .from("students")
    .select("id, full_name, class_id, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
