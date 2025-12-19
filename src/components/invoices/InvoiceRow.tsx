"use client"

import { useState } from "react"
import toast from "react-hot-toast"

export default function InvoiceRow({ invoice }: any) {
  const [sending, setSending] = useState(false)

  const handleSendReminder = async () => {
    setSending(true)
    const res = await fetch("/api/invoices/send-reminder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId: invoice.id }),
    })
    const data = await res.json()
    setSending(false)

    if (res.ok) {
      toast.success(`Reminder sent to ${invoice.students?.parent_email || invoice.students?.email}`)
    } else {
      toast.error(data.error || "Failed to send reminder")
    }
  }

  return (
    <tr className="border-b hover:bg-gray-50">
      <td className="p-3 font-medium">{invoice.reference}</td>
      <td className="p-3">{invoice.students?.full_name}</td>
      <td className="p-3">₦{invoice.amount.toLocaleString()}</td>
      <td className="p-3 capitalize">{invoice.status}</td>
      <td className="p-3 text-right space-x-2">
        <a
          href={`/api/invoices/${invoice.id}/receipt`}
          target="_blank"
          className="text-blue-600 hover:underline"
        >
          Receipt
        </a>

        <button
          onClick={handleSendReminder}
          disabled={sending}
          className="text-sm bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600 disabled:opacity-50"
        >
          {sending ? "Sending..." : "Send Reminder"}
        </button>
      </td>
    </tr>
  )
}
