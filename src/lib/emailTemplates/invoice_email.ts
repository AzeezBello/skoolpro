export const invoiceEmailTemplate = (studentName: string, amount: number, reference: string, dueDate: string, paymentLink: string) => `
  <div style="font-family: Arial, sans-serif; color: #333;">
    <h2 style="color:#0A4D68;">Invoice Notice</h2>
    <p>Dear ${studentName},</p>
    <p>Your invoice has been generated for <strong>₦${amount.toLocaleString()}</strong>.</p>
    <p><b>Reference:</b> ${reference}</p>
    <p><b>Due Date:</b> ${dueDate}</p>
    <p>Click below to complete your payment:</p>
    <a href="${paymentLink}" style="background:#0A4D68;color:#fff;padding:10px 15px;border-radius:4px;text-decoration:none;">Pay Now</a>
    <p>Thank you for choosing <b>SkoolPro</b>.</p>
  </div>
`;
