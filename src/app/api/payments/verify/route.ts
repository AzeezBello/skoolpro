import { NextResponse, type NextRequest } from "next/server";
import { enforceRateLimit } from "@/lib/server/rateLimit";
import { applyInvoicePayment, verifyFlutterwaveTransaction, verifyPaystackTransaction } from "@/lib/server/payments";
import { applyPlanPurchase } from "@/lib/server/billing";

// Reached from the browser after a gateway checkout redirect. Query params
// are user-controlled and never trusted; the gateway's verify API is the only
// source of truth, and crediting is idempotent on the reference so a race
// with the webhook cannot double-apply. The response deliberately reveals
// only what the payer already knows (status + amount), never invoice ids.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req, "payment-verify", 30, 60_000);
  if (limited) return limited;

  const gateway = (req.nextUrl.searchParams.get("gateway") || "").toLowerCase();

  try {
    if (gateway === "paystack") {
      const reference = req.nextUrl.searchParams.get("reference") || "";
      if (!reference) return NextResponse.json({ error: "Missing reference" }, { status: 400 });

      const data = await verifyPaystackTransaction(reference);
      const invoiceId = typeof data.metadata?.invoice_id === "string" ? (data.metadata.invoice_id as string) : "";
      const success = data.status === "success" && String(data.currency || "NGN").toUpperCase() === "NGN";
      const amountNaira = Number(data.amount || 0) / 100;

      if (success && data.metadata?.type === "plan") {
        await applyPlanPurchase(reference, data);
        return NextResponse.json({ success, status: data.status, amount: amountNaira, kind: "plan" });
      }

      if (success && invoiceId && amountNaira > 0) {
        await applyInvoicePayment({ invoiceId, amount: amountNaira, gateway: "paystack", reference, gatewayResponse: data });
      }

      return NextResponse.json({ success, status: data.status, amount: amountNaira });
    }

    if (gateway === "flutterwave") {
      const transactionId = req.nextUrl.searchParams.get("transaction_id") || "";
      if (!transactionId) return NextResponse.json({ error: "Missing transaction_id" }, { status: 400 });

      const data = await verifyFlutterwaveTransaction(transactionId);
      const txRef = String(data.tx_ref || "");
      const invoiceId = typeof data.meta?.invoice_id === "string" ? (data.meta.invoice_id as string) : "";
      const success = data.status === "successful" && String(data.currency || "NGN").toUpperCase() === "NGN";
      const amountNaira = Number(data.amount || 0);

      if (success && txRef && data.meta?.type === "plan") {
        await applyPlanPurchase(txRef, data);
        return NextResponse.json({ success, status: data.status, amount: amountNaira, kind: "plan" });
      }

      if (success && invoiceId && txRef && amountNaira > 0) {
        await applyInvoicePayment({ invoiceId, amount: amountNaira, gateway: "flutterwave", reference: txRef, gatewayResponse: data });
      }

      return NextResponse.json({ success, status: data.status, amount: amountNaira });
    }

    return NextResponse.json({ error: "Unsupported gateway" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Verification failed" }, { status: 500 });
  }
}
