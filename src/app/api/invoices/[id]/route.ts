import { NextResponse, type NextRequest } from "next/server";
import { requireRequestUser } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { applyTenantFilter } from "@/lib/server/tenant";
import { recordAudit } from "@/lib/server/audit";

// Admin edits: cancel an unpaid invoice, change the due date, or apply a
// discount/waiver to the outstanding balance.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireRequestUser(req, { roles: ["admin"] });
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const action = typeof body?.action === "string" ? body.action : "";

  let query = supabaseAdmin.from("invoices").select("id, reference, status, total_amount, amount, amount_paid, payment_history").eq("id", id);
  query = applyTenantFilter(query, auth.ctx.tenant);
  const { data: invoice } = await query.maybeSingle();
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const total = Number(invoice.total_amount ?? invoice.amount ?? 0);
  const paid = Number(invoice.amount_paid ?? 0);
  const history = Array.isArray(invoice.payment_history) ? invoice.payment_history : [];

  if (action === "cancel") {
    if (paid > 0) return NextResponse.json({ error: "An invoice with payments cannot be cancelled" }, { status: 400 });
    const { error } = await supabaseAdmin.from("invoices").update({ status: "cancelled" }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await recordAudit({ schoolId: auth.ctx.tenant?.value, actorId: auth.ctx.userId, actorEmail: auth.ctx.email, action: "invoice.cancelled", entityType: "invoice", entityId: id, details: { reference: invoice.reference } });
    return NextResponse.json({ ok: true });
  }

  if (action === "due_date") {
    const raw = typeof body?.due_date === "string" ? body.due_date : "";
    const d = raw ? new Date(raw) : null;
    if (raw && Number.isNaN(d?.getTime())) return NextResponse.json({ error: "Invalid due_date" }, { status: 400 });
    const { error } = await supabaseAdmin.from("invoices").update({ due_date: d ? d.toISOString().slice(0, 10) : null }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "discount") {
    const amount = Number(body?.amount);
    const note = typeof body?.note === "string" ? body.note.trim().slice(0, 300) : "";
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "Enter a valid discount" }, { status: 400 });
    if (invoice.status === "cancelled" || invoice.status === "paid") return NextResponse.json({ error: "Invoice is closed" }, { status: 400 });
    const newTotal = Math.max(total - amount, paid);
    const entry = { type: "discount", amount: total - newTotal, note, date: new Date().toISOString(), by: auth.ctx.email || auth.ctx.userId };
    const { error } = await supabaseAdmin
      .from("invoices")
      .update({ total_amount: newTotal, amount: newTotal, payment_history: [...history, entry] })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await recordAudit({ schoolId: auth.ctx.tenant?.value, actorId: auth.ctx.userId, actorEmail: auth.ctx.email, action: "invoice.discounted", entityType: "invoice", entityId: id, details: { reference: invoice.reference, discount: total - newTotal, note } });
    return NextResponse.json({ ok: true, total_amount: newTotal });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
