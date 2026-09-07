import PDFDocument from "pdfkit";
import { NextResponse, type NextRequest } from "next/server";
import { requireRequestUser } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { applyTenantFilter } from "@/lib/server/tenant";
import { getSchoolProfile, loadLogoBuffer } from "@/lib/server/schoolProfile";

// Printable student ID cards for a class: CR80-ish cards, 8 per A4 page.
export async function GET(req: NextRequest, ctx: { params: Promise<{ classId: string }> }) {
  const auth = await requireRequestUser(req, { roles: ["admin"] });
  if (!auth.ok) return auth.response;

  const { classId } = await ctx.params;
  const sessionLabel = req.nextUrl.searchParams.get("session") || "";

  let classQuery = supabaseAdmin.from("classes").select("id, name").eq("id", classId);
  classQuery = applyTenantFilter(classQuery, auth.ctx.tenant);
  const { data: cls } = await classQuery.maybeSingle();
  if (!cls) return NextResponse.json({ error: "Class not found" }, { status: 404 });

  let studentsQuery = supabaseAdmin.from("students").select("id, full_name, admission_number, gender, date_of_birth, parent_phone").eq("class_id", classId).eq("status", "active").order("full_name");
  studentsQuery = applyTenantFilter(studentsQuery, auth.ctx.tenant);
  const { data: students } = await studentsQuery;
  if (!students || students.length === 0) return NextResponse.json({ error: "No active students in this class" }, { status: 404 });

  const school = await getSchoolProfile(auth.ctx.tenant);
  const logo = await loadLogoBuffer(school.logoUrl);

  const doc = new PDFDocument({ size: "A4", margin: 20 });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const cardW = 255;
  const cardH = 160;
  const gapX = 25;
  const gapY = 20;
  const perRow = 2;
  const perPage = 8;

  students.forEach((s: any, i: number) => {
    if (i > 0 && i % perPage === 0) doc.addPage();
    const idx = i % perPage;
    const x = 20 + (idx % perRow) * (cardW + gapX);
    const y = 20 + Math.floor(idx / perRow) * (cardH + gapY);

    doc.save();
    doc.roundedRect(x, y, cardW, cardH, 10).lineWidth(1).strokeColor("#0A4D68").stroke();
    doc.rect(x, y, cardW, 34).fillColor("#0A4D68").fill();
    if (logo) {
      try {
        doc.image(logo, x + 8, y + 5, { height: 24 });
      } catch {
        // skip logo
      }
    }
    doc.fillColor("#fff").fontSize(10).text(school.name, x + 40, y + 8, { width: cardW - 48 });
    doc.fontSize(7).text("STUDENT ID CARD", x + 40, y + 21);

    doc.rect(x + 10, y + 44, 60, 72).strokeColor("#bbb").stroke();
    doc.fillColor("#999").fontSize(6).text("PHOTO", x + 10, y + 76, { width: 60, align: "center" });

    doc.fillColor("#000").fontSize(11).text(s.full_name, x + 80, y + 46, { width: cardW - 90 });
    doc.fontSize(8).fillColor("#333");
    doc.text(`Class: ${cls.name}`, x + 80, y + 66);
    doc.text(`Adm. No: ${s.admission_number || "-"}`, x + 80, y + 78);
    if (s.date_of_birth) doc.text(`DOB: ${s.date_of_birth}`, x + 80, y + 90);
    if (s.gender) doc.text(`Gender: ${String(s.gender)[0].toUpperCase()}${String(s.gender).slice(1)}`, x + 80, y + 102);
    if (sessionLabel) doc.text(`Session: ${sessionLabel}`, x + 80, y + 114);

    doc.fontSize(6).fillColor("#666").text(school.phone ? `If found, call ${school.phone}` : school.address || "", x + 10, y + cardH - 16, { width: cardW - 20, align: "center" });
    doc.restore();
  });

  doc.end();
  const buffer = await done;
  const safeClass = String(cls.name).replace(/[^a-z0-9]+/gi, "-");
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="id-cards-${safeClass}.pdf"` },
  });
}
