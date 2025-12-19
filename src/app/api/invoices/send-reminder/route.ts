import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { paymentReminderTemplate } from '@/lib/emailTemplates/payment_reminder';

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(req: Request) {
  const { invoiceId } = await req.json();
  const accessToken = cookies().get('sb-access-token')?.value;
  if (!accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: authUser, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
  if (userError || !authUser?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = authUser.user.id;
  const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', userId).maybeSingle();
  if (!profile || profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: inv } = await supabaseAdmin
    .from('invoices')
    .select('id, reference, total_amount, amount, amount_paid, due_date, student_id, parent_email')
    .eq('id', invoiceId)
    .single();
  if (!inv) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

  const { data: student } = await supabaseAdmin
    .from('students')
    .select('full_name, email')
    .eq('id', inv.student_id)
    .single();

  const to = inv.parent_email || student?.email;
  if (!to) return NextResponse.json({ error: 'No recipient email' }, { status: 400 });

  const balance = Number(inv.total_amount ?? inv.amount ?? 0) - Number(inv.amount_paid ?? 0);
  if (balance <= 0) return NextResponse.json({ error: 'Already paid' }, { status: 400 });

  const html = paymentReminderTemplate(
    student?.full_name || 'Parent',
    balance,
    inv.due_date || '',
    `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/invoices`
  );

  try {
    await resend.emails.send({
      from: process.env.FROM_EMAIL!,
      to,
      subject: `Payment reminder — ${inv.reference}`,
      html,
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 });
  }

  await supabaseAdmin.from('invoices').update({ last_reminder_sent: new Date().toISOString() }).eq('id', invoiceId);

  return NextResponse.json({ ok: true });
}
