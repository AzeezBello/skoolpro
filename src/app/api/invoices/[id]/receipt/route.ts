import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  const { data: invoice, error } = await supabaseAdmin.from('invoices')
    .select('id, reference, total_amount, amount_paid, status, created_at, student_id, fee_item_id')
    .eq('id', id).single();
  if (error || !invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

  // fetch student and fee item
  const { data: student } = await supabaseAdmin.from('students').select('full_name, email, parent_name, parent_email').eq('id', invoice.student_id).single();
  const { data: fee } = await supabaseAdmin.from('fee_items').select('name').eq('id', invoice.fee_item_id).single();

  const doc = new PDFDocument({ margin: 40 });
  const chunks: any[] = [];
  doc.on('data', (c) => chunks.push(c));
  doc.on('end', () => {});

  const logoPath = path.join(process.cwd(), 'public', 'logo.png');
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, 50, 30, { width: 70 });
  }

  doc.fontSize(18).fillColor('#0A4D68').text('SkoolPro', 130, 35);
  doc.moveDown(2);
  doc.fontSize(14).fillColor('#000').text('Payment Receipt', { align: 'center' });
  doc.moveDown(1);

  doc.fontSize(12).text(`Reference: ${invoice.reference}`);
  doc.text(`Student: ${student?.full_name || '—'}`);
  doc.text(`Fee: ${fee?.name || '—'}`);
  doc.text(`Amount: ₦${(invoice.total_amount || 0).toLocaleString()}`);
  doc.text(`Paid: ₦${(invoice.amount_paid || 0).toLocaleString()}`);
  doc.text(`Status: ${invoice.status}`);
  doc.end();

  const buffer = Buffer.concat(chunks);
  return new NextResponse(buffer, {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="receipt-${invoice.reference}.pdf"` }
  });
}
