"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

const ACCESS_TOKEN_COOKIE = "sb-access-token";

function decodeJwtExpiry(token: string) {
  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (typeof payload.exp !== "number") return null;
    return payload.exp;
  } catch {
    return null;
  }
}

function writeAccessTokenCookie(token: string | null) {
  const secure = window.location.protocol === "https:" ? "; secure" : "";

  if (!token) {
    document.cookie = `${ACCESS_TOKEN_COOKIE}=; path=/; max-age=0; samesite=lax${secure}`;
    return;
  }

  const exp = decodeJwtExpiry(token);
  const now = Math.floor(Date.now() / 1000);
  const ttl = exp ? Math.max(exp - now, 0) : 3600;
  document.cookie = `${ACCESS_TOKEN_COOKIE}=${encodeURIComponent(
    token
  )}; path=/; max-age=${ttl}; samesite=lax${secure}`;
}

export function AuthSessionSync() {
  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      writeAccessTokenCookie(data.session?.access_token ?? null);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      writeAccessTokenCookie(session?.access_token ?? null);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return null;
}
