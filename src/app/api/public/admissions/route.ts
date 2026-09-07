import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { enforceRateLimit } from "@/lib/server/rateLimit";
import { isEmailConfigured, sendEmail, escapeHtml } from "@/lib/server/email";

const schema = z.object({
  slug: z.string().min(1).max(80),
  applicant_name: z.string().trim().min(2).max(120),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  gender: z.enum(["male", "female", "other"]).optional().or(z.literal("")),
  applying_for_class_id: z.string().uuid().optional().or(z.literal("")),
  previous_school: z.string().trim().max(160).optional().or(z.literal("")),
  parent_name: z.string().trim().min(2).max(120),
  parent_email: z.string().trim().email(),
  parent_phone: z.string().trim().max(30).optional().or(z.literal("")),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  website: z.string().max(0).optional(), // honeypot
});

// Public, unauthenticated application form. Looks up the school by slug and
// only accepts while admissions_open is true.
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const { data: school } = await supabaseAdmin.from("schools").select("id, name, logo_url, admissions_open, status").eq("slug", slug).maybeSingle();
  if (!school || school.status !== "active") return NextResponse.json({ error: "School not found" }, { status: 404 });
  const { data: classes } = await supabaseAdmin.from("classes").select("id, name").eq("school_id", school.id).order("name");
  return NextResponse.json({ school: { name: school.name, logo_url: school.logo_url, admissions_open: school.admissions_open }, classes: classes || [] });
}

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, "admissions", 5, 10 * 60_000);
  if (limited) return limited;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid form" }, { status: 400 });
  const d = parsed.data;
  if (d.website) return NextResponse.json({ ok: true }); // bot

  const { data: school } = await supabaseAdmin.from("schools").select("id, name, admissions_open, status, email").eq("slug", d.slug).maybeSingle();
  if (!school || school.status !== "active") return NextResponse.json({ error: "School not found" }, { status: 404 });
  if (!school.admissions_open) return NextResponse.json({ error: "Admissions are currently closed" }, { status: 400 });

  let className: string | null = null;
  if (d.applying_for_class_id) {
    const { data: cls } = await supabaseAdmin.from("classes").select("name").eq("id", d.applying_for_class_id).eq("school_id", school.id).maybeSingle();
    className = cls?.name ?? null;
  }

  const { data: app, error } = await supabaseAdmin
    .from("admission_applications")
    .insert([
      {
        school_id: school.id,
        applicant_name: d.applicant_name,
        date_of_birth: d.date_of_birth || null,
        gender: d.gender || null,
        applying_for_class_id: d.applying_for_class_id || null,
        applying_for_class_name: className,
        previous_school: d.previous_school || null,
        parent_name: d.parent_name,
        parent_email: d.parent_email.toLowerCase(),
        parent_phone: d.parent_phone || null,
        address: d.address || null,
        notes: d.notes || null,
      },
    ])
    .select("id")
    .single();
  if (error || !app) return NextResponse.json({ error: error?.message || "Could not submit" }, { status: 500 });

  if (isEmailConfigured()) {
    sendEmail({
      to: d.parent_email,
      subject: `${school.name}: application received for ${d.applicant_name}`,
      template: "admission_received",
      schoolId: school.id,
      relatedType: "admission",
      relatedId: app.id,
      html: `<div style="font-family:Arial,sans-serif;color:#222;max-width:560px"><h2 style="color:#0A4D68">${escapeHtml(school.name)}</h2><p>Dear ${escapeHtml(d.parent_name)},</p><p>We have received your application for <strong>${escapeHtml(d.applicant_name)}</strong>${className ? ` (${escapeHtml(className)})` : ""}. Your reference is <strong>${app.id.slice(0, 8).toUpperCase()}</strong>.</p><p>We will contact you at this address once it has been reviewed.</p></div>`,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, reference: app.id.slice(0, 8).toUpperCase() }, { status: 201 });
}
