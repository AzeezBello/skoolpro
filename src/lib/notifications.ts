import { supabase } from "@/lib/supabaseClient";

export async function sendNotification({ title, message, recipient_id, role }: any) {
  const { error } = await supabase.from("notifications").insert([
    { title, message, recipient_id, role, is_read: false },
  ]);
  if (error) console.error("Notification error:", error);
}

export async function getUserNotifications(user_id: string) {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("recipient_id", user_id)
    .order("created_at", { ascending: false });
  return data || [];
}

export async function markNotificationAsRead(id: string) {
  await supabase.from("notifications").update({ is_read: true }).eq("id", id);
}
