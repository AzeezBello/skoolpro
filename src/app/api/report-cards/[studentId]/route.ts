import PDFDocument from "pdfkit";
import { NextResponse, type NextRequest } from "next/server";
import { getOwnStudentId, requireRequestUser } from "@/lib/server/auth";
import { getTermInfo, buildReportCardData } from "@/lib/server/reportCards";
import { drawReportCardPage } from "@/lib/server/reportCardPdf";
import { getSchoolProfile, loadLogoBuffer } from "@/lib/server/schoolProfile";

export async function GET(req: NextRequest, ctx: { params: Promise<{ studentId: string }> }) {
  const auth = await requireRequestUser(req);
  if (!auth.ok) return auth.response;

  const { studentId } = await ctx.params;
  const termId = req.nextUrl.searchParams.get("termId") || "";

  if (!termId) {
    return NextResponse.json({ error: "termId is required" }, { status: 400 });
  }

  // A student may only ever fetch their own report card; staff may fetch any
  // student's within their school (enforced by the tenant filter).
  const ownStudentId = getOwnStudentId(auth.ctx);
  if (ownStudentId && ownStudentId !== studentId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const term = await getTermInfo(termId, auth.ctx.tenant);
  if (!term) {
    return NextResponse.json({ error: "Term not found" }, { status: 404 });
  }

  const data = await buildReportCardData(studentId, term, auth.ctx.tenant);
  if (!data) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  try {
    const school = await getSchoolProfile(auth.ctx.tenant);
    const logoBuffer = await loadLogoBuffer(school.logoUrl);

    const doc = new PDFDocument({ margin: 40 });
    const chunks: Buffer[] = [];
    const bufferPromise = new Promise<Buffer>((resolve, reject) => {
      doc.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });

    drawReportCardPage(doc, school, logoBuffer, data);
    doc.end();
    const buffer = await bufferPromise;

    const safeName = data.student.full_name.replace(/[^a-z0-9]+/gi, "-");
    const safeTerm = data.termName.replace(/[^a-z0-9]+/gi, "-");

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="report-card-${safeName}-${safeTerm}.pdf"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Could not generate report card" }, { status: 500 });
  }
}
