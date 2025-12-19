// src/app/api/invoices/create/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { student_id, fee_item_id, amount, due_date } = body;

    if (!student_id || !fee_item_id || !amount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // create unique reference
    const reference = `INV-${randomUUID()}`;

    const { data, error } = await supabase
      .from("invoices")
      .insert([
        {
          student_id,
          fee_item_id,
          amount,
          total_amount: amount,
          due_date: due_date || null,
          reference,
          status: "pending",
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("insert invoice error", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ invoice: data }, { status: 201 });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || "Unexpected error" }, { status: 500 });
  }
}
