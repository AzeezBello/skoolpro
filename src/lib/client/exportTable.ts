"use client";

// Client-side table exports. CSV needs no library; XLSX uses exceljs (the
// previous `xlsx` package has unpatched prototype-pollution advisories); PDF
// uses jspdf-autotable.
export type ExportColumn<T> = { header: string; value: (row: T) => string | number | null | undefined };

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function cell(v: unknown) {
  if (v === null || v === undefined) return "";
  return String(v);
}

export function exportCsv<T>(rows: T[], columns: ExportColumn<T>[], filename: string) {
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const lines = [columns.map((c) => esc(c.header)).join(",")];
  for (const row of rows) lines.push(columns.map((c) => esc(cell(c.value(row)))).join(","));
  triggerDownload(new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" }), filename);
}

export async function exportXlsx<T>(rows: T[], columns: ExportColumn<T>[], filename: string, sheetName = "Sheet1") {
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  ws.columns = columns.map((c) => ({ header: c.header, key: c.header, width: Math.max(12, c.header.length + 2) }));
  ws.getRow(1).font = { bold: true };
  for (const row of rows) {
    ws.addRow(Object.fromEntries(columns.map((c) => [c.header, c.value(row) ?? ""])));
  }
  const buffer = await wb.xlsx.writeBuffer();
  triggerDownload(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename);
}

export async function exportPdf<T>(rows: T[], columns: ExportColumn<T>[], filename: string, title: string, subtitle?: string) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text(title, 14, 15);
  if (subtitle) {
    doc.setFontSize(10);
    doc.text(subtitle, 14, 21);
  }
  autoTable(doc, {
    head: [columns.map((c) => c.header)],
    body: rows.map((r) => columns.map((c) => cell(c.value(r)))),
    startY: subtitle ? 26 : 20,
    styles: { fontSize: 9 },
  });
  doc.save(filename);
}
