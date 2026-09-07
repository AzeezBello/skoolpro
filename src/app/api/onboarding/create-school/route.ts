import { NextResponse, type NextRequest } from "next/server";
import { requireRequestUser } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { recordAudit } from "@/lib/server/audit";
import { enforceRateLimit } from "@/lib/server/rateLimit";

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
}

// Self-service school registration. A signed-up user with no school creates
// one and becomes its admin. Runs with the service role because the RLS
// insert policy deliberately forbids self-assigning role/school; this route is
// the one sanctioned path, and it refuses users already attached to a school.
export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, "create-school", 5, 60 * 60_000);
  if (limited) return limited;

  const auth = await requireRequestUser(req, { allowMissingTenant: true });
  if (!auth.ok) return auth.response;

  if (auth.ctx.tenant) {
    return NextResponse.json({ error: "Your account already belongs to a school" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const fullName = typeof body?.full_name === "string" ? body.full_name.trim() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const address = typeof body?.address === "string" ? body.address.trim() : "";

  if (name.length < 2 || name.length > 120) {
    return NextResponse.json({ error: "School name must be between 2 and 120 characters" }, { status: 400 });
  }

  const base = slugify(name) || "school";
  let slug = base;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: existing } = await supabaseAdmin.from("schools").select("id").eq("slug", slug).maybeSingle();
    if (!existing) break;
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const { data: school, error: schoolError } = await supabaseAdmin
    .from("schools")
    .insert([
      {
        name,
        slug,
        owner_user_id: auth.ctx.userId,
        phone: phone || null,
        address: address || null,
        email: auth.ctx.email,
        settings: { currency: "NGN", country: "NG", timezone: "Africa/Lagos" },
      },
    ])
    .select("id, name, slug")
    .single();

  if (schoolError || !school) {
    return NextResponse.json({ error: schoolError?.message || "Could not create school" }, { status: 500 });
  }

  const profilePayload = {
    id: auth.ctx.userId,
    full_name: fullName || (auth.ctx.profile?.full_name as string) || auth.ctx.email?.split("@")[0] || "Admin",
    role: "admin",
    school_id: school.id,
    related_id: null,
  };

  const { error: profileError } = await supabaseAdmin.from("profiles").upsert([profilePayload], { onConflict: "id" });
  if (profileError) {
    await supabaseAdmin.from("schools").delete().eq("id", school.id);
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  await recordAudit({
    schoolId: school.id,
    actorId: auth.ctx.userId,
    actorEmail: auth.ctx.email,
    action: "school.created",
    entityType: "school",
    entityId: school.id,
    details: { name },
  });

  return NextResponse.json({ school }, { status: 201 });
}
