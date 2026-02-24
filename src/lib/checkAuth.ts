import { supabase } from "./supabaseClient";

export async function getUserSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}
