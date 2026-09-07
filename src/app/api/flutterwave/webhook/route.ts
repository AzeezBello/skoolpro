import crypto from "crypto";
import { NextResponse } from "next/server";
import { applyInvoicePayment, verifyFlutterwaveTransaction } from "@/lib/server/payments";
import { applyPlanPurchase } from "@/lib/server/billing";

function timingSafeEqual(a: string, b: string) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Flutterwave webhooks carry only a static "verif-hash" shared secret, not a
// body signature, so the payload itself is never trusted: after the hash
// check the transaction is re-verified server-to-server and the settled
// amount/currency from that verification is what gets credited.
export async function POST(req: Request) {
  try {
    const configuredHash = (process.env.FLW_WEBHOOK_SECRET_HASH || "").trim();
    if (!configuredHash) {
      return NextResponse.json({ error: "Webhook is not configured. Set FLW_WEBHOOK_SECRET_HASH." }, { status: 500 });
    }

    const raw = await req.text();
    const headerHash = req.headers.get("verif-hash") || "";
    if (!headerHash || !timingSafeEqual(headerHash, configuredHash)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(raw);
    const status = String(event?.data?.status || event?.status || "").toLowerCase();
    if (status !== "successful" && status !== "completed") {
      return NextResponse.json({ ok: true, skipped: "not successful" });
    }

    const transactionId = String(event?.data?.id || event?.id || "");
    if (!transactionId) {
      return NextResponse.json({ ok: true, skipped: "missing transaction id" });
    }

    const verified = await verifyFlutterwaveTransaction(transactionId);
    const txRef = String(verified.tx_ref || "");
    const invoiceId = typeof verified.meta?.invoice_id === "string" ? (verified.meta.invoice_id as string) : "";
    const currency = String(verified.currency || "NGN").toUpperCase();
    const amountNaira = Number(verified.amount || 0);

    if (verified.meta?.type === "plan" && txRef) {
      if (verified.status === "successful" && currency === "NGN") await applyPlanPurchase(txRef, verified);
      return NextResponse.json({ ok: true });
    }

    if (!txRef || !invoiceId) {
      return NextResponse.json({ ok: true, skipped: "missing reference or invoice" });
    }
    if (verified.status !== "successful" || amountNaira <= 0) {
      return NextResponse.json({ ok: true, skipped: "verification not successful" });
    }
    if (currency !== "NGN") {
      console.warn("flutterwave webhook: unexpected currency", { txRef, currency });
      return NextResponse.json({ ok: true, skipped: "currency" });
    }

    await applyInvoicePayment({
      invoiceId,
      amount: amountNaira,
      gateway: "flutterwave",
      reference: txRef,
      gatewayResponse: verified,
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Webhook error" }, { status: 500 });
  }
}
