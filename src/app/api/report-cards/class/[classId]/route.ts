import PDFDocument from "pdfkit";
import { NextResponse, type NextRequest } from "next/server";
import { requireRequestUser } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { applyTenantFilter } from "@/lib/server/tenant";
import { getTermInfo, buildReportCardData, buildClassStats, listClassRosterForSession, loadGradingConfig } from "@/lib/server/reportCards";
import { drawReportCardPage } from "@/lib/server/reportCardPdf";
import { getSchoolProfile, loadLogoBuffer } from "@/lib/server/schoolProfile";

// Bulk export: one combined PDF with every student in the class for the
// term's session (enrollment-aware), one page each. Staff only.
export async function GET(req: NextRequest, ctx: { params: Promise<{ classId: string }> }) {
  const auth = await requireRequestUser(req, { roles: ["admin", "teacher"] });
  if (!auth.ok) return auth.response;

  const { classId } = await ctx.params;
  const termId = req.nextUrl.searchParams.get("termId") || "";

  if (!termId) {
    return NextResponse.json({ error: "termId is required" }, { status: 400 });
  }

  const term = await getTermInfo(termId, auth.ctx.tenant);
  if (!term) {
    return NextResponse.json({ error: "Term not found" }, { status: 404 });
  }

  let classQuery = supabaseAdmin.from("classes").select("id, name").eq("id", classId);
  classQuery = applyTenantFilter(classQuery, auth.ctx.tenant);
  const { data: classRow, error: classError } = await classQuery.maybeSingle();
  if (classError || !classRow) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  const roster = await listClassRosterForSession(classId, term.session_id, auth.ctx.tenant);
  if (roster.length === 0) {
    return NextResponse.json({ error: "This class has no students for that session" }, { status: 404 });
  }

  try {
    const [school, classStats, grading] = await Promise.all([
      getSchoolProfile(auth.ctx.tenant),
      buildClassStats(classId, term.id, auth.ctx.tenant),
      loadGradingConfig(auth.ctx.tenant),
    ]);
    const logoBuffer = await loadLogoBuffer(school.logoUrl);

    const doc = new PDFDocument({ margin: 40 });
    const chunks: Buffer[] = [];
    const bufferPromise = new Promise<Buffer>((resolve, reject) => {
      doc.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });

    let pagesDrawn = 0;
    for (const row of roster) {
      const data = await buildReportCardData(row.id, term, auth.ctx.tenant, classStats, grading);
      if (!data) continue;

      if (pagesDrawn > 0) doc.addPage();
      drawReportCardPage(doc, school, logoBuffer, data);
      pagesDrawn += 1;
    }

    if (pagesDrawn === 0) {
      doc.text("No students in this class could be matched to a report card.");
    }

    doc.end();
    const buffer = await bufferPromise;

    const safeClass = String((classRow as any).name || "class").replace(/[^a-z0-9]+/gi, "-");
    const safeTerm = term.name.replace(/[^a-z0-9]+/gi, "-");

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="report-cards-${safeClass}-${safeTerm}.pdf"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Could not generate report cards" }, { status: 500 });
  }
}
