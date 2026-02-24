"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { authFetch } from "@/lib/client/authFetch";

export default function InvoiceRow({ invoice }: any) {
  const [sending, setSending] = useState(false);

  const handleSendReminder = async () => {
    setSending(true);

    try {
      const res = await authFetch("/api/invoices/send-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: invoice.id }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(`Reminder sent to ${invoice.students?.parent_email || invoice.students?.email}`);
      } else {
        toast.error(data.error || "Failed to send reminder");
      }
    } catch {
      toast.error("Failed to send reminder");
    } finally {
      setSending(false);
    }
  };

  return (
    <tr className="border-b hover:bg-gray-50">
      <td className="p-3 font-medium">{invoice.reference}</td>
      <td className="p-3">{invoice.students?.full_name}</td>
      <td className="p-3">NGN {invoice.amount.toLocaleString()}</td>
      <td className="p-3 capitalize">{invoice.status}</td>
      <td className="space-x-2 p-3 text-right">
        <a href={`/api/invoices/${invoice.id}/receipt`} target="_blank" className="text-blue-600 hover:underline" rel="noreferrer">
          Receipt
        </a>

        <button
          onClick={handleSendReminder}
          disabled={sending}
          className="rounded bg-yellow-500 px-3 py-1 text-sm text-white hover:bg-yellow-600 disabled:opacity-50"
        >
          {sending ? "Sending..." : "Send Reminder"}
        </button>
      </td>
    </tr>
  );
}
