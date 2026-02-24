import { NextResponse, type NextRequest } from "next/server";
import { requireRequestUser } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { applyTenantFilter, withTenantPayload } from "@/lib/server/tenant";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireRequestUser(req, { roles: ["admin"] });
  if (!auth.ok) return auth.response;

  const { id: invoiceId } = await ctx.params;
  const body = await req.json().catch(() => null);
  const amount = Number(body?.amount || 0);
  const method = typeof body?.method === "string" && body.method.trim() ? body.method.trim() : "manual";
  const note = typeof body?.note === "string" ? body.note.trim() : "";

  if (amount <= 0) {
    return NextResponse.json({ error: "Enter a valid amount" }, { status: 400 });
  }

  let invoiceQuery = supabaseAdmin
    .from("invoices")
    .select("id, reference, total_amount, amount, amount_paid, payment_history")
    .eq("id", invoiceId);
  invoiceQuery = applyTenantFilter(invoiceQuery, auth.ctx.tenant);

  const { data: invoice, error: invoiceError } = await invoiceQuery.maybeSingle();
  if (invoiceError || !invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const prevPaid = Number(invoice.amount_paid || 0);
  const total = Number(invoice.total_amount || invoice.amount || 0);
  if (prevPaid + amount > total) {
    return NextResponse.json({ error: "Amount exceeds balance" }, { status: 400 });
  }

  const newPaid = prevPaid + amount;
  const historyEntry = {
    amount,
    date: new Date().toISOString(),
    by: auth.ctx.email || auth.ctx.userId,
    method,
    note,
  };

  const history = Array.isArray(invoice.payment_history)
    ? [...(invoice.payment_history as unknown[]), historyEntry]
    : [historyEntry];
  const status = newPaid >= total ? "paid" : "partial";

  let updateQuery = supabaseAdmin
    .from("invoices")
    .update({ amount_paid: newPaid, payment_history: history, status })
    .eq("id", invoiceId);
  updateQuery = applyTenantFilter(updateQuery, auth.ctx.tenant);

  const { error: updateError } = await updateQuery;
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const paymentPayload = withTenantPayload(
    {
      invoice_id: invoiceId,
      gateway: "manual",
      amount,
      status: "success",
      gateway_response: { method, note, recorded_by: auth.ctx.userId },
    },
    auth.ctx.tenant
  );

  const { error: paymentError } = await supabaseAdmin.from("payments").insert([paymentPayload]);
  if (paymentError) {
    return NextResponse.json({ error: paymentError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status, amount_paid: newPaid });
}
