"use client";

import { supabase } from "@/lib/supabaseClient";

type AuthFetchInit = RequestInit & {
  allowUnauthenticated?: boolean;
};

export async function authFetch(input: RequestInfo | URL, init: AuthFetchInit = {}) {
  const { allowUnauthenticated, headers: incomingHeaders, ...rest } = init;

  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  const accessToken = data.session?.access_token ?? null;
  if (!accessToken && !allowUnauthenticated) {
    throw new Error("No active session");
  }

  const headers = new Headers(incomingHeaders);
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  return fetch(input, { ...rest, headers });
}
