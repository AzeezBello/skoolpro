import crypto from "crypto";
import { NextResponse } from "next/server";
import { applyInvoicePayment } from "@/lib/server/payments";
import { applyPlanPurchase } from "@/lib/server/billing";

function timingSafeEqual(a: string, b: string) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// The amount credited is always the amount Paystack says it settled, never a
// value echoed back from our own metadata (which a tampered initialise call
// could have inflated). Currency must match too.
export async function POST(req: Request) {
  try {
    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackSecret) {
      return NextResponse.json({ error: "PAYSTACK_SECRET_KEY is required." }, { status: 500 });
    }

    const raw = await req.text();
    const headerSignature = (req.headers.get("x-paystack-signature") || "").toString();
    const expectedHash = crypto.createHmac("sha512", paystackSecret).update(raw).digest("hex");

    if (!headerSignature || !timingSafeEqual(headerSignature, expectedHash)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(raw);

    if (event.event === "charge.success" || event.event === "transaction.success") {
      const data = event.data || {};
      const reference = typeof data.reference === "string" ? data.reference : "";
      const metadata = data.metadata || {};
      const invoiceId = typeof metadata.invoice_id === "string" ? metadata.invoice_id : "";
      const currency = String(data.currency || "NGN").toUpperCase();
      const amountNaira = Number(data.amount || 0) / 100;

      if (metadata.type === "plan" && reference) {
        if (String(data.status || "success") === "success" && currency === "NGN") {
          await applyPlanPurchase(reference, data);
        }
        return NextResponse.json({ ok: true });
      }

      if (!reference || !invoiceId) {
        return NextResponse.json({ ok: true, skipped: "missing reference or invoice" });
      }

      if (currency !== "NGN") {
        console.warn("paystack webhook: unexpected currency", { reference, currency });
        return NextResponse.json({ ok: true, skipped: "currency" });
      }

      if (String(data.status || "success") !== "success" || amountNaira <= 0) {
        return NextResponse.json({ ok: true, skipped: "not successful" });
      }

      await applyInvoicePayment({
        invoiceId,
        amount: amountNaira,
        gateway: "paystack",
        reference,
        gatewayResponse: data,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    // Non-2xx makes Paystack retry, which is what we want when the DB write failed.
    return NextResponse.json({ error: error?.message || "Webhook processing error" }, { status: 500 });
  }
}
