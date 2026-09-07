import { NextResponse, type NextRequest } from "next/server";
import { requireRequestUser } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { recordAudit } from "@/lib/server/audit";

const ROLES = new Set(["admin", "teacher", "student", "parent"]);

// Change a member's role, link them to a teachers/students row, or claim an
// unassigned self-signup into this school. Removing a member detaches the
// profile from the school (the auth account is left intact).
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireRequestUser(req, { roles: ["admin"] });
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const schoolId = auth.ctx.tenant!.value;
  const body = await req.json().catch(() => null);
  const role = typeof body?.role === "string" ? body.role : undefined;
  const relatedId = body?.related_id === null ? null : typeof body?.related_id === "string" ? body.related_id : undefined;

  if (role !== undefined && !ROLES.has(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const { data: target } = await supabaseAdmin.from("profiles").select("id, role, school_id, related_id").eq("id", id).maybeSingle();
  if (!target || (target.school_id && target.school_id !== schoolId)) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  if (id === auth.ctx.userId && role && role !== "admin") {
    return NextResponse.json({ error: "You cannot remove your own admin role" }, { status: 400 });
  }

  if (relatedId) {
    const effectiveRole = role ?? target.role;
    const table = effectiveRole === "teacher" ? "teachers" : effectiveRole === "student" ? "students" : null;
    if (!table) return NextResponse.json({ error: "Only teachers and students can be linked to a record" }, { status: 400 });
    const { data: related } = await supabaseAdmin.from(table).select("id").eq("id", relatedId).eq("school_id", schoolId).maybeSingle();
    if (!related) return NextResponse.json({ error: "Linked record not found in this school" }, { status: 404 });
  }

  const update: Record<string, unknown> = { school_id: schoolId };
  if (role !== undefined) update.role = role;
  if (relatedId !== undefined) update.related_id = relatedId;

  const { error } = await supabaseAdmin.from("profiles").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await recordAudit({
    schoolId,
    actorId: auth.ctx.userId,
    actorEmail: auth.ctx.email,
    action: "member.updated",
    entityType: "profile",
    entityId: id,
    details: { from_role: target.role, to_role: role ?? target.role, related_id: relatedId ?? target.related_id, claimed: !target.school_id },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireRequestUser(req, { roles: ["admin"] });
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const schoolId = auth.ctx.tenant!.value;

  if (id === auth.ctx.userId) {
    return NextResponse.json({ error: "You cannot remove yourself" }, { status: 400 });
  }

  const { data: target } = await supabaseAdmin.from("profiles").select("id, role").eq("id", id).eq("school_id", schoolId).maybeSingle();
  if (!target) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ school_id: null, related_id: null, role: "student" })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from("parent_students").delete().eq("parent_id", id).eq("school_id", schoolId);

  await recordAudit({
    schoolId,
    actorId: auth.ctx.userId,
    actorEmail: auth.ctx.email,
    action: "member.removed",
    entityType: "profile",
    entityId: id,
    details: { previous_role: target.role },
  });

  return NextResponse.json({ ok: true });
}
