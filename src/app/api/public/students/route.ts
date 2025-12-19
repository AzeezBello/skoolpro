import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';

export async function GET() {
  const { data, error } = await supabaseAdmin.from('students').select('id, full_name, class_id, created_at').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
