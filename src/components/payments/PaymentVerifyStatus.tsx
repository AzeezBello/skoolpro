"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Gateway = "paystack" | "flutterwave";

type VerifyResult = {
  success: boolean;
  status?: string;
  amount?: number;
  invoiceId?: string | null;
  kind?: string;
  error?: string;
};

function getGatewayQuery(gateway: Gateway, params: URLSearchParams) {
  if (gateway === "paystack") {
    const reference = params.get("reference") || params.get("trxref") || "";
    return reference ? `gateway=paystack&reference=${encodeURIComponent(reference)}` : null;
  }

  const transactionId = params.get("transaction_id") || "";
  return transactionId ? `gateway=flutterwave&transaction_id=${encodeURIComponent(transactionId)}` : null;
}

export function PaymentVerifyStatus({ gateway }: { gateway: Gateway }) {
  const [state, setState] = useState<"loading" | "success" | "failed" | "error">("loading");
  const [result, setResult] = useState<VerifyResult | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Flutterwave redirects here even when the payer cancels checkout.
    if (gateway === "flutterwave" && params.get("status") === "cancelled") {
      setState("failed");
      setResult({ success: false, status: "cancelled" });
      return;
    }

    const query = getGatewayQuery(gateway, params);
    if (!query) {
      setState("error");
      return;
    }

    fetch(`/api/payments/verify?${query}`)
      .then((res) => res.json())
      .then((data: VerifyResult) => {
        setResult(data);
        setState(data.success ? "success" : "failed");
      })
      .catch(() => setState("error"));
  }, [gateway]);

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      {state === "loading" && <p className="text-lg text-slate-500">Confirming your payment…</p>}

      {state === "success" && (
        <>
          <h1 className="text-3xl font-semibold text-primary">Payment successful</h1>
          <p className="text-slate-500">
            {result?.amount ? `NGN ${result.amount.toLocaleString()} received. ` : ""}
            {result?.kind === "plan" ? "Your subscription has been updated." : "Your invoice has been updated."}
          </p>
        </>
      )}

      {state === "failed" && (
        <>
          <h1 className="text-3xl font-semibold text-warning">Payment not confirmed</h1>
          <p className="text-slate-500">
            We couldn&apos;t confirm this payment as successful (status: {result?.status || "unknown"}). If you were
            charged, contact your school&apos;s admin with your payment reference.
          </p>
        </>
      )}

      {state === "error" && (
        <>
          <h1 className="text-3xl font-semibold text-destructive">Something went wrong</h1>
          <p className="text-slate-500">
            We couldn&apos;t verify this payment. If you were charged, contact your school&apos;s admin.
          </p>
        </>
      )}

      <Link
        href="/dashboard"
        className="mt-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
