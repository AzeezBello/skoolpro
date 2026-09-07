import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { requirePublicApiAccess } from "@/lib/server/publicApi";
import { applyTenantFilter } from "@/lib/server/tenant";

export async function GET(req: NextRequest) {
  const access = await requirePublicApiAccess(req);
  if (!access.ok) return access.response;

  let query = supabaseAdmin
    .from("students")
    .select("id, full_name, class_id, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  query = applyTenantFilter(query, access.tenant);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
