"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import PaymentHistory from "@/components/invoices/PaymentHistory";
import { authFetch } from "@/lib/client/authFetch";

type Invoice = {
  id: string;
  reference: string;
  total_amount?: number;
  amount?: number;
  amount_paid?: number;
  balance?: number;
  status: string;
  student_full_name?: string;
  parent_name?: string;
  parent_email?: string;
  due_date?: string;
  payment_history?: any[];
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [partialAmount, setPartialAmount] = useState<number>(0);
  const [method, setMethod] = useState<string>("cash");
  const [note, setNote] = useState<string>("");

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [query, setQuery] = useState<string>("");
  const [debouncedQuery, setDebouncedQuery] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [query]);

  useEffect(() => {
    void fetchInvoices();
  }, [page, pageSize, statusFilter, debouncedQuery]);

  async function fetchInvoices() {
    setLoading(true);

    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });

      if (statusFilter !== "all") params.set("status", statusFilter);
      if (debouncedQuery) params.set("query", debouncedQuery);

      const res = await authFetch(`/api/invoices?${params.toString()}`);
      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error || "Failed to load invoices");
        return;
      }

      setInvoices(json.data || []);
      setTotal(Number(json.meta?.total || 0));
      setTotalPages(Number(json.meta?.totalPages || 0));
    } catch {
      toast.error("Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }

  function openPartial(inv: Invoice) {
    setSelected(inv);
    const balance = getInvoiceBalance(inv);
    setPartialAmount(balance);
    setMethod("cash");
    setNote("");
  }

  async function submitPartial() {
    if (!selected) return;
    if (!partialAmount || partialAmount <= 0) {
      toast.error("Enter amount");
      return;
    }

    const balance = getInvoiceBalance(selected);
    if (partialAmount > balance) {
      toast.error("Amount exceeds balance");
      return;
    }

    try {
      const res = await authFetch(`/api/invoices/${selected.id}/apply-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: partialAmount, method, note }),
      });

      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Failed");
        return;
      }

      toast.success("Payment recorded");
      setSelected(null);
      await fetchInvoices();
    } catch {
      toast.error("Error recording payment");
    }
  }

  async function downloadReceipt(inv: Invoice) {
    try {
      const res = await authFetch(`/api/invoices/${inv.id}/receipt`);
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        toast.error(payload?.error || "Could not fetch receipt");
        return;
      }

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch {
      toast.error("Failed to download receipt");
    }
  }

  async function sendReminder(inv: Invoice) {
    try {
      const res = await authFetch("/api/invoices/send-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: inv.id }),
      });

      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Failed to send reminder");
        return;
      }

      toast.success("Reminder sent");
    } catch {
      toast.error("Error sending reminder");
    }
  }

  const pageLabel = useMemo(() => {
    if (!totalPages) return "Page 1 of 1";
    return `Page ${page} of ${totalPages}`;
  }, [page, totalPages]);

  return (
    <div className="min-h-screen space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-semibold">Invoices</h1>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by reference"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground sm:w-64"
          />
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card/80 p-4 shadow-soft">
        <div className="mb-2 text-xs text-muted-foreground">{total.toLocaleString()} invoice(s)</div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-gray-300">
              <tr>
                <th className="p-2">Reference</th>
                <th className="p-2">Student</th>
                <th className="p-2">Amount</th>
                <th className="p-2">Paid</th>
                <th className="p-2">Balance</th>
                <th className="p-2">Status</th>
                <th className="p-2">Due</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-3">
                    Loading...
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-3 text-gray-400">
                    No invoices found
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="border-t border-border/60">
                    <td className="p-2 font-semibold">{inv.reference}</td>
                    <td className="p-2 text-sm text-muted-foreground">{inv.student_full_name || "-"}</td>
                    <td className="p-2">NGN {formatCurrency(inv.total_amount ?? inv.amount)}</td>
                    <td className="p-2">NGN {formatCurrency(inv.amount_paid ?? 0)}</td>
                    <td className="p-2">NGN {formatCurrency(getInvoiceBalance(inv))}</td>
                    <td className="p-2 capitalize">{inv.status}</td>
                    <td className="p-2 text-sm text-muted-foreground">
                      {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : "-"}
                    </td>
                    <td className="p-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => openPartial(inv)}
                          className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                        >
                          Record Payment
                        </button>
                        <button
                          onClick={() => downloadReceipt(inv)}
                          className="rounded-md bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80"
                        >
                          Receipt
                        </button>
                        <button
                          onClick={() => sendReminder(inv)}
                          className="rounded-md bg-amber-500 px-3 py-1 text-xs font-semibold text-amber-950 hover:bg-amber-400"
                        >
                          Reminder
                        </button>
                      </div>
                      {inv.payment_history && inv.payment_history.length > 0 && <PaymentHistory history={inv.payment_history} />}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-col gap-2 border-t border-border/60 pt-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="text-muted-foreground">{pageLabel}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((current) => Math.max(current - 1, 1))}
              disabled={page <= 1 || loading}
              className="rounded-md border border-input px-3 py-1 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((current) => (totalPages ? Math.min(current + 1, totalPages) : current + 1))}
              disabled={loading || (totalPages > 0 && page >= totalPages)}
              className="rounded-md border border-input px-3 py-1 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-soft">
            <h2 className="mb-4 text-xl">Record Payment - {selected.reference}</h2>
            <p className="mb-3 text-sm text-muted-foreground">Student: {selected.student_full_name}</p>

            <div className="mb-3">
              <label className="mb-1 block text-sm text-muted-foreground">Amount (NGN)</label>
              <input
                type="number"
                className="w-full rounded border border-input bg-background p-2 text-sm"
                value={partialAmount}
                onChange={(event) => setPartialAmount(Number(event.target.value))}
              />
            </div>

            <div className="mb-3">
              <label className="mb-1 block text-sm text-muted-foreground">Method</label>
              <select
                className="w-full rounded border border-input bg-background p-2 text-sm"
                value={method}
                onChange={(event) => setMethod(event.target.value)}
              >
                <option value="cash">Cash</option>
                <option value="bank">Bank Transfer</option>
                <option value="pos">POS</option>
                <option value="manual">Manual/Other</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-sm text-muted-foreground">Note (optional)</label>
              <input
                className="w-full rounded border border-input bg-background p-2 text-sm"
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setSelected(null)}
                className="rounded-md bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground hover:bg-secondary/80"
              >
                Cancel
              </button>
              <button
                onClick={submitPartial}
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Save Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getInvoiceBalance(invoice: Invoice) {
  const total = Number(invoice.total_amount ?? invoice.amount ?? 0);
  const paid = Number(invoice.amount_paid ?? 0);
  return Math.max(invoice.balance ?? total - paid, 0);
}

function formatCurrency(val: unknown) {
  const n = Number(val || 0);
  return n.toLocaleString();
}
