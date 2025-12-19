import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('invoices')
    .select('id, reference, total_amount, amount, amount_paid, status, due_date, student_id, payment_history, students(full_name, parent_email)')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const shaped = (data || []).map((inv: any) => {
    const total = Number(inv.total_amount ?? inv.amount ?? 0);
    const paid = Number(inv.amount_paid ?? 0);
    const balance = Math.max(total - paid, 0);

    return {
      ...inv,
      balance,
      student_full_name: inv.students?.full_name,
      parent_email: inv.students?.parent_email,
    };
  });

  return NextResponse.json({ data: shaped });
}
