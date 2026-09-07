import { NextResponse, type NextRequest } from "next/server";
import { paymentReminderTemplate } from "@/lib/emailTemplates/payment_reminder";
import { requireRequestUser } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { applyTenantFilter } from "@/lib/server/tenant";
import { getAppUrl, isEmailConfigured, sendEmail } from "@/lib/server/email";
import { getSchoolProfile } from "@/lib/server/schoolProfile";
import { recordAudit } from "@/lib/server/audit";

export async function POST(req: NextRequest) {
  const auth = await requireRequestUser(req, { roles: ["admin"] });
  if (!auth.ok) return auth.response;

  if (!isEmailConfigured()) {
    return NextResponse.json({ error: "Email provider is not configured" }, { status: 500 });
  }

  const payload = await req.json().catch(() => null);
  const invoiceId = typeof payload?.invoiceId === "string" ? payload.invoiceId : "";
  if (!invoiceId) {
    return NextResponse.json({ error: "invoiceId is required" }, { status: 400 });
  }

  let invoiceQuery = supabaseAdmin
    .from("invoices")
    .select("id, reference, total_amount, amount, amount_paid, due_date, status, student_id, parent_email, last_reminder_sent, fee_items(name)")
    .eq("id", invoiceId);
  invoiceQuery = applyTenantFilter(invoiceQuery, auth.ctx.tenant);

  const { data: invoice, error: invoiceError } = await invoiceQuery.maybeSingle();
  if (invoiceError || !invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (invoice.last_reminder_sent && Date.now() - new Date(invoice.last_reminder_sent).getTime() < 12 * 60 * 60 * 1000) {
    return NextResponse.json({ error: "A reminder was already sent in the last 12 hours" }, { status: 429 });
  }

  let studentQuery = supabaseAdmin.from("students").select("full_name, email, parent_name").eq("id", invoice.student_id);
  studentQuery = applyTenantFilter(studentQuery, auth.ctx.tenant);
  const { data: student } = await studentQuery.maybeSingle();

  const to = invoice.parent_email || student?.email;
  if (!to) {
    return NextResponse.json({ error: "No recipient email" }, { status: 400 });
  }

  const total = Number(invoice.total_amount ?? invoice.amount ?? 0);
  const paid = Number(invoice.amount_paid ?? 0);
  const balance = Math.max(total - paid, 0);

  if (balance <= 0 || invoice.status === "cancelled") {
    return NextResponse.json({ error: "Invoice is already settled" }, { status: 400 });
  }

  const school = await getSchoolProfile(auth.ctx.tenant);
  const html = paymentReminderTemplate({
    recipientName: student?.parent_name || student?.full_name || "Parent",
    studentName: student?.full_name || "your child",
    feeName: (invoice as any).fee_items?.name || "school fees",
    reference: invoice.reference,
    amount: balance,
    currency: school.currency,
    dueDate: invoice.due_date || "",
    paymentLink: `${getAppUrl()}/dashboard/invoices`,
    schoolName: school.name,
  });

  try {
    await sendEmail({
      to,
      subject: `${school.name}: payment reminder for ${invoice.reference}`,
      html,
      template: "payment_reminder",
      schoolId: auth.ctx.tenant?.value,
      relatedType: "invoice",
      relatedId: invoice.id,
      sentBy: auth.ctx.userId,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to send reminder" }, { status: 500 });
  }

  await supabaseAdmin.from("invoices").update({ last_reminder_sent: new Date().toISOString() }).eq("id", invoiceId);

  await recordAudit({
    schoolId: auth.ctx.tenant?.value,
    actorId: auth.ctx.userId,
    actorEmail: auth.ctx.email,
    action: "invoice.reminder_sent",
    entityType: "invoice",
    entityId: invoice.id,
    details: { to, balance },
  });

  return NextResponse.json({ ok: true });
}
