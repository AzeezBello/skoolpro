export const paymentReminderTemplate = (studentName: string, amount: number, dueDate: string, paymentLink: string) => `
  <div style="font-family: Arial, sans-serif; color: #333;">
    <h2 style="color:#FF8800;">Payment Reminder</h2>
    <p>Dear ${studentName},</p>
    <p>This is a friendly reminder that your payment of <strong>₦${amount.toLocaleString()}</strong> is due on <b>${dueDate}</b>.</p>
    <p>Please click the button below to make your payment:</p>
    <a href="${paymentLink}" style="background:#FF8800;color:#fff;padding:10px 15px;border-radius:4px;text-decoration:none;">Pay Now</a>
    <p>If you’ve already made this payment, kindly ignore this message.</p>
    <br/>
    <small>SkoolPro Billing Department</small>
  </div>
`;
