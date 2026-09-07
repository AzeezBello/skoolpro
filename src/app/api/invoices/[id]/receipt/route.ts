import PDFDocument from "pdfkit";
import { NextResponse, type NextRequest } from "next/server";
import { requireRequestUser } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { applyTenantFilter } from "@/lib/server/tenant";
import { getSchoolProfile, loadLogoBuffer, type SchoolProfile } from "@/lib/server/schoolProfile";

async function renderReceiptPdf(invoice: any, student: any, fee: any, school: SchoolProfile, logoBuffer: Buffer | null) {
  const doc = new PDFDocument({ margin: 40 });
  const chunks: Buffer[] = [];

  const bufferPromise = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  if (logoBuffer) {
    try {
      doc.image(logoBuffer, 50, 30, { width: 70 });
    } catch {
      // Malformed/unsupported image data — skip the logo rather than fail
      // the whole document.
    }
  }

  const total = Number(invoice.total_amount || 0);
  const paid = Number(invoice.amount_paid || 0);
  const balance = Math.max(total - paid, 0);

  const schoolTitle = school.establishedYear ? `${school.name} (Est. ${school.establishedYear})` : school.name;
  doc.fontSize(18).fillColor("#0A4D68").text(schoolTitle, 130, 35);
  if (school.address) {
    doc.fontSize(9).fillColor("#777").text(school.address, 130, doc.y);
  }
  doc.moveDown(2);
  doc.fillColor("#000").fontSize(14).text("Payment Receipt", { align: "center" });
  doc.moveDown(1);

  doc.fontSize(12).text(`Reference: ${invoice.reference}`);
  doc.text(`Student: ${student?.full_name || "-"}`);
  doc.text(`Fee: ${fee?.name || "-"}`);
  doc.text(`Amount: ${school.currency} ${total.toLocaleString()}`);
  doc.text(`Paid: ${school.currency} ${paid.toLocaleString()}`);
  doc.text(`Balance: ${school.currency} ${balance.toLocaleString()}`);
  doc.text(`Status: ${invoice.status}`);

  doc.end();
  return bufferPromise;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  // Only staff manage/view invoices today (see GET /api/invoices); without this,
  // any authenticated account — including a self-registered "student" — could
  // download any invoice's receipt by guessing/enumerating its id.
  const auth = await requireRequestUser(req, { roles: ["admin", "teacher"] });
  if (!auth.ok) return auth.response;

  const { id: invoiceId } = await ctx.params;

  let invoiceQuery = supabaseAdmin
    .from("invoices")
    .select("id, reference, total_amount, amount_paid, status, created_at, student_id, fee_item_id")
    .eq("id", invoiceId);
  invoiceQuery = applyTenantFilter(invoiceQuery, auth.ctx.tenant);

  const { data: invoice, error: invoiceError } = await invoiceQuery.maybeSingle();
  if (invoiceError || !invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  let studentQuery = supabaseAdmin
    .from("students")
    .select("full_name, email, parent_name, parent_email")
    .eq("id", invoice.student_id);
  studentQuery = applyTenantFilter(studentQuery, auth.ctx.tenant);

  let feeQuery = supabaseAdmin.from("fee_items").select("name").eq("id", invoice.fee_item_id);
  feeQuery = applyTenantFilter(feeQuery, auth.ctx.tenant);

  const [{ data: student }, { data: fee }] = await Promise.all([studentQuery.maybeSingle(), feeQuery.maybeSingle()]);

  try {
    const school = await getSchoolProfile(auth.ctx.tenant);
    const logoBuffer = await loadLogoBuffer(school.logoUrl);

    const buffer = await renderReceiptPdf(invoice, student, fee, school, logoBuffer);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename=\"receipt-${invoice.reference}.pdf\"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Could not generate receipt" }, { status: 500 });
  }
}
