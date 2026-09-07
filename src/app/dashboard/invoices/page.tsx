"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { CreditCard, Plus, Receipt, Layers } from "lucide-react";
import PaymentHistory from "@/components/invoices/PaymentHistory";
import { authFetch } from "@/lib/client/authFetch";
import { supabase } from "@/lib/supabaseClient";
import { EmptyState } from "@/components/ui/empty-state";
import { Tooltip } from "@/components/ui/tooltip";
import { useCurrentProfile } from "@/lib/hooks/useCurrentProfile";
import { useSchoolSettings } from "@/lib/hooks/useSchoolSettings";
import { formatMoney, currencySymbol } from "@/lib/money";
import { useT } from "@/components/i18n/LocaleProvider";

type Invoice = {
  id: string;
  reference: string;
  total_amount?: number;
  amount?: number;
  amount_paid?: number;
  balance?: number;
  status: string;
  fee_name?: string | null;
  student_full_name?: string;
  class_name?: string | null;
  parent_name?: string;
  parent_email?: string;
  due_date?: string;
  payment_history?: any[];
};

type Option = { id: string; name: string };
type StudentOption = { id: string; full_name: string };
type FeeOption = { id: string; name: string; amount: number };

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-500/20 text-amber-300",
  partial: "bg-sky-500/20 text-sky-300",
  paid: "bg-green-500/20 text-green-300",
  overdue: "bg-red-500/20 text-red-300",
  cancelled: "bg-gray-500/20 text-gray-300",
};

