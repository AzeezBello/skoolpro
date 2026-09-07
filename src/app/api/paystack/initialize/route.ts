import { NextResponse } from "next/server";
import { requireRequestUser } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { enforceRateLimit } from "@/lib/server/rateLimit";
import { loadPayableInvoice, invoiceBalance } from "@/lib/server/invoiceAccess";
import { normalizeRequestedAmount, recordPendingGatewayPayment } from "@/lib/server/payments";

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

export async function POST(req: Request) {
  const limited = enforceRateLimit(req, "paystack-init", 20, 60_000);
  if (limited) return limited;

  const auth = await requireRequestUser(req, { roles: ["admin", "teacher", "student", "parent"] });
  if (!auth.ok) return auth.response;

  try {
    const paystackSecret = getRequiredEnv("PAYSTACK_SECRET_KEY");
    const baseUrl = getRequiredEnv("NEXT_PUBLIC_BASE_URL");

    const body = await req.json().catch(() => ({}));
    const invoiceId = typeof body.invoice_id === "string" ? body.invoice_id : "";
    const providedEmail = typeof body.email === "string" ? body.email.trim() : "";
    const amountUnit = typeof body.amount_unit === "string" ? body.amount_unit.toLowerCase() : undefined;

    if (!invoiceId || !body.amount) {
      return NextResponse.json({ error: "invoice_id and amount are required" }, { status: 400 });
    }

    const invoice = await loadPayableInvoice(auth.ctx, invoiceId);
    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    const balance = invoiceBalance(invoice);
    if (balance <= 0 || invoice.status === "paid" || invoice.status === "cancelled") {
      return NextResponse.json({ error: "Invoice already settled" }, { status: 400 });
    }

    const requestedAmount = normalizeRequestedAmount(body.amount, balance, amountUnit);
    if (requestedAmount === null) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }
    if (requestedAmount > balance) {
      return NextResponse.json({ error: "Amount exceeds invoice balance" }, { status: 400 });
    }

    let email = providedEmail || auth.ctx.email || "";
    if (!email) {
      const { data: student } = await supabaseAdmin
        .from("students")
        .select("email, parent_email")
        .eq("id", invoice.student_id)
        .maybeSingle();
      email = invoice.parent_email || student?.parent_email || student?.email || "";
    }
    if (!email) {
      return NextResponse.json({ error: "Payer email is required" }, { status: 400 });
    }

    const amountInKobo = Math.round(requestedAmount * 100);

    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${paystackSecret}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        amount: amountInKobo,
        currency: "NGN",
        metadata: { invoice_id: invoiceId, school_id: invoice.school_id, initiated_by: auth.ctx.userId },
        callback_url: `${baseUrl}/payments/verify/paystack`,
      }),
    });

    const paystackData = await paystackRes.json();
    if (!paystackRes.ok) {
      return NextResponse.json({ error: paystackData?.message || "Gateway error" }, { status: 502 });
    }

    const reference = paystackData?.data?.reference;
    if (!reference) {
      return NextResponse.json({ error: "Gateway did not return a payment reference" }, { status: 502 });
    }

    await recordPendingGatewayPayment({
      gateway: "paystack",
      referenceField: "reference",
      reference,
      invoiceId,
      amount: requestedAmount,
      schoolId: invoice.school_id,
      gatewayResponse: { access_code: paystackData.data.access_code, initiated_by: auth.ctx.userId },
    });

    return NextResponse.json({
      authorization_url: paystackData.data.authorization_url,
      reference,
      amount: requestedAmount,
      currency: "NGN",
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Unexpected error" }, { status: 500 });
  }
}
