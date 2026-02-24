import crypto from "crypto";
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

async function applyInvoicePayment(supabase: any, invoiceId: string, amount: number, reference: string) {
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id, amount, total_amount, amount_paid, status, payment_history")
    .eq("id", invoiceId)
    .maybeSingle();

  if (invoiceError || !invoice) {
    return;
  }

  const total = Number(invoice.total_amount ?? invoice.amount ?? 0);
  const paid = Number(invoice.amount_paid ?? 0);
  const remaining = Math.max(total - paid, 0);
  const applied = Math.min(Math.max(amount, 0), remaining);

  if (applied <= 0 && invoice.status === "paid") {
    return;
  }

  const newPaid = paid + applied;
  const newStatus = newPaid >= total ? "paid" : newPaid > 0 ? "partial" : invoice.status || "pending";

  const historyEntry = {
    amount: applied,
    date: new Date().toISOString(),
    by: "paystack",
    method: "gateway",
    reference,
  };

  const history = Array.isArray(invoice.payment_history)
    ? [...(invoice.payment_history as unknown[]), historyEntry]
    : [historyEntry];

  await supabase
    .from("invoices")
    .update({ amount_paid: newPaid, status: newStatus, payment_history: history })
    .eq("id", invoiceId);
}

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseServiceClient();
    const paystackSecret = getRequiredEnv("PAYSTACK_SECRET_KEY");

    const raw = await req.text();
    const headerSignature = (req.headers.get("x-paystack-signature") || "").toString();
    const expectedHash = crypto.createHmac("sha512", paystackSecret).update(raw).digest("hex");

    if (!headerSignature || headerSignature !== expectedHash) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(raw);

    if (event.event === "charge.success" || event.event === "transaction.success") {
      const data = event.data || {};
      const reference = typeof data.reference === "string" ? data.reference : "";
      const metadata = data.metadata || {};
      const invoiceId = typeof metadata.invoice_id === "string" ? metadata.invoice_id : "";

      if (!reference || !invoiceId) {
        return NextResponse.json({ ok: true });
      }

      const { data: existing } = await supabase
        .from("payments")
        .select("id, status")
        .eq("gateway", "paystack")
        .eq("gateway_response->>reference", reference)
        .maybeSingle();

      if (existing?.status === "success") {
        return NextResponse.json({ ok: true });
      }

      const amountFromMetadata = Number(metadata.amount_naira || 0);
      const amountFromGateway = Number(data.amount || 0) / 100;
      const amountNaira = amountFromMetadata > 0 ? amountFromMetadata : amountFromGateway;

      if (existing?.id) {
        await supabase
          .from("payments")
          .update({
            invoice_id: invoiceId,
            amount: amountNaira,
            status: "success",
            gateway_response: data,
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("payments").insert([
          {
            invoice_id: invoiceId,
            gateway: "paystack",
            amount: amountNaira,
            status: "success",
            gateway_response: data,
          },
        ]);
      }

      if (amountNaira > 0) {
        await applyInvoicePayment(supabase, invoiceId, amountNaira, reference);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Webhook processing error" }, { status: 500 });
  }
}
