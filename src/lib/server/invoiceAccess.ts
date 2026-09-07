import { supabaseAdmin } from "@/lib/supabaseServer";
import { applyTenantFilter } from "@/lib/server/tenant";
import { getOwnStudentId, type RequestUserContext } from "@/lib/server/auth";

export type PayableInvoice = {
  id: string;
  reference: string;
  amount: number | null;
  total_amount: number | null;
  amount_paid: number | null;
  student_id: string;
  status: string;
  school_id: string | null;
  parent_email: string | null;
};

/**
 * Loads an invoice the caller is allowed to pay: staff may pay any invoice in
 * their school, a student only their own. Returns null when not found or not
 * permitted (callers respond 404 either way to avoid enumeration).
 */
export async function loadPayableInvoice(ctx: RequestUserContext, invoiceId: string): Promise<PayableInvoice | null> {
  let query = supabaseAdmin
    .from("invoices")
    .select("id, reference, amount, total_amount, amount_paid, student_id, status, school_id, parent_email")
    .eq("id", invoiceId);
  query = applyTenantFilter(query, ctx.tenant);

  const ownStudentId = getOwnStudentId(ctx);
  if (ownStudentId) query = query.eq("student_id", ownStudentId);

  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;
  return data as PayableInvoice;
}

export function invoiceBalance(invoice: { amount: number | null; total_amount: number | null; amount_paid: number | null }) {
  const total = Number(invoice.total_amount ?? invoice.amount ?? 0);
  const paid = Number(invoice.amount_paid ?? 0);
  return Math.max(total - paid, 0);
}

/** Student ids a non-staff caller may see: own record, or linked children. */
export async function visibleStudentIds(ctx: RequestUserContext): Promise<string[] | null> {
  if (ctx.role === "admin" || ctx.role === "teacher") return null;
  const own = getOwnStudentId(ctx);
  if (own) return [own];
  if (ctx.role === "parent") {
    const { data } = await supabaseAdmin.from("parent_students").select("student_id").eq("parent_id", ctx.userId);
    return (data || []).map((r: any) => r.student_id as string);
  }
  return [];
}

