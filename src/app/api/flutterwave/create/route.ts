import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_KEY!;
const FLW_SECRET = process.env.FLW_SECRET_KEY!;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

function normalizeRequestedAmount(rawAmount: unknown, balance: number, unit?: string) {
  const parsed = Number(rawAmount);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;

  if (unit === "kobo") return parsed / 100;
  if (unit === "naira") return parsed;

  if (parsed > balance * 10) return parsed / 100;
  return parsed;
}

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const invoiceId = typeof payload.invoice_id === "string" ? payload.invoice_id : "";
    const providedEmail = typeof payload.email === "string" ? payload.email.trim() : "";
    const amountUnit = typeof payload.amount_unit === "string" ? payload.amount_unit.toLowerCase() : undefined;

    if (!invoiceId || !payload.amount) {
      return NextResponse.json({ error: "invoice_id and amount are required" }, { status: 400 });
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("id, amount, total_amount, amount_paid, student_id, status")
      .eq("id", invoiceId)
      .maybeSingle();

    if (invoiceError) return NextResponse.json({ error: invoiceError.message }, { status: 500 });
    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    const total = Number(invoice.total_amount ?? invoice.amount ?? 0);
    const paid = Number(invoice.amount_paid ?? 0);
    const balance = Math.max(total - paid, 0);

    if (balance <= 0 || invoice.status === "paid") {
      return NextResponse.json({ error: "Invoice already settled" }, { status: 400 });
    }

    const requestedAmount = normalizeRequestedAmount(payload.amount, balance, amountUnit);
    if (requestedAmount === null) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    if (requestedAmount > balance) {
      return NextResponse.json({ error: "Amount exceeds invoice balance" }, { status: 400 });
    }

    let email = providedEmail;
    if (!email && invoice.student_id) {
      const { data: student } = await supabase
        .from("students")
        .select("email, parent_email")
        .eq("id", invoice.student_id)
        .maybeSingle();
      email = student?.parent_email || student?.email || "";
    }

    if (!email) {
      return NextResponse.json({ error: "Payer email is required" }, { status: 400 });
    }

    const txRef = `flw-${invoiceId}-${Date.now()}`;

    const requestBody = {
      tx_ref: txRef,
      amount: requestedAmount,
      currency: "NGN",
      redirect_url: `${BASE_URL}/payments/verify/flutterwave`,
      customer: { email },
      meta: { invoice_id: invoiceId, amount_naira: requestedAmount },
    };

    const response = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FLW_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json({ error: data }, { status: response.status });
    }

    const { data: existing } = await supabase
      .from("payments")
      .select("id")
      .eq("gateway", "flutterwave")
      .eq("gateway_response->>tx_ref", txRef)
      .maybeSingle();

    if (existing?.id) {
      await supabase
        .from("payments")
        .update({
          invoice_id: invoiceId,
          amount: requestedAmount,
          status: "pending",
          gateway_response: data.data,
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("payments").insert([
        {
          invoice_id: invoiceId,
          gateway: "flutterwave",
          amount: requestedAmount,
          status: "pending",
          gateway_response: data.data,
        },
      ]);
    }

    return NextResponse.json({
      link: data.data.link,
      reference: txRef,
      amount: requestedAmount,
      currency: "NGN",
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Unexpected error" }, { status: 500 });
  }
}
