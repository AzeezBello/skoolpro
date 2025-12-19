// src/app/api/paystack/initialize/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_KEY!;
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY!;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, amount, invoice_id } = body; // amount expected in smallest unit (kobo)

    if (!email || !amount || !invoice_id) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // initialize transaction with Paystack
    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount,
        metadata: { invoice_id },
        callback_url: `${BASE_URL}/payments/verify/paystack`,
      }),
    });

    const paystackData = await paystackRes.json();
    if (!paystackRes.ok) {
      console.error("paystack init error", paystackData);
      return NextResponse.json({ error: paystackData }, { status: paystackRes.status });
    }

    // create a pending payment record (idempotent check on metadata.invoice_id)
    const reference = paystackData.data.reference;
    const existing = await supabase
      .from("payments")
      .select("*")
      .eq("gateway", "paystack")
      .eq("gateway_response->>reference", reference)
      .maybeSingle();

    if (!existing.data) {
      await supabase.from("payments").insert([
        {
          invoice_id,
          gateway: "paystack",
          amount,
          status: "pending",
          gateway_response: paystackData.data,
        },
      ]);
    }

    return NextResponse.json({ authorization_url: paystackData.data.authorization_url, reference });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || "Unexpected error" }, { status: 500 });
  }
}
