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
  const limited = enforceRateLimit(req, "flutterwave-init", 20, 60_000);
  if (limited) return limited;

  const auth = await requireRequestUser(req, { roles: ["admin", "teacher", "student", "parent"] });
  if (!auth.ok) return auth.response;

  try {
    const flutterwaveSecret = getRequiredEnv("FLW_SECRET_KEY");
    const baseUrl = getRequiredEnv("NEXT_PUBLIC_BASE_URL");

    const payload = await req.json().catch(() => ({}));
    const invoiceId = typeof payload.invoice_id === "string" ? payload.invoice_id : "";
    const providedEmail = typeof payload.email === "string" ? payload.email.trim() : "";
    const amountUnit = typeof payload.amount_unit === "string" ? payload.amount_unit.toLowerCase() : undefined;

    if (!invoiceId || !payload.amount) {
      return NextResponse.json({ error: "invoice_id and amount are required" }, { status: 400 });
    }

    const invoice = await loadPayableInvoice(auth.ctx, invoiceId);
    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    const balance = invoiceBalance(invoice);
    if (balance <= 0 || invoice.status === "paid" || invoice.status === "cancelled") {
      return NextResponse.json({ error: "Invoice already settled" }, { status: 400 });
    }

    const requestedAmount = normalizeRequestedAmount(payload.amount, balance, amountUnit);
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

    const txRef = `flw-${invoiceId}-${Date.now()}`;

    const response = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: { Authorization: `Bearer ${flutterwaveSecret}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        tx_ref: txRef,
        amount: requestedAmount,
        currency: "NGN",
        redirect_url: `${baseUrl}/payments/verify/flutterwave`,
        customer: { email },
        meta: { invoice_id: invoiceId, school_id: invoice.school_id, initiated_by: auth.ctx.userId },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json({ error: data?.message || "Gateway error" }, { status: 502 });
    }

    await recordPendingGatewayPayment({
      gateway: "flutterwave",
      referenceField: "tx_ref",
      reference: txRef,
      invoiceId,
      amount: requestedAmount,
      schoolId: invoice.school_id,
      gatewayResponse: { link: data.data?.link, initiated_by: auth.ctx.userId },
    });

    return NextResponse.json({ link: data.data.link, reference: txRef, amount: requestedAmount, currency: "NGN" });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Unexpected error" }, { status: 500 });
  }
}
