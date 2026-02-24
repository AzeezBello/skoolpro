import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { isTenancyStrict, resolveTenantContext, type TenantContext } from "@/lib/server/tenant";

export type RequestUserContext = {
  accessToken: string;
  userId: string;
  email: string | null;
  role: string | null;
  profile: Record<string, unknown> | null;
  tenant: TenantContext | null;
};

type RequireUserOptions = {
  roles?: string[];
  requireTenant?: boolean;
};

type RequireUserResult =
  | { ok: true; ctx: RequestUserContext }
  | { ok: false; response: NextResponse<{ error: string }> };

function unauthorized(message = "Unauthorized") {
  return NextResponse.json({ error: message }, { status: 401 });
}

function forbidden(message = "Forbidden") {
  return NextResponse.json({ error: message }, { status: 403 });
}

function parseCookieValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseCookieHeader(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};

  return cookieHeader.split(";").reduce<Record<string, string>>((acc, segment) => {
    const [rawKey, ...rest] = segment.trim().split("=");
    if (!rawKey || rest.length === 0) return acc;
    acc[rawKey] = parseCookieValue(rest.join("="));
    return acc;
  }, {});
}

function parseSupabaseAuthCookie(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (!trimmed.startsWith("[")) {
    return trimmed;
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed) && typeof parsed[0] === "string") return parsed[0];
  } catch {
    return null;
  }

  return null;
}

export function getAccessTokenFromRequest(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim();
  }

  const cookies = parseCookieHeader(req.headers.get("cookie"));
  const candidates = [
    cookies["sb-access-token"],
    cookies["sb-access-token.0"],
    cookies["supabase-auth-token"],
    cookies["sb-auth-token"],
  ];

  for (const candidate of candidates) {
    const token = parseSupabaseAuthCookie(candidate);
    if (token) return token;
  }

  return null;
}

export async function getRequestUserContext(req: Request): Promise<RequestUserContext | null> {
  const accessToken = getAccessTokenFromRequest(req);
  if (!accessToken) return null;

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
  if (authError || !authData.user) return null;

  const userId = authData.user.id;
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    console.warn("profile lookup failed", profileError);
  }

  const profileRecord = (profile ?? null) as Record<string, unknown> | null;

  return {
    accessToken,
    userId,
    email: authData.user.email ?? null,
    role: typeof profileRecord?.role === "string" ? profileRecord.role : null,
    profile: profileRecord,
    tenant: resolveTenantContext(profileRecord),
  };
}

export async function requireRequestUser(req: Request, options: RequireUserOptions = {}): Promise<RequireUserResult> {
  const ctx = await getRequestUserContext(req);
  if (!ctx) return { ok: false, response: unauthorized() };

  if (options.roles?.length) {
    if (!ctx.role || !options.roles.includes(ctx.role)) {
      return { ok: false, response: forbidden() };
    }
  }

  const requiresTenant = options.requireTenant || isTenancyStrict();
  if (requiresTenant && !ctx.tenant) {
    return { ok: false, response: forbidden("Tenant context required") };
  }

  return { ok: true, ctx };
}
