import crypto from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_KEY!;
const FLW_SECRET = process.env.FLW_SECRET_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

async function applyInvoicePayment(invoiceId: string, amount: number, reference: string) {
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
    by: "flutterwave",
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

function isValidWebhookSignature(raw: string, incomingHash: string) {
  const configuredHash = process.env.FLW_WEBHOOK_SECRET_HASH || process.env.FLW_SECRET_HASH || "";
  const computedHash = crypto.createHmac("sha256", FLW_SECRET).update(raw).digest("hex");

  if (!incomingHash) return false;
  if (configuredHash && incomingHash === configuredHash) return true;
  if (incomingHash === computedHash) return true;
  if (incomingHash === FLW_SECRET) return true;

  return false;
}

export async function POST(req: Request) {
  try {
    const raw = await req.text();
    const headerHash = req.headers.get("verif-hash") || "";

    if (!isValidWebhookSignature(raw, headerHash)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(raw);
    const status = String(event?.data?.status || event?.status || "").toLowerCase();

    if (status !== "successful" && status !== "completed") {
      return NextResponse.json({ ok: true });
    }

    const txRef = String(event?.data?.tx_ref || event?.tx_ref || "");
    const metadata = event?.data?.meta || event?.meta || {};
    const invoiceId = typeof metadata.invoice_id === "string" ? metadata.invoice_id : "";

    if (!txRef || !invoiceId) {
      return NextResponse.json({ ok: true });
    }

    const { data: existing } = await supabase
      .from("payments")
      .select("id, status")
      .eq("gateway", "flutterwave")
      .eq("gateway_response->>tx_ref", txRef)
      .maybeSingle();

    if (existing?.status === "success") {
      return NextResponse.json({ ok: true });
    }

    const amountFromMetadata = Number(metadata.amount_naira || 0);
    const amountFromGateway = Number(event?.data?.amount || event?.amount || event?.data?.charged_amount || 0);
    const amountNaira = amountFromMetadata > 0 ? amountFromMetadata : amountFromGateway;

    if (existing?.id) {
      await supabase
        .from("payments")
        .update({
          invoice_id: invoiceId,
          amount: amountNaira,
          status: "success",
          gateway_response: event?.data || event,
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("payments").insert([
        {
          invoice_id: invoiceId,
          gateway: "flutterwave",
          amount: amountNaira,
          status: "success",
          gateway_response: event?.data || event,
        },
      ]);
    }

    if (amountNaira > 0) {
      await applyInvoicePayment(invoiceId, amountNaira, txRef);
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Webhook error" }, { status: 500 });
  }
}
