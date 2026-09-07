import { supabaseAdmin } from "@/lib/supabaseServer";

export type PaymentGateway = "paystack" | "flutterwave" | "manual";

export type ApplyPaymentResult = {
  invoice_id: string;
  duplicate: boolean;
  applied: number;
  received: number;
  amount_paid: number;
  status: string;
  payment_id: string | null;
};

// Everything that credits an invoice goes through the apply_invoice_payment
// Postgres function (see migration 20260907_000001): it locks the invoice,
// dedupes on gateway reference, and writes invoice + payments row in one
// transaction. Callers never compute balances in JS anymore.
export async function applyInvoicePayment(params: {
  invoiceId: string;
  amount: number;
  gateway: PaymentGateway;
  reference?: string | null;
  method?: string | null;
  note?: string | null;
  actorUserId?: string | null;
  gatewayResponse?: unknown;
}): Promise<ApplyPaymentResult> {
  const { data, error } = await supabaseAdmin.rpc("apply_invoice_payment", {
    p_invoice_id: params.invoiceId,
    p_amount: params.amount,
    p_gateway: params.gateway,
    p_reference: params.reference ?? null,
    p_method: params.method ?? null,
    p_note: params.note ?? null,
    p_actor: params.actorUserId ?? null,
    p_gateway_response: params.gatewayResponse ?? {},
  });

  if (error) {
    throw new Error(error.message || "Could not apply payment");
  }

  return data as ApplyPaymentResult;
}

// Called at checkout-initialisation time so the reference exists before the
// gateway calls back. Uses the unique (gateway, reference) index as the guard.
export async function recordPendingGatewayPayment(params: {
  gateway: "paystack" | "flutterwave";
  referenceField: "reference" | "tx_ref";
  reference: string;
  invoiceId: string;
  amount: number;
  schoolId: string | null;
  gatewayResponse: Record<string, unknown>;
}) {
  const { gateway, referenceField, reference, invoiceId, amount, schoolId, gatewayResponse } = params;
  const payload = {
    invoice_id: invoiceId,
    gateway,
    amount,
    status: "pending",
    school_id: schoolId,
    gateway_response: { ...gatewayResponse, [referenceField]: reference },
  };

  const { error } = await supabaseAdmin.from("payments").insert([payload]);
  if (error && error.code === "23505") {
    await supabaseAdmin
      .from("payments")
      .update({ invoice_id: invoiceId, amount, gateway_response: payload.gateway_response })
      .eq("gateway", gateway)
      .eq(`gateway_response->>${referenceField}`, reference)
      .neq("status", "success");
    return;
  }
  if (error) throw new Error(error.message);
}

export function normalizeRequestedAmount(rawAmount: unknown, balance: number, unit?: string) {
  const parsed = Number(rawAmount);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;

  if (unit === "kobo") return parsed / 100;
  if (unit === "naira") return parsed;

  if (parsed > balance * 10) return parsed / 100;
  return parsed;
}

export async function verifyPaystackTransaction(reference: string) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) throw new Error("PAYSTACK_SECRET_KEY is required.");

  const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const json = await res.json();
  if (!res.ok || !json?.data) {
    throw new Error(json?.message || "Paystack verification failed");
  }
  return json.data as {
    status: string;
    amount: number;
    currency?: string;
    reference: string;
    metadata?: Record<string, unknown>;
  };
}

export async function verifyFlutterwaveTransaction(transactionId: string) {
  const secret = process.env.FLW_SECRET_KEY;
  if (!secret) throw new Error("FLW_SECRET_KEY is required.");

  const res = await fetch(`https://api.flutterwave.com/v3/transactions/${encodeURIComponent(transactionId)}/verify`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const json = await res.json();
  if (!res.ok || !json?.data) {
    throw new Error(json?.message || "Flutterwave verification failed");
  }
  return json.data as {
    id?: number;
    status: string;
    amount: number;
    currency?: string;
    tx_ref: string;
    meta?: Record<string, unknown>;
  };
}
