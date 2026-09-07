import type { ReportCardData } from "@/lib/server/reportCards";
import type { SchoolProfile } from "@/lib/server/schoolProfile";

// Draws one student's report card onto the current page of an already-open
// PDFDocument. Callers handle document creation/finalization, load the logo
// buffer once (school branding is the same for every student in a class
// export), and call doc.addPage() between invocations for multi-student runs.
export function drawReportCardPage(
  doc: PDFKit.PDFDocument,
  school: SchoolProfile,
  logoBuffer: Buffer | null,
  data: ReportCardData
) {
  const {
    student,
    className,
    sessionName,
    termName,
    results,
    average,
    overallPosition,
    classSize,
    attendanceRate,
    attendanceScopeLabel,
  } = data;

  if (logoBuffer) {
    try {
      doc.image(logoBuffer, 50, 30, { width: 70 });
    } catch {
      // Malformed/unsupported image data — skip the logo rather than fail
      // the whole document.
    }
  }

  const schoolTitle = school.establishedYear ? `${school.name} (Est. ${school.establishedYear})` : school.name;
  doc.fontSize(18).fillColor("#0A4D68").text(schoolTitle, 130, 35);
  if (school.motto) {
    doc.fontSize(10).fillColor("#555").text(school.motto, 130, doc.y);
  }
  if (school.address) {
    doc.fontSize(9).fillColor("#777").text(school.address, 130, doc.y);
  }
  doc.moveDown(2);
  doc.fontSize(14).fillColor("#000").text("Report Card", 50, doc.y, { align: "center", width: 500 });
  doc.moveDown(1);

  doc.fontSize(11).fillColor("#000");
  const infoY = doc.y;
  doc.text(`Student: ${student.full_name}`, 50, infoY);
  doc.text(`Class: ${className || "-"}`, 320, infoY);
  doc.text(`Admission No: ${student.admission_number || "-"}`, 50, doc.y);
  doc.text(`Session: ${sessionName || "-"}`, 320, doc.y - doc.currentLineHeight());
  doc.text(`Term: ${termName}`, 50, doc.y);
  doc.moveDown(1);

  const colX = { subject: 50, ca: 220, exam: 275, total: 335, grade: 395, avg: 445, pos: 510 };

  doc.fontSize(10).fillColor("#0A4D68");
  const headerY = doc.y;
  doc.text("Subject", colX.subject, headerY);
  doc.text("CA", colX.ca, headerY);
  doc.text("Exam", colX.exam, headerY);
  doc.text("Total", colX.total, headerY);
  doc.text("Grade", colX.grade, headerY);
  doc.text("Cls Avg", colX.avg, headerY);
  doc.text("Pos", colX.pos, headerY);
  doc.moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor("#cccccc").stroke();
  doc.moveDown(0.5);

  doc.fillColor("#000").fontSize(10);
  if (results.length === 0) {
    doc.text("No subjects or results recorded for this term yet.", 50, doc.y);
  } else {
    results.forEach((r) => {
      const rowY = doc.y;
      doc.text(r.subject, colX.subject, rowY, { width: 165 });
      doc.text(r.ca != null ? String(r.ca) : "-", colX.ca, rowY);
      doc.text(r.exam != null ? String(r.exam) : "-", colX.exam, rowY);
      doc.text(r.total != null ? String(r.total) : "-", colX.total, rowY);
      doc.text(r.grade ?? "-", colX.grade, rowY);
      doc.text(r.classAverage != null ? String(r.classAverage) : "-", colX.avg, rowY);
      doc.text(r.position != null ? ordinal(r.position) : "-", colX.pos, rowY);
      doc.moveDown(1);
    });
  }

  doc.moveDown(1);
  doc.fontSize(11);
  doc.text(`Overall average: ${average != null ? average.toFixed(1) : "-"}`, 50, doc.y);
  doc.text(
    `Position in class: ${overallPosition != null ? ordinal(overallPosition) : "-"}${classSize ? ` of ${classSize}` : ""}`,
    50,
    doc.y
  );
  doc.text(`${attendanceScopeLabel}: ${attendanceRate != null ? `${attendanceRate}%` : "-"}`, 50, doc.y);

  doc.moveDown(2);
  doc.fontSize(10).fillColor("#555");
  const signY = doc.y;
  doc.text("_______________________", 50, signY);
  doc.text("Class Teacher", 50, doc.y);
  doc.text("_______________________", 350, signY);
  doc.text(`${school.principalName || "Principal"}${school.principalName ? " — Principal" : ""}`, 350, doc.y - doc.currentLineHeight());
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}
