'use client'
export default function PaymentHistory({ history }: { history: any[] }) {
  if (!history || history.length === 0) {
    return <p className="text-gray-500 text-sm mt-2">No payment history yet.</p>
  }
  return (
    <div className="mt-4 border-t pt-2">
      <h4 className="text-md font-semibold mb-2">Payment History</h4>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-400">
            <th className="p-2">Date</th>
            <th className="p-2">Amount (₦)</th>
            <th className="p-2">Recorded By</th>
          </tr>
        </thead>
        <tbody>
          {history.map((h, i) => (
            <tr key={i} className="border-t border-gray-700">
              <td className="p-2">{new Date(h.date).toLocaleString()}</td>
              <td className="p-2">₦{Number(h.amount).toLocaleString()}</td>
              <td className="p-2 text-gray-300">{h.by || 'System'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
