import { createClient } from "@supabase/supabase-js";

let cachedAdminClient: any = null;

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

export function getSupabaseAdmin() {
  if (cachedAdminClient) return cachedAdminClient;

  const url = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = getRequiredEnv("SUPABASE_SERVICE_KEY");
  cachedAdminClient = createClient(url, serviceKey);
  return cachedAdminClient;
}

export const supabaseAdmin = {
  from: (relation: string) => getSupabaseAdmin().from(relation),
  get auth() {
    return getSupabaseAdmin().auth;
  },
} as any;
