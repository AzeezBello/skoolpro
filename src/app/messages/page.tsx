import { redirect } from "next/navigation";

// Messaging now lives inside the dashboard shell.
export default function LegacyMessagesRedirect() {
  redirect("/dashboard/messages");
}
