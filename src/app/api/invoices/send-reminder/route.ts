import { NextResponse, type NextRequest } from "next/server";
import { Resend } from "resend";
import { paymentReminderTemplate } from "@/lib/emailTemplates/payment_reminder";
import { requireRequestUser } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { applyTenantFilter } from "@/lib/server/tenant";

const resendApiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.FROM_EMAIL;
const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || "";
const resend = resendApiKey ? new Resend(resendApiKey) : null;

export async function POST(req: NextRequest) {
  const auth = await requireRequestUser(req, { roles: ["admin"] });
  if (!auth.ok) return auth.response;

  if (!resend || !fromEmail) {
    return NextResponse.json({ error: "Email provider is not configured" }, { status: 500 });
  }

  const payload = await req.json().catch(() => null);
  const invoiceId = typeof payload?.invoiceId === "string" ? payload.invoiceId : "";
  if (!invoiceId) {
    return NextResponse.json({ error: "invoiceId is required" }, { status: 400 });
  }

  let invoiceQuery = supabaseAdmin
    .from("invoices")
    .select("id, reference, total_amount, amount, amount_paid, due_date, student_id, parent_email")
    .eq("id", invoiceId);
  invoiceQuery = applyTenantFilter(invoiceQuery, auth.ctx.tenant);

  const { data: invoice, error: invoiceError } = await invoiceQuery.maybeSingle();
  if (invoiceError || !invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  let studentQuery = supabaseAdmin.from("students").select("full_name, email").eq("id", invoice.student_id);
  studentQuery = applyTenantFilter(studentQuery, auth.ctx.tenant);
  const { data: student } = await studentQuery.maybeSingle();

  const to = invoice.parent_email || student?.email;
  if (!to) {
    return NextResponse.json({ error: "No recipient email" }, { status: 400 });
  }

  const total = Number(invoice.total_amount ?? invoice.amount ?? 0);
  const paid = Number(invoice.amount_paid ?? 0);
  const balance = Math.max(total - paid, 0);

  if (balance <= 0) {
    return NextResponse.json({ error: "Invoice already paid" }, { status: 400 });
  }

  const html = paymentReminderTemplate(
    student?.full_name || "Parent",
    balance,
    invoice.due_date || "",
    `${appUrl}/dashboard/invoices`
  );

  try {
    await resend.emails.send({
      from: fromEmail,
      to,
      subject: `Payment reminder - ${invoice.reference}`,
      html,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to send reminder" }, { status: 500 });
  }

  let updateQuery = supabaseAdmin
    .from("invoices")
    .update({ last_reminder_sent: new Date().toISOString() })
    .eq("id", invoiceId);
  updateQuery = applyTenantFilter(updateQuery, auth.ctx.tenant);
  await updateQuery;

  return NextResponse.json({ ok: true });
}
