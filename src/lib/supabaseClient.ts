import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

if (!supabaseUrl) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL is required.");
}

if (!supabaseAnonKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY) is required.");
}

// Cookie-backed session (sb-<ref>-auth-token) so middleware and route
// handlers see the same session the browser client does, and refreshes
// propagate automatically. Replaces the hand-rolled sb-access-token cookie
// that expired after an hour and caused login/dashboard redirect loops.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
