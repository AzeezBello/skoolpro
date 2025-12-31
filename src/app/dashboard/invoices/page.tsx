'use client'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import PaymentHistory from '@/components/invoices/PaymentHistory'

type Invoice = {
  id: string
  reference: string
  total_amount?: number
  amount?: number
  amount_paid?: number
  balance?: number
  status: string
  student_full_name?: string
  parent_name?: string
  parent_email?: string
  due_date?: string
  payment_history?: any[]
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Invoice | null>(null)
  const [partialAmount, setPartialAmount] = useState<number>(0)
  const [method, setMethod] = useState<string>('cash')
  const [note, setNote] = useState<string>('')

  useEffect(() => { fetchInvoices() }, [])

  async function fetchInvoices() {
    setLoading(true)
    try {
      const res = await fetch('/api/public/invoices')
      const json = await res.json()
      setInvoices(json.data || [])
    } catch (err) {
      toast.error('Failed to load invoices')
    } finally { setLoading(false) }
  }

  function openPartial(inv: Invoice) {
    setSelected(inv)
    const bal = inv.balance ?? ((inv.total_amount ?? inv['amount'] ?? 0) - (inv.amount_paid ?? 0))
    setPartialAmount(bal)
    setMethod('cash'); setNote('')
  }

  async function submitPartial() {
    if (!selected) return
    if (!partialAmount || partialAmount <= 0) return toast.error('Enter amount')
    const bal = selected.balance ?? ((selected.total_amount ?? selected['amount'] ?? 0) - (selected.amount_paid ?? 0))
    if (partialAmount > bal) return toast.error('Amount exceeds balance')

    try {
      const res = await fetch(`/api/invoices/${selected.id}/apply-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: partialAmount, method, note }),
      })
      const json = await res.json()
      if (!res.ok) toast.error(json.error || 'Failed')
      else {
        toast.success('Payment recorded')
        setSelected(null)
        fetchInvoices()
      }
    } catch (err) { toast.error('Error') }
  }

  async function downloadReceipt(inv: Invoice) {
    window.open(`/api/invoices/${inv.id}/receipt`, '_blank')
  }

  async function sendReminder(inv: Invoice) {
    try {
      const res = await fetch('/api/invoices/send-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: inv.id })
      })
      const json = await res.json()
      if (!res.ok) toast.error(json.error || 'Failed to send reminder')
      else toast.success('Reminder sent')
    } catch (err) { toast.error('Error') }
  }

  return (
    <div className="min-h-screen space-y-4">
      <h1 className="text-2xl font-semibold">Invoices</h1>
      <div className="rounded-xl border border-border bg-card/80 p-4 shadow-soft">
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
                <tr><td colSpan={8} className="p-3">Loading...</td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan={8} className="p-3 text-gray-400">No invoices</td></tr>
              ) : (
                invoices.map(inv => (
                  <tr key={inv.id} className="border-t border-border/60">
                    <td className="p-2 font-semibold">{inv.reference}</td>
                    <td className="p-2 text-sm text-muted-foreground">{inv.student_full_name || '—'}</td>
                    <td className="p-2">₦{formatCurrency(inv.total_amount ?? inv['amount'])}</td>
                    <td className="p-2">₦{formatCurrency(inv.amount_paid ?? 0)}</td>
                    <td className="p-2">₦{formatCurrency(inv.balance ?? ((inv.total_amount ?? inv['amount'] ?? 0) - (inv.amount_paid ?? 0)))}</td>
                    <td className="p-2 capitalize">{inv.status}</td>
                    <td className="p-2 text-sm text-muted-foreground">{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '—'}</td>
                    <td className="p-2">
                      <div className="flex gap-2">
                        <button onClick={() => openPartial(inv)} className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90">Record Payment</button>
                        <button onClick={() => downloadReceipt(inv)} className="rounded-md bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80">Receipt</button>
                        <button onClick={() => sendReminder(inv)} className="rounded-md bg-amber-500 px-3 py-1 text-xs font-semibold text-amber-950 hover:bg-amber-400">Reminder</button>
                      </div>
                      {inv.payment_history && inv.payment_history.length > 0 && <PaymentHistory history={inv.payment_history} />}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Partial Payment Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-soft">
            <h2 className="text-xl mb-4">Record Payment — {selected.reference}</h2>
            <p className="text-muted-foreground mb-3 text-sm">Student: {selected.student_full_name}</p>
            <div className="mb-3">
              <label className="block text-sm text-muted-foreground mb-1">Amount (NGN)</label>
              <input type="number" className="w-full rounded border border-input bg-background p-2 text-sm" value={partialAmount} onChange={(e)=>setPartialAmount(Number(e.target.value))} />
            </div>
            <div className="mb-3">
              <label className="block text-sm text-muted-foreground mb-1">Method</label>
              <select className="w-full rounded border border-input bg-background p-2 text-sm" value={method} onChange={(e)=>setMethod(e.target.value)}>
                <option value="cash">Cash</option>
                <option value="bank">Bank Transfer</option>
                <option value="pos">POS</option>
                <option value="manual">Manual/Other</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-sm text-muted-foreground mb-1">Note (optional)</label>
              <input className="w-full rounded border border-input bg-background p-2 text-sm" value={note} onChange={(e)=>setNote(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={()=>setSelected(null)} className="rounded-md bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground hover:bg-secondary/80">Cancel</button>
              <button onClick={submitPartial} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Save Payment</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function formatCurrency(val: any) {
  const n = Number(val || 0)
  return n.toLocaleString()
}
