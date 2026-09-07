"use client";

// Session cookies are now managed by @supabase/ssr (see lib/supabaseClient).
// This component used to mirror the access token into a hand-rolled cookie;
// it is kept as a no-op so existing imports keep working.
export function AuthSessionSync() {
  return null;
}
