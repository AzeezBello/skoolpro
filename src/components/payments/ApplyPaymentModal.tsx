"use client";

import { useState } from "react";
import toast from "react-hot-toast";

export default function ApplyPaymentModal({ invoice, onClose, onSuccess }: any) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [method, setMethod] = useState("manual");

  const handleSubmit = async () => {
    const numericAmount = parseFloat(amount);
    const balance = (invoice.total_amount || invoice.amount) - (invoice.amount_paid || 0);

    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      toast.error("Enter a valid payment amount.");
      return;
    }
    if (numericAmount > balance) {
      toast.error(`Amount exceeds remaining balance (₦${balance.toLocaleString()})`);
      return;
    }

    setLoading(true);
    const res = await fetch(`/api/invoices/${invoice.id}/apply-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: numericAmount, method }),
    });
    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      toast.success("Payment recorded successfully.");
      onSuccess();
      onClose?.();
    } else {
      toast.error(data.error || "Failed to record payment.");
    }
  };

  return (
    <div className="w-[400px] rounded-md bg-white p-6 text-gray-900">
      <h2 className="mb-4 text-xl font-semibold">Apply Partial Payment</h2>
      <p className="mb-2 text-sm text-gray-600">
        Remaining balance: <b>₦{(invoice.total_amount - invoice.amount_paid).toLocaleString()}</b>
      </p>

      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Enter amount"
        className="mb-3 w-full rounded border px-3 py-2"
      />

      <select
        value={method}
        onChange={(e) => setMethod(e.target.value)}
        className="mb-4 w-full rounded border px-3 py-2 text-sm"
      >
        <option value="manual">Manual/Other</option>
        <option value="cash">Cash</option>
        <option value="bank">Bank Transfer</option>
        <option value="pos">POS</option>
      </select>

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Processing..." : "Submit"}
      </button>
    </div>
  );
}
