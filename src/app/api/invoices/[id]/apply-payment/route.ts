import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseServer';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: invoiceId } = await ctx.params;
  const body = await req.json();
  const amount = Number(body.amount || 0);
  const method = body.method || 'manual';
  const note = body.note || '';

  const cookieStore = await cookies();
  const accessToken = cookieStore.get('sb-access-token')?.value;
  if (!accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: authUser, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
  if (userError || !authUser?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = authUser.user.id;
  const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', userId).maybeSingle();
  if (!profile || profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: invoice, error: invoiceError } = await supabaseAdmin
    .from('invoices')
    .select('id, reference, total_amount, amount, amount_paid, payment_history')
    .eq('id', invoiceId)
    .single();
  if (invoiceError || !invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

  const prevPaid = Number(invoice.amount_paid || 0);
  const total = Number(invoice.total_amount || invoice.amount || 0);
  if (amount <= 0) return NextResponse.json({ error: 'Enter a valid amount' }, { status: 400 });
  if (prevPaid + amount > total) return NextResponse.json({ error: 'Amount exceeds balance' }, { status: 400 });

  const newPaid = prevPaid + amount;
  const entry = { amount, date: new Date().toISOString(), by: authUser.user.email, method, note };
  const history = Array.isArray(invoice.payment_history) ? [...invoice.payment_history, entry] : [entry];
  const status = newPaid >= total ? 'paid' : 'partial';

  const { error } = await supabaseAdmin
    .from('invoices')
    .update({ amount_paid: newPaid, payment_history: history, status })
    .eq('id', invoiceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin
    .from('payments')
    .insert([{ invoice_id: invoiceId, gateway: 'manual', amount, status: 'success', gateway_response: { method, note } }]);

  return NextResponse.json({ ok: true, status });
}
