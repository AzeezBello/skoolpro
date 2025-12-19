// src/app/api/flutterwave/webhook/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_KEY!;
const FLW_SECRET = process.env.FLW_SECRET_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

export async function POST(req: Request) {
  try {
    const raw = await req.text();
    const headerHash = req.headers.get("verif-hash") || ""; // common header; verify in your dashboard
    // compute hash
    const computed = crypto.createHmac("sha256", FLW_SECRET).update(raw).digest("hex");

    if (headerHash !== computed) {
      console.warn("Invalid Flutterwave signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(raw);

    // Example: event.event === "charge.completed" or event.data.status === "successful"
    const status = event?.data?.status || event?.status;
    const metaInvoice = event?.meta?.invoice_id || event?.data?.meta?.invoice_id || event?.tx_ref || null;

    if (status === "successful" || status === "completed") {
      const amount = event?.data?.amount || event?.amount || 0;
      const tx_ref = event?.tx_ref || event?.data?.tx_ref || metaInvoice;

      // idempotency check
      const existing = await supabase
        .from("payments")
        .select("*")
        .eq("gateway", "flutterwave")
        .eq("gateway_response->>tx_ref", tx_ref)
        .maybeSingle();

      if (existing.data && existing.data.status === "success") {
        return NextResponse.json({ ok: true });
      }

      // insert payment
      await supabase.from("payments").insert([
        {
          invoice_id: metaInvoice,
          gateway: "flutterwave",
          amount,
          status: "success",
          gateway_response: event,
        },
      ]);

      if (metaInvoice) {
        await supabase.from("invoices").update({ status: "paid" }).eq("id", metaInvoice);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("flutterwave webhook error", err);
    return NextResponse.json({ error: err.message || "Webhook error" }, { status: 500 });
  }
}
