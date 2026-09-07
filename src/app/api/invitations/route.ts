import crypto from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requireRequestUser } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { recordAudit } from "@/lib/server/audit";
import { escapeHtml, getAppUrl, isEmailConfigured, sendEmail } from "@/lib/server/email";
import { getSchoolProfile } from "@/lib/server/schoolProfile";

export const dynamic = "force-dynamic";

const INVITABLE_ROLES = new Set(["admin", "teacher", "student", "parent"]);

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function GET(req: NextRequest) {
  const auth = await requireRequestUser(req, { roles: ["admin"] });
  if (!auth.ok) return auth.response;

  const { data, error } = await supabaseAdmin
    .from("invitations")
    .select("id, email, role, related_id, expires_at, accepted_at, created_at, invited_by")
    .eq("school_id", auth.ctx.tenant!.value)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// Creates an invitation and emails the link. The response also returns the
// link so an admin can share it manually when email isn't configured.
export async function POST(req: NextRequest) {
  const auth = await requireRequestUser(req, { roles: ["admin"] });
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = typeof body?.role === "string" ? body.role : "teacher";
  const relatedId = typeof body?.related_id === "string" && body.related_id ? body.related_id : null;
  const fullName = typeof body?.full_name === "string" ? body.full_name.trim() : "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }
  if (!INVITABLE_ROLES.has(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const schoolId = auth.ctx.tenant!.value;

  // Optional link to an existing teachers/students row (must be in-school).
  if (relatedId) {
    const table = role === "teacher" ? "teachers" : role === "student" || role === "parent" ? "students" : null;
    if (!table) {
      return NextResponse.json({ error: "related_id is only valid for teacher, student or parent invites" }, { status: 400 });
    }
    const { data: related } = await supabaseAdmin.from(table).select("id").eq("id", relatedId).eq("school_id", schoolId).maybeSingle();
    if (!related) return NextResponse.json({ error: "Linked record not found in this school" }, { status: 404 });
  }

  // Revoke any still-pending invite for the same address so only one is live.
  await supabaseAdmin
    .from("invitations")
    .delete()
    .eq("school_id", schoolId)
    .eq("email", email)
    .is("accepted_at", null);

  const token = crypto.randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: invite, error } = await supabaseAdmin
    .from("invitations")
    .insert([
      {
        school_id: schoolId,
        email,
        role,
        related_id: relatedId,
        token_hash: hashToken(token),
        invited_by: auth.ctx.userId,
        expires_at: expiresAt,
      },
    ])
    .select("id, email, role, expires_at")
    .single();

  if (error || !invite) {
    return NextResponse.json({ error: error?.message || "Could not create invitation" }, { status: 500 });
  }

  const link = `${getAppUrl()}/register?invite=${encodeURIComponent(token)}`;
  let emailed = false;
  let emailError: string | null = null;

  if (isEmailConfigured()) {
    try {
      const school = await getSchoolProfile(auth.ctx.tenant);
      await sendEmail({
        to: email,
        subject: `You're invited to join ${school.name} on SkoolPro`,
        template: "invitation",
        schoolId,
        relatedType: "invitation",
        relatedId: invite.id,
        sentBy: auth.ctx.userId,
        html: `
          <div style="font-family: Arial, sans-serif; color: #222; max-width: 560px;">
            <h2 style="color:#0A4D68;">${escapeHtml(school.name)}</h2>
            <p>Hello${fullName ? ` ${escapeHtml(fullName)}` : ""},</p>
            <p>You have been invited to join <strong>${escapeHtml(school.name)}</strong> on SkoolPro as a <strong>${escapeHtml(role)}</strong>.</p>
            <p><a href="${link}" style="background:#0A4D68;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block;">Accept invitation</a></p>
            <p style="font-size:12px;color:#666;">This link expires in 7 days. If you weren't expecting it, you can ignore this email.</p>
          </div>`,
      });
      emailed = true;
    } catch (err: any) {
      emailError = err?.message || "Email failed";
    }
  }

  await recordAudit({
    schoolId,
    actorId: auth.ctx.userId,
    actorEmail: auth.ctx.email,
    action: "invitation.created",
    entityType: "invitation",
    entityId: invite.id,
    details: { email, role, emailed },
  });

  return NextResponse.json({ invitation: invite, link, emailed, emailError }, { status: 201 });
}
