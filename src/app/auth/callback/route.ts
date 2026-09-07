import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// PKCE callback for email confirmation, magic links (impersonation) and
// password recovery. Exchanges the `code` for a cookie session, then sends
// the user on to `next` (same-origin paths only).
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const rawNext = url.searchParams.get("next") || "/dashboard";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

  const response = NextResponse.redirect(new URL(next, url.origin));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
  if (!code || !supabaseUrl || !anonKey) {
    return NextResponse.redirect(new URL(`/login?error=auth_callback`, url.origin));
  }

  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (cookiesToSet) => cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin));
  }

  return response;
}
