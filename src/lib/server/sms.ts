// Provider-agnostic SMS. Termii is the default (common in Nigeria); Twilio
// is supported when its env vars are present instead. Unconfigured = no-op
// that reports `skipped` so callers can fall back to email silently.
import { supabaseAdmin } from "@/lib/supabaseServer";

type SendSmsParams = { to: string; message: string; schoolId?: string | null; relatedType?: string; relatedId?: string | null; sentBy?: string | null };
type SendSmsResult = { ok: boolean; skipped?: boolean; providerId?: string | null; error?: string };

export function isSmsConfigured() {
  return Boolean(process.env.TERMII_API_KEY || (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM));
}

function normalizePhone(raw: string) {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("0") && digits.length === 11) return `+234${digits.slice(1)}`;
  if (digits.startsWith("234")) return `+${digits}`;
  return `+${digits}`;
}

export async function sendSms(params: SendSmsParams): Promise<SendSmsResult> {
  const to = normalizePhone(params.to);
  if (!isSmsConfigured()) return { ok: false, skipped: true };

  const { data: logRow } = await supabaseAdmin
    .from("sms_log")
    .insert([{ school_id: params.schoolId ?? null, to_phone: to, message: params.message, related_type: params.relatedType ?? null, related_id: params.relatedId ?? null, sent_by: params.sentBy ?? null, status: "queued" }])
    .select("id")
    .maybeSingle();
  const logId = logRow?.id as string | undefined;

  try {
    let providerId: string | null = null;

    if (process.env.TERMII_API_KEY) {
      const res = await fetch("https://api.ng.termii.com/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: process.env.TERMII_API_KEY,
          to: to.replace(/^\+/, ""),
          from: process.env.TERMII_SENDER_ID || "SkoolPro",
          sms: params.message,
          type: "plain",
          channel: process.env.TERMII_CHANNEL || "generic",
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || (json.code && json.code !== "ok")) throw new Error(json.message || `Termii error ${res.status}`);
      providerId = json.message_id || null;
    } else {
      const sid = process.env.TWILIO_ACCOUNT_SID!;
      const token = process.env.TWILIO_AUTH_TOKEN!;
      const body = new URLSearchParams({ To: to, From: process.env.TWILIO_FROM!, Body: params.message });
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || `Twilio error ${res.status}`);
      providerId = json.sid || null;
    }

    if (logId) await supabaseAdmin.from("sms_log").update({ status: "sent", provider_id: providerId, sent_at: new Date().toISOString() }).eq("id", logId);
    return { ok: true, providerId };
  } catch (error: any) {
    if (logId) await supabaseAdmin.from("sms_log").update({ status: "failed", error: error?.message || "send failed" }).eq("id", logId);
    return { ok: false, error: error?.message || "SMS failed" };
  }
}
