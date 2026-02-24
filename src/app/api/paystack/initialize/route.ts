import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function getSupabaseServiceClient() {
  return createClient(getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"), getRequiredEnv("SUPABASE_SERVICE_KEY"));
}

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
    const supabase = getSupabaseServiceClient();
    const paystackSecret = getRequiredEnv("PAYSTACK_SECRET_KEY");
    const baseUrl = getRequiredEnv("NEXT_PUBLIC_BASE_URL");

    const body = await req.json();
    const invoiceId = typeof body.invoice_id === "string" ? body.invoice_id : "";
    const providedEmail = typeof body.email === "string" ? body.email.trim() : "";
    const amountUnit = typeof body.amount_unit === "string" ? body.amount_unit.toLowerCase() : undefined;

    if (!invoiceId || !body.amount) {
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

    const requestedAmount = normalizeRequestedAmount(body.amount, balance, amountUnit);
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

    const amountInKobo = Math.round(requestedAmount * 100);

    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: amountInKobo,
        metadata: { invoice_id: invoiceId, amount_naira: requestedAmount },
        callback_url: `${baseUrl}/payments/verify/paystack`,
      }),
    });

    const paystackData = await paystackRes.json();
    if (!paystackRes.ok) {
      return NextResponse.json({ error: paystackData }, { status: paystackRes.status });
    }

    const reference = paystackData?.data?.reference;
    if (!reference) {
      return NextResponse.json({ error: "Gateway did not return a payment reference" }, { status: 502 });
    }

    const { data: existing } = await supabase
      .from("payments")
      .select("id")
      .eq("gateway", "paystack")
      .eq("gateway_response->>reference", reference)
      .maybeSingle();

    if (existing?.id) {
      await supabase
        .from("payments")
        .update({
          invoice_id: invoiceId,
          amount: requestedAmount,
          status: "pending",
          gateway_response: paystackData.data,
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("payments").insert([
        {
          invoice_id: invoiceId,
          gateway: "paystack",
          amount: requestedAmount,
          status: "pending",
          gateway_response: paystackData.data,
        },
      ]);
    }

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
