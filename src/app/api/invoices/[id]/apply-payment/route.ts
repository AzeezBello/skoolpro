import { NextResponse, type NextRequest } from "next/server";
import { requireRequestUser } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { applyTenantFilter } from "@/lib/server/tenant";
import { applyInvoicePayment } from "@/lib/server/payments";

const ALLOWED_METHODS = new Set(["cash", "bank", "pos", "cheque", "manual"]);

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireRequestUser(req, { roles: ["admin"] });
  if (!auth.ok) return auth.response;

  const { id: invoiceId } = await ctx.params;
  const body = await req.json().catch(() => null);
  const amount = Number(body?.amount);
  const rawMethod = typeof body?.method === "string" ? body.method.trim().toLowerCase() : "manual";
  const method = ALLOWED_METHODS.has(rawMethod) ? rawMethod : "manual";
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 500) : "";

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Enter a valid amount" }, { status: 400 });
  }

  // Tenant check happens here; the RPC itself trusts its caller.
  let invoiceQuery = supabaseAdmin.from("invoices").select("id").eq("id", invoiceId);
  invoiceQuery = applyTenantFilter(invoiceQuery, auth.ctx.tenant);
  const { data: invoice } = await invoiceQuery.maybeSingle();
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  try {
    const result = await applyInvoicePayment({
      invoiceId,
      amount,
      gateway: "manual",
      method,
      note,
      actorUserId: auth.ctx.userId,
      gatewayResponse: { recorded_by_email: auth.ctx.email },
    });

    return NextResponse.json({ ok: true, status: result.status, amount_paid: result.amount_paid, applied: result.applied });
  } catch (error: any) {
    const message = error?.message || "Could not record payment";
    const status = /exceeds|greater than zero|cancelled/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
