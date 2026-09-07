import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

// Fallback for hosts without pg_cron: hit this daily from Vercel Cron or any
// scheduler with `Authorization: Bearer $CRON_SECRET`.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [{ data, error }, { data: expired, error: expireError }] = await Promise.all([
    supabaseAdmin.rpc("mark_overdue_invoices"),
    supabaseAdmin.rpc("expire_plans"),
  ]);
  if (error || expireError) return NextResponse.json({ error: error?.message || expireError?.message }, { status: 500 });

  return NextResponse.json({ ok: true, overdue_marked: data ?? 0, plans_expired: expired ?? 0 });
}
