import { NextResponse } from "next/server";

type PublicApiResult =
  | { ok: true }
  | { ok: false; response: NextResponse<{ error: string }> };

export function requirePublicApiAccess(req: Request): PublicApiResult {
  const configuredToken = (process.env.PUBLIC_API_TOKEN || "").trim();
  if (!configuredToken) {
    if (process.env.NODE_ENV === "production") {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Public API is disabled. Set PUBLIC_API_TOKEN to enable it." },
          { status: 403 }
        ),
      };
    }

    return { ok: true };
  }

  const url = new URL(req.url);
  const providedToken =
    req.headers.get("x-public-api-token") ||
    req.headers.get("x-api-token") ||
    url.searchParams.get("api_token");

  if (!providedToken || providedToken !== configuredToken) {
    return { ok: false, response: NextResponse.json({ error: "Invalid API token" }, { status: 401 }) };
  }

  return { ok: true };
}
