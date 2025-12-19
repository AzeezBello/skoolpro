import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_KEY!;
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

export async function POST(req: Request) {
  const raw = await req.text();
  const headerSignature = (req.headers.get("x-paystack-signature") || "").toString();
  const hash = crypto.createHmac("sha512", PAYSTACK_SECRET).update(raw).digest("hex");

  if (hash !== headerSignature) {
    console.warn("Invalid Paystack signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(raw);

  try {
    if (event.event === "charge.success" || event.event === "transaction.success") {
      const data = event.data;
      const { reference, amount, metadata } = data;
      const invoice_id = metadata?.invoice_id || null;

      const existing = await supabase
        .from("payments")
        .select("*")
        .eq("gateway", "paystack")
        .eq("gateway_response->>reference", reference)
        .maybeSingle();

      if (existing.data && existing.data.status === "success") {
        return NextResponse.json({ ok: true });
      }

      await supabase.from("payments").insert([
        {
          invoice_id,
          gateway: "paystack",
          amount: amount,
          status: "success",
          gateway_response: data,
        },
      ]);

      if (invoice_id) {
        await supabase.from("invoices").update({ status: "paid" }).eq("id", invoice_id);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("paystack webhook error", err);
    return NextResponse.json({ error: err.message || "Webhook processing error" }, { status: 500 });
  }
}