export default function InvoicesPage() {
  const { t } = useT();
  const { profile, loading: profileLoading } = useCurrentProfile();
  const { settings } = useSchoolSettings();
  const cur = settings.currency;
  const role = profile?.role;
  const isStaff = role === "admin" || role === "teacher";
  const isAdmin = role === "admin";
  const isPayer = role === "student" || role === "parent";

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [classes, setClasses] = useState<Option[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [feeItems, setFeeItems] = useState<FeeOption[]>([]);

  const [modal, setModal] = useState<null | "create" | "bulk" | "record" | "pay" | "discount">(null);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [busy, setBusy] = useState(false);

  const [createForm, setCreateForm] = useState({ student_id: "", fee_item_id: "", amount: "", discount: "", due_date: "" });
  const [bulkForm, setBulkForm] = useState({ class_id: "", fee_item_ids: [] as string[], due_date: "" });
  const [recordForm, setRecordForm] = useState({ amount: 0, method: "cash", note: "" });
  const [payForm, setPayForm] = useState({ amount: 0, gateway: "paystack" as "paystack" | "flutterwave" });
  const [discountForm, setDiscountForm] = useState({ amount: 0, note: "" });

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (profileLoading) return;
    void fetchInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, classFilter, debouncedQuery, profileLoading]);

  useEffect(() => {
    if (!isStaff) return;
    supabase.from("classes").select("id, name").order("name").then(({ data }) => setClasses(data || []));
    if (isAdmin) {
      supabase.from("students").select("id, full_name").eq("status", "active").order("full_name").then(({ data }) => setStudents(data || []));
      supabase.from("fee_items").select("id, name, amount").order("name").then(({ data }) => setFeeItems((data as any) || []));
    }
  }, [isStaff, isAdmin]);

  async function fetchInvoices() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (classFilter) params.set("classId", classFilter);
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

  async function postJson(url: string, body: unknown, method = "POST") {
    const res = await authFetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "Request failed");
    return json;
  }

  async function submitCreate() {
    if (!createForm.student_id || !createForm.fee_item_id) return toast.error("Choose a student and a fee item");
    setBusy(true);
    try {
      await postJson("/api/invoices", {
        student_id: createForm.student_id,
        fee_item_id: createForm.fee_item_id,
        amount: createForm.amount ? Number(createForm.amount) : undefined,
        discount: createForm.discount ? Number(createForm.discount) : 0,
        due_date: createForm.due_date || undefined,
      });
      toast.success("Invoice created");
      setModal(null);
      setCreateForm({ student_id: "", fee_item_id: "", amount: "", discount: "", due_date: "" });
      await fetchInvoices();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitBulk() {
    if (bulkForm.fee_item_ids.length === 0) return toast.error("Select at least one fee item");
    setBusy(true);
    try {
      const json = await postJson("/api/invoices/bulk", { class_id: bulkForm.class_id || null, fee_item_ids: bulkForm.fee_item_ids, due_date: bulkForm.due_date || undefined });
      toast.success(`${json.created} invoice(s) created${json.skipped ? `, ${json.skipped} skipped (already invoiced)` : ""}`);
      setModal(null);
      await fetchInvoices();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitRecord() {
    if (!selected) return;
    if (!recordForm.amount || recordForm.amount <= 0) return toast.error("Enter an amount");
    setBusy(true);
    try {
      await postJson(`/api/invoices/${selected.id}/apply-payment`, recordForm);
      toast.success("Payment recorded");
      setModal(null);
      await fetchInvoices();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitPay() {
    if (!selected) return;
    if (!payForm.amount || payForm.amount <= 0) return toast.error("Enter an amount");
    setBusy(true);
    try {
      const url = payForm.gateway === "paystack" ? "/api/paystack/initialize" : "/api/flutterwave/create";
      const json = await postJson(url, { invoice_id: selected.id, amount: payForm.amount, amount_unit: "naira" });
      const redirect = json.authorization_url || json.link;
      if (!redirect) throw new Error("Gateway did not return a checkout link");
      window.location.href = redirect;
    } catch (e: any) {
      toast.error(e.message);
      setBusy(false);
    }
  }

  async function submitDiscount() {
    if (!selected) return;
    setBusy(true);
    try {
      await postJson(`/api/invoices/${selected.id}`, { action: "discount", ...discountForm }, "PATCH");
      toast.success("Discount applied");
      setModal(null);
      await fetchInvoices();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function cancelInvoice(inv: Invoice) {
    if (!confirm(`Cancel invoice ${inv.reference}?`)) return;
    try {
      await postJson(`/api/invoices/${inv.id}`, { action: "cancel" }, "PATCH");
      toast.success("Invoice cancelled");
      await fetchInvoices();
    } catch (e: any) {
      toast.error(e.message);
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
      await postJson("/api/invoices/send-reminder", { invoiceId: inv.id });
      toast.success("Reminder sent");
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  const pageLabel = useMemo(() => (totalPages ? `Page ${page} of ${totalPages}` : "Page 1 of 1"), [page, totalPages]);
  const outstanding = useMemo(() => invoices.reduce((s, i) => s + (i.status === "cancelled" ? 0 : getBalance(i)), 0), [invoices]);

  if (profileLoading) return <p className="p-4 text-sm text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{isPayer ? t("page.invoices.mine") : t("page.invoices.title")}</h1>
          {isPayer && <p className="text-sm text-muted-foreground">{t("page.invoices.outstanding")}: {formatMoney(outstanding, cur)}</p>}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {isStaff && (
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search reference or student" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:w-56" />
          )}
          {isStaff && classes.length > 0 && (
            <select value={classFilter} onChange={(e) => { setClassFilter(e.target.value); setPage(1); }} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="">All classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="partial">Partial</option>
            <option value="overdue">Overdue</option>
            <option value="paid">Paid</option>
            <option value="cancelled">Cancelled</option>
          </select>
          {isAdmin && (
            <>
              <button onClick={() => setModal("create")} className="flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                <Plus size={14} /> {t("page.invoices.new")}
              </button>
              <button onClick={() => setModal("bulk")} className="flex items-center gap-1 rounded-md bg-secondary px-3 py-2 text-sm font-semibold text-secondary-foreground hover:bg-secondary/80">
                <Layers size={14} /> {t("page.invoices.bulk")}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card/80 p-4 shadow-soft">
        <div className="mb-2 text-xs text-muted-foreground">{total.toLocaleString()} invoice(s)</div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted-foreground">
              <tr>
                <th className="p-2">{t("common.reference")}</th>
                {!isPayer && <th className="p-2">{t("common.student")}</th>}
                <th className="p-2">{t("common.fee")}</th>
                <th className="p-2">{t("common.amount")}</th>
                <th className="p-2">{t("common.paid")}</th>
                <th className="p-2">{t("common.balance")}</th>
                <th className="p-2">{t("common.status")}</th>
                <th className="p-2">{t("common.due")}</th>
                <th className="p-2">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="p-3">Loading...</td></tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-3">
                    <EmptyState
                      icon={<Receipt size={20} />}
                      title={t("page.invoices.empty")}
                      description={statusFilter !== "all" || debouncedQuery || classFilter ? "Try clearing the filters above." : isAdmin ? "Create one with “New invoice” or invoice a whole class in bulk." : "Invoices for you will show up here."}
                    />
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => {
                  const balance = getBalance(inv);
                  const open = balance > 0 && inv.status !== "cancelled";
                  return (
                    <tr key={inv.id} className="border-t border-border/60 align-top">
                      <td className="p-2 font-semibold">{inv.reference}</td>
                      {!isPayer && (
                        <td className="p-2 text-muted-foreground">
                          {inv.student_full_name || "-"}
                          {inv.class_name && <span className="block text-xs">{inv.class_name}</span>}
                        </td>
                      )}
                      <td className="p-2 text-muted-foreground">{inv.fee_name || "-"}</td>
                      <td className="p-2">{formatMoney(inv.total_amount ?? inv.amount, cur)}</td>
                      <td className="p-2">{formatMoney(inv.amount_paid ?? 0, cur)}</td>
                      <td className="p-2 font-medium">{formatMoney(balance, cur)}</td>
                      <td className="p-2"><span className={`rounded-full px-2 py-0.5 text-xs capitalize ${STATUS_STYLES[inv.status] || ""}`}>{inv.status}</span></td>
                      <td className="p-2 text-muted-foreground">{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : "-"}</td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-1.5">
                          {isPayer && open && (
                            <button onClick={() => { setSelected(inv); setPayForm({ amount: balance, gateway: "paystack" }); setModal("pay"); }} className="flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
                              <CreditCard size={12} /> {t("page.invoices.pay")}
                            </button>
                          )}
                          {isAdmin && open && (
                            <Tooltip content="Record a cash/bank/POS payment">
                              <button onClick={() => { setSelected(inv); setRecordForm({ amount: balance, method: "cash", note: "" }); setModal("record"); }} className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90">{t("page.invoices.record")}</button>
                            </Tooltip>
                          )}
                          <button onClick={() => downloadReceipt(inv)} className="rounded-md bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80">{t("page.invoices.receipt")}</button>
                          {isAdmin && open && (
                            <>
                              <Tooltip content="Email the parent a reminder">
                                <button onClick={() => sendReminder(inv)} className="rounded-md bg-amber-500 px-3 py-1 text-xs font-semibold text-amber-950 hover:bg-amber-400">{t("page.invoices.remind")}</button>
                              </Tooltip>
                              <button onClick={() => { setSelected(inv); setDiscountForm({ amount: 0, note: "" }); setModal("discount"); }} className="rounded-md border border-input px-3 py-1 text-xs hover:bg-white/5">{t("page.invoices.discount")}</button>
                              {Number(inv.amount_paid || 0) === 0 && (
                                <button onClick={() => cancelInvoice(inv)} className="rounded-md border border-red-500/40 px-3 py-1 text-xs text-red-300 hover:bg-red-500/10">{t("page.invoices.cancel")}</button>
                              )}
                            </>
                          )}
                        </div>
                        {inv.payment_history && inv.payment_history.length > 0 && <PaymentHistory history={inv.payment_history} />}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-col gap-2 border-t border-border/60 pt-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="text-muted-foreground">{pageLabel}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((c) => Math.max(c - 1, 1))} disabled={page <= 1 || loading} className="rounded-md border border-input px-3 py-1 disabled:opacity-50">{t("common.previous")}</button>
            <button onClick={() => setPage((c) => (totalPages ? Math.min(c + 1, totalPages) : c + 1))} disabled={loading || (totalPages > 0 && page >= totalPages)} className="rounded-md border border-input px-3 py-1 disabled:opacity-50">{t("common.next")}</button>
          </div>
        </div>
      </div>

      {modal && (
        <Modal onClose={() => !busy && setModal(null)}>
          {modal === "create" && (
            <>
              <h2 className="mb-4 text-xl">New invoice</h2>
              <div className="space-y-3">
                <Field label="Student">
                  <select value={createForm.student_id} onChange={(e) => setCreateForm({ ...createForm, student_id: e.target.value })} className={inputCls}>
                    <option value="">Select student</option>
                    {students.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                  </select>
                </Field>
                <Field label="Fee item">
                  <select value={createForm.fee_item_id} onChange={(e) => { const fee = feeItems.find((f) => f.id === e.target.value); setCreateForm({ ...createForm, fee_item_id: e.target.value, amount: fee ? String(fee.amount) : "" }); }} className={inputCls}>
                    <option value="">Select fee</option>
                    {feeItems.map((f) => <option key={f.id} value={f.id}>{f.name} — {formatMoney(f.amount, cur)}</option>)}
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={`Amount (${currencySymbol(cur).trim()})`}><input type="number" min={0} value={createForm.amount} onChange={(e) => setCreateForm({ ...createForm, amount: e.target.value })} className={inputCls} /></Field>
                  <Field label={`Discount (${currencySymbol(cur).trim()})`}><input type="number" min={0} value={createForm.discount} onChange={(e) => setCreateForm({ ...createForm, discount: e.target.value })} className={inputCls} /></Field>
                </div>
                <Field label="Due date"><input type="date" value={createForm.due_date} onChange={(e) => setCreateForm({ ...createForm, due_date: e.target.value })} className={inputCls} /></Field>
              </div>
              <ModalActions onCancel={() => setModal(null)} onConfirm={submitCreate} busy={busy} label="Create invoice" />
            </>
          )}

          {modal === "bulk" && (
            <>
              <h2 className="mb-1 text-xl">Bulk invoice</h2>
              <p className="mb-4 text-sm text-muted-foreground">One invoice per student for each selected fee. Students already invoiced for a fee are skipped.</p>
              <div className="space-y-3">
                <Field label="Class">
                  <select value={bulkForm.class_id} onChange={(e) => setBulkForm({ ...bulkForm, class_id: e.target.value })} className={inputCls}>
                    <option value="">Whole school (all active students)</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
                <Field label="Fee items">
                  <div className="max-h-48 space-y-1 overflow-y-auto rounded border border-input p-2">
                    {feeItems.map((f) => (
                      <label key={f.id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={bulkForm.fee_item_ids.includes(f.id)} onChange={(e) => setBulkForm({ ...bulkForm, fee_item_ids: e.target.checked ? [...bulkForm.fee_item_ids, f.id] : bulkForm.fee_item_ids.filter((x) => x !== f.id) })} />
                        {f.name} <span className="text-muted-foreground">{formatMoney(f.amount, cur)}</span>
                      </label>
                    ))}
                    {feeItems.length === 0 && <p className="text-xs text-muted-foreground">Create fee items first.</p>}
                  </div>
                </Field>
                <Field label="Due date"><input type="date" value={bulkForm.due_date} onChange={(e) => setBulkForm({ ...bulkForm, due_date: e.target.value })} className={inputCls} /></Field>
              </div>
              <ModalActions onCancel={() => setModal(null)} onConfirm={submitBulk} busy={busy} label="Generate invoices" />
            </>
          )}

          {modal === "record" && selected && (
            <>
              <h2 className="mb-1 text-xl">Record payment</h2>
              <p className="mb-4 text-sm text-muted-foreground">{selected.reference} · {selected.student_full_name} · balance {formatMoney(getBalance(selected), cur)}</p>
              <div className="space-y-3">
                <Field label={`Amount (${currencySymbol(cur).trim()})`}><input type="number" min={0} max={getBalance(selected)} value={recordForm.amount} onChange={(e) => setRecordForm({ ...recordForm, amount: Number(e.target.value) })} className={inputCls} /></Field>
                <Field label="Method">
                  <select value={recordForm.method} onChange={(e) => setRecordForm({ ...recordForm, method: e.target.value })} className={inputCls}>
                    <option value="cash">Cash</option>
                    <option value="bank">Bank transfer</option>
                    <option value="pos">POS</option>
                    <option value="cheque">Cheque</option>
                    <option value="manual">Other</option>
                  </select>
                </Field>
                <Field label="Note (optional)"><input value={recordForm.note} onChange={(e) => setRecordForm({ ...recordForm, note: e.target.value })} className={inputCls} /></Field>
              </div>
              <ModalActions onCancel={() => setModal(null)} onConfirm={submitRecord} busy={busy} label="Save payment" />
            </>
          )}

          {modal === "pay" && selected && (
            <>
              <h2 className="mb-1 text-xl">Pay online</h2>
              <p className="mb-4 text-sm text-muted-foreground">{selected.fee_name || selected.reference} · balance {formatMoney(getBalance(selected), cur)}</p>
              <div className="space-y-3">
                <Field label={`Amount (${currencySymbol(cur).trim()})`}><input type="number" min={1} max={getBalance(selected)} value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: Number(e.target.value) })} className={inputCls} /></Field>
                <Field label="Pay with">
                  <div className="grid grid-cols-2 gap-2">
                    {(["paystack", "flutterwave"] as const).map((g) => (
                      <button key={g} type="button" onClick={() => setPayForm({ ...payForm, gateway: g })} className={`rounded-md border px-3 py-2 text-sm capitalize ${payForm.gateway === g ? "border-primary bg-primary/10" : "border-input"}`}>{g}</button>
                    ))}
                  </div>
                </Field>
                <p className="text-xs text-muted-foreground">You&apos;ll be redirected to the payment provider to complete the transaction securely.</p>
              </div>
              <ModalActions onCancel={() => setModal(null)} onConfirm={submitPay} busy={busy} label={busy ? "Redirecting..." : "Continue to payment"} />
            </>
          )}

          {modal === "discount" && selected && (
            <>
              <h2 className="mb-1 text-xl">Apply discount</h2>
              <p className="mb-4 text-sm text-muted-foreground">{selected.reference} · reduces the amount owed (scholarship, waiver, sibling discount).</p>
              <div className="space-y-3">
                <Field label={`Discount (${currencySymbol(cur).trim()})`}><input type="number" min={0} max={getBalance(selected)} value={discountForm.amount} onChange={(e) => setDiscountForm({ ...discountForm, amount: Number(e.target.value) })} className={inputCls} /></Field>
                <Field label="Reason"><input value={discountForm.note} onChange={(e) => setDiscountForm({ ...discountForm, note: e.target.value })} className={inputCls} placeholder="e.g. 50% scholarship" /></Field>
              </div>
              <ModalActions onCancel={() => setModal(null)} onConfirm={submitDiscount} busy={busy} label="Apply discount" />
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

const inputCls = "w-full rounded border border-input bg-background p-2 text-sm";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-soft" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function ModalActions({ onCancel, onConfirm, busy, label }: { onCancel: () => void; onConfirm: () => void; busy: boolean; label: string }) {
  return (
    <div className="mt-5 flex justify-end gap-2">
      <button onClick={onCancel} disabled={busy} className="rounded-md bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50">Cancel</button>
      <button onClick={onConfirm} disabled={busy} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{label}</button>
    </div>
  );
}

function getBalance(invoice: Invoice) {
  const total = Number(invoice.total_amount ?? invoice.amount ?? 0);
  const paid = Number(invoice.amount_paid ?? 0);
  return Math.max(invoice.balance ?? total - paid, 0);
}


