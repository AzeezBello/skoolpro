import { supabaseAdmin } from "@/lib/supabaseServer";

type AuditParams = {
  schoolId: string | null | undefined;
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  entityType?: string;
  entityId?: string | null;
  details?: Record<string, unknown>;
};

// Fire-and-forget school audit trail. Never throws: an audit failure must not
// break the action it's describing, but it is logged server-side.
export async function recordAudit(params: AuditParams) {
  try {
    const { error } = await supabaseAdmin.from("audit_log").insert([
      {
        school_id: params.schoolId ?? null,
        actor_id: params.actorId ?? null,
        actor_email: params.actorEmail ?? null,
        action: params.action,
        entity_type: params.entityType ?? null,
        entity_id: params.entityId ?? null,
        details: params.details ?? {},
      },
    ]);
    if (error) console.warn("audit insert failed", error.message);
  } catch (error) {
    console.warn("audit insert threw", error);
  }
}
