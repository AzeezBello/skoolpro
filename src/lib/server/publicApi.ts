import crypto from "crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { getTenantColumn, type TenantContext } from "@/lib/server/tenant";
import { enforceRateLimit } from "@/lib/server/rateLimit";

type PublicApiResult =
  | { ok: true; tenant: TenantContext }
  | { ok: false; response: NextResponse<{ error: string }> };

function unauthorized(message = "Invalid API token") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function hashApiToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateApiToken() {
  return `skp_${crypto.randomBytes(24).toString("base64url")}`;
}

// Header only. Query-string tokens end up in access logs and referrers.
function getProvidedToken(req: Request) {
  const header = req.headers.get("x-public-api-token") || req.headers.get("x-api-token") || "";
  if (header.trim()) return header.trim();

  const auth = req.headers.get("authorization") || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();

  return "";
}

/**
 * Gates /api/public/*. Every request is scoped to exactly one school:
 *  - a per-school token minted in public.api_tokens (stored hashed), or
 *  - the legacy PUBLIC_API_TOKEN env value, accepted only while the database
 *    holds a single school (it is scoped to that school).
 */
export async function requirePublicApiAccess(req: Request): Promise<PublicApiResult> {
  const limited = enforceRateLimit(req, "public-api", 120, 60_000);
  if (limited) return { ok: false, response: limited as NextResponse<{ error: string }> };

  const providedToken = getProvidedToken(req);
  if (!providedToken) return { ok: false, response: unauthorized() };

  const column = getTenantColumn();

  const { data: tokenRow } = await supabaseAdmin
    .from("api_tokens")
    .select("id, school_id, expires_at, revoked_at")
    .eq("token_hash", hashApiToken(providedToken))
    .maybeSingle();

  if (tokenRow) {
    if (tokenRow.revoked_at) return { ok: false, response: unauthorized("API token revoked") };
    if (tokenRow.expires_at && new Date(tokenRow.expires_at).getTime() < Date.now()) {
      return { ok: false, response: unauthorized("API token expired") };
    }

    void supabaseAdmin.from("api_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", tokenRow.id);
    return { ok: true, tenant: { column, value: tokenRow.school_id as string } };
  }

  const configuredToken = (process.env.PUBLIC_API_TOKEN || "").trim();
  if (configuredToken) {
    const a = Buffer.from(providedToken);
    const b = Buffer.from(configuredToken);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      const { data: schools } = await supabaseAdmin.from("schools").select("id").limit(2);
      if (schools && schools.length === 1) {
        return { ok: true, tenant: { column, value: schools[0].id as string } };
      }
      return {
        ok: false,
        response: NextResponse.json(
          { error: "PUBLIC_API_TOKEN cannot be used with multiple schools; mint a per-school token" },
          { status: 403 }
        ),
      };
    }
  }

  return { ok: false, response: unauthorized() };
}
