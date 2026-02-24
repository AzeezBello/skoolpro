"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function MessagesPage() {
  const [user, setUser] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [receiver, setReceiver] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    fetchMessages();
  }, []);

  async function fetchMessages() {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: true });
    setMessages(data || []);
  }

  async function sendMessage() {
    if (!newMessage.trim() || !user || !receiver) return;
    await supabase.from("messages").insert([
      {
        sender_id: user.id,
        receiver_id: receiver,
        content: newMessage.trim(),
      },
    ]);
    setNewMessage("");
    fetchMessages();
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-900 p-6 text-white">
        <h1 className="mb-4 text-2xl font-semibold">Messages</h1>

        <div className="mb-4 rounded-lg bg-gray-800 p-4">
          <input
            type="text"
            placeholder="Receiver ID"
            value={receiver}
            onChange={(e) => setReceiver(e.target.value)}
            className="mb-3 w-full rounded bg-gray-700 p-2 text-sm"
          />
          <textarea
            placeholder="Type your message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="mb-3 w-full rounded bg-gray-700 p-2 text-sm"
          />
          <button onClick={sendMessage} className="rounded bg-green-500 px-4 py-2 hover:bg-green-600">
            Send
          </button>
        </div>

        <div className="space-y-2">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`w-fit max-w-xl rounded p-2 ${m.sender_id === user?.id ? "ml-auto bg-green-600" : "bg-gray-700"}`}
            >
              {m.content}
            </div>
          ))}
        </div>
      </div>
    </ProtectedRoute>
  );
}
