function esc(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

function money(amount: number, currency: string) {
  const symbol = currency === "NGN" ? "₦" : `${currency} `;
  return `${symbol}${amount.toLocaleString()}`;
}

export const paymentReminderTemplate = (p: {
  recipientName: string;
  studentName: string;
  feeName: string;
  reference: string;
  amount: number;
  currency: string;
  dueDate: string;
  paymentLink: string;
  schoolName: string;
}) => `
  <div style="font-family: Arial, sans-serif; color: #222; max-width: 560px;">
    <h2 style="color:#0A4D68;">${esc(p.schoolName)}</h2>
    <p>Dear ${esc(p.recipientName)},</p>
    <p>This is a friendly reminder that <strong>${money(p.amount, p.currency)}</strong> is outstanding for
       <strong>${esc(p.feeName)}</strong> (${esc(p.studentName)}, invoice ${esc(p.reference)})${p.dueDate ? `, due on <b>${esc(p.dueDate)}</b>` : ""}.</p>
    <p>You can view the invoice and pay online here:</p>
    <p><a href="${p.paymentLink}" style="background:#0A4D68;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block;">View &amp; pay</a></p>
    <p>If you have already made this payment, kindly ignore this message.</p>
    <br/>
    <small style="color:#666;">${esc(p.schoolName)} · sent via SkoolPro</small>
  </div>
`;
