import { supabaseAdmin } from "@/lib/supabaseServer";

export async function recordPlatformAudit(params: { adminId: string; action: string; schoolId?: string | null; details?: Record<string, unknown> }) {
  try {
    await supabaseAdmin.from("platform_audit_log").insert([
      { platform_admin_id: params.adminId, action: params.action, school_id: params.schoolId ?? null, details: params.details ?? {} },
    ]);
  } catch (error) {
    console.warn("platform audit failed", error);
  }
}
