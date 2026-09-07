import { supabaseAdmin } from "@/lib/supabaseServer";

// Shared by the Paystack webhook and verify route: a transaction whose
// metadata carries type=plan is a subscription purchase, not an invoice.
export async function applyPlanPurchase(reference: string, gatewayResponse: unknown) {
  const { data, error } = await supabaseAdmin.rpc("apply_plan_payment", { p_reference: reference, p_gateway_response: gatewayResponse ?? {} });
  if (error) throw new Error(error.message);
  return data as { applied: boolean; reason?: string; school_id?: string; plan_id?: string };
}
