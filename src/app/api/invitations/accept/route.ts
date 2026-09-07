import crypto from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requireRequestUser } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { recordAudit } from "@/lib/server/audit";
import { enforceRateLimit } from "@/lib/server/rateLimit";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Accepts an invitation for the signed-in user: attaches the profile to the
// school with the invited role and links (or creates) the matching
// teachers/students row. The invite email must match the account email.
export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, "invite-accept", 10, 10 * 60_000);
  if (limited) return limited;

  const auth = await requireRequestUser(req, { allowMissingTenant: true });
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  const fullNameInput = typeof body?.full_name === "string" ? body.full_name.trim() : "";
  if (!token) return NextResponse.json({ error: "token is required" }, { status: 400 });

  const { data: invite } = await supabaseAdmin
    .from("invitations")
    .select("id, school_id, email, role, related_id, expires_at, accepted_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();

  if (!invite) return NextResponse.json({ error: "This invitation is invalid or has been revoked" }, { status: 404 });
  if (invite.accepted_at) return NextResponse.json({ error: "This invitation has already been used" }, { status: 400 });
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "This invitation has expired" }, { status: 400 });
  }
  if ((auth.ctx.email || "").toLowerCase() !== String(invite.email).toLowerCase()) {
    return NextResponse.json(
      { error: `This invitation was sent to ${invite.email}. Sign in with that email to accept it.` },
      { status: 403 }
    );
  }
  if (auth.ctx.tenant && auth.ctx.tenant.value !== invite.school_id) {
    return NextResponse.json({ error: "Your account already belongs to a different school" }, { status: 400 });
  }

  const { data: school } = await supabaseAdmin.from("schools").select("id, status").eq("id", invite.school_id).maybeSingle();
  if (!school || school.status !== "active") {
    return NextResponse.json({ error: "This school is not accepting new members" }, { status: 400 });
  }

  const fullName = fullNameInput || (auth.ctx.profile?.full_name as string) || auth.ctx.email?.split("@")[0] || "User";
  let relatedId: string | null = invite.related_id ?? null;

  if (invite.role === "teacher") {
    if (!relatedId) {
      const { data: existing } = await supabaseAdmin
        .from("teachers")
        .select("id")
        .eq("school_id", invite.school_id)
        .ilike("email", invite.email)
        .maybeSingle();
      if (existing) relatedId = existing.id;
    }
    if (!relatedId) {
      const { data: created, error } = await supabaseAdmin
        .from("teachers")
        .insert([{ full_name: fullName, email: invite.email, school_id: invite.school_id }])
        .select("id")
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      relatedId = created.id;
    }
  } else if (invite.role === "student") {
    if (!relatedId) {
      const { data: existing } = await supabaseAdmin
        .from("students")
        .select("id")
        .eq("school_id", invite.school_id)
        .ilike("email", invite.email)
        .maybeSingle();
      if (existing) relatedId = existing.id;
    }
    if (!relatedId) {
      const { data: created, error } = await supabaseAdmin
        .from("students")
        .insert([{ full_name: fullName, email: invite.email, school_id: invite.school_id }])
        .select("id")
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      relatedId = created.id;
    }
  } else if (invite.role === "parent") {
    // Parents link through parent_students, not related_id.
    const childId = relatedId;
    relatedId = null;
    if (childId) {
      await supabaseAdmin
        .from("parent_students")
        .upsert([{ parent_id: auth.ctx.userId, student_id: childId, school_id: invite.school_id }], {
          onConflict: "parent_id,student_id",
        });
    } else {
      // Link every student whose parent_email matches.
      const { data: children } = await supabaseAdmin
        .from("students")
        .select("id")
        .eq("school_id", invite.school_id)
        .ilike("parent_email", invite.email);
      if (children && children.length) {
        await supabaseAdmin.from("parent_students").upsert(
          children.map((c: any) => ({ parent_id: auth.ctx.userId, student_id: c.id, school_id: invite.school_id })),
          { onConflict: "parent_id,student_id" }
        );
      }
    }
  } else {
    relatedId = null;
  }

  const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
    [{ id: auth.ctx.userId, full_name: fullName, role: invite.role, school_id: invite.school_id, related_id: relatedId }],
    { onConflict: "id" }
  );
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

  await supabaseAdmin
    .from("invitations")
    .update({ accepted_at: new Date().toISOString(), accepted_by: auth.ctx.userId })
    .eq("id", invite.id);

  await recordAudit({
    schoolId: invite.school_id,
    actorId: auth.ctx.userId,
    actorEmail: auth.ctx.email,
    action: "invitation.accepted",
    entityType: "profile",
    entityId: auth.ctx.userId,
    details: { role: invite.role },
  });

  return NextResponse.json({ ok: true, role: invite.role, schoolId: invite.school_id });
}
