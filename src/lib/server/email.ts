import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabaseServer";

const resendApiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.FROM_EMAIL;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

export function isEmailConfigured() {
  return Boolean(resend && fromEmail);
}

export function getAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/$/, "");
}

type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
  template?: string;
  schoolId?: string | null;
  relatedType?: string;
  relatedId?: string | null;
  sentBy?: string | null;
};

// Every outbound email is written to email_log first, then updated with the
// provider result, so a failed send is visible to the school admin instead
// of vanishing. Throws on failure so callers can surface the error.
export async function sendEmail(params: SendEmailParams): Promise<{ id: string | null }> {
  const { to, subject, html, template, schoolId, relatedType, relatedId, sentBy } = params;

  const { data: logRow } = await supabaseAdmin
    .from("email_log")
    .insert([
      {
        school_id: schoolId ?? null,
        to_email: to,
        subject,
        template: template ?? null,
        related_type: relatedType ?? null,
        related_id: relatedId ?? null,
        sent_by: sentBy ?? null,
        status: "queued",
      },
    ])
    .select("id")
    .maybeSingle();

  const logId = logRow?.id as string | undefined;

  if (!resend || !fromEmail) {
    if (logId) {
      await supabaseAdmin
        .from("email_log")
        .update({ status: "failed", error: "Email provider is not configured" })
        .eq("id", logId);
    }
    throw new Error("Email provider is not configured");
  }

  try {
    const result: any = await resend.emails.send({ from: fromEmail, to, subject, html });
    const providerId = result?.id || result?.data?.id || null;
    if (logId) {
      await supabaseAdmin
        .from("email_log")
        .update({ status: "sent", provider_id: providerId, sent_at: new Date().toISOString() })
        .eq("id", logId);
    }
    return { id: providerId };
  } catch (error: any) {
    if (logId) {
      await supabaseAdmin
        .from("email_log")
        .update({ status: "failed", error: error?.message || "send failed" })
        .eq("id", logId);
    }
    throw error;
  }
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}
