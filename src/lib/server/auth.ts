import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { resolveTenantContext, type TenantContext } from "@/lib/server/tenant";

export type RequestUserContext = {
  accessToken: string;
  userId: string;
  email: string | null;
  role: string | null;
  profile: Record<string, unknown> | null;
  tenant: TenantContext | null;
  schoolStatus: string | null;
};

type RequireUserOptions = {
  roles?: string[];
  /** Routes that legitimately serve users with no school yet (e.g. onboarding). */
  allowMissingTenant?: boolean;
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

function parseCookieHeader(cookieHeader: string | null): Array<{ name: string; value: string }> {
  if (!cookieHeader) return [];

  return cookieHeader
    .split(";")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => {
      const eq = segment.indexOf("=");
      if (eq === -1) return { name: segment, value: "" };
      const name = segment.slice(0, eq);
      const raw = segment.slice(eq + 1);
      let value = raw;
      try {
        value = decodeURIComponent(raw);
      } catch {
        value = raw;
      }
      return { name, value };
    });
}

// Reads the @supabase/ssr cookie session (sb-<ref>-auth-token, possibly
// chunked) without ever writing cookies — route handlers can't refresh here,
// that's the middleware's job.
async function getAccessTokenFromCookies(req: Request): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
  if (!url || !anonKey) return null;

  const cookies = parseCookieHeader(req.headers.get("cookie"));
  if (cookies.length === 0) return null;

  const client = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookies,
      setAll: () => {},
    },
  });

  const { data } = await client.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function getAccessTokenFromRequest(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim();
  }

  return getAccessTokenFromCookies(req);
}

export async function getRequestUserContext(req: Request): Promise<RequestUserContext | null> {
  const accessToken = await getAccessTokenFromRequest(req);
  if (!accessToken) return null;

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
  if (authError || !authData.user) return null;

  const userId = authData.user.id;
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("*, schools:school_id(status)")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    console.warn("profile lookup failed", profileError);
  }

  const profileRecord = (profile ?? null) as (Record<string, unknown> & { schools?: { status?: string } | null }) | null;
  const schoolStatus = typeof profileRecord?.schools?.status === "string" ? profileRecord.schools.status : null;

  if (profileRecord) delete (profileRecord as Record<string, unknown>).schools;

  return {
    accessToken,
    userId,
    email: authData.user.email ?? null,
    role: typeof profileRecord?.role === "string" ? profileRecord.role : null,
    profile: profileRecord,
    tenant: resolveTenantContext(profileRecord),
    schoolStatus,
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

  if (!options.allowMissingTenant) {
    if (!ctx.tenant) {
      return { ok: false, response: forbidden("Your account is not attached to a school yet") };
    }
    if (ctx.schoolStatus && ctx.schoolStatus !== "active") {
      return { ok: false, response: forbidden("This school is currently suspended") };
    }
  }

  return { ok: true, ctx };
}

/** The students.id this user may act on as a student (null for staff). */
export function getOwnStudentId(ctx: RequestUserContext): string | null {
  if (ctx.role !== "student") return null;
  const related = ctx.profile?.related_id;
  return typeof related === "string" && related ? related : ctx.userId;
}
