// src/app/api/flutterwave/create/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_KEY!;
const FLW_SECRET = process.env.FLW_SECRET_KEY!;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

export async function POST(req: Request) {
  try {
    const { amount, email, invoice_id } = await req.json();
    if (!amount || !email || !invoice_id) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const body = {
      tx_ref: invoice_id,
      amount,
      currency: "NGN",
      redirect_url: `${BASE_URL}/payments/verify/flutterwave`,
      customer: { email },
      meta: { invoice_id },
    };

    const r = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FLW_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await r.json();
    if (!r.ok) {
      console.error("flutterwave create error", data);
      return NextResponse.json({ error: data }, { status: r.status });
    }

    // create pending payment record if not exists
    const existing = await supabase
      .from("payments")
      .select("*")
      .eq("gateway", "flutterwave")
      .eq("gateway_response->>tx_ref", invoice_id)
      .maybeSingle();

    if (!existing.data) {
      await supabase.from("payments").insert([
        {
          invoice_id,
          gateway: "flutterwave",
          amount,
          status: "pending",
          gateway_response: data.data,
        },
      ]);
    }

    return NextResponse.json({ link: data.data.link, meta: data.data });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || "Unexpected error" }, { status: 500 });
  }
}
