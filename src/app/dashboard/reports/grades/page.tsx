"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import toast from "react-hot-toast";

export default function GradesReport() {
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedTerm, setSelectedTerm] = useState<string>("First Term");
  const [records, setRecords] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("classes").select("id, name").then(({ data }) => setClasses(data || []));
  }, []);

  const fetchReport = async () => {
    if (!selectedClass || !selectedTerm) {
      toast.error("Select a class and term");
      return;
    }

    const { data, error } = await supabase
      .from("grades")
      .select("subject, score, term, students(full_name), classes(name)")
      .eq("class_id", selectedClass)
      .eq("term", selectedTerm);

    if (error) {
      toast.error(error.message);
      return;
    }
    setRecords(data || []);
  };

  const exportToExcel = () => {
    const formatted = records.map((r) => ({
      Subject: r.subject,
      Score: r.score,
      Student: r.students?.full_name,
      Term: r.term,
      Class: r.classes?.name,
    }));
    const ws = XLSX.utils.json_to_sheet(formatted);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Grades");
    XLSX.writeFile(wb, "grades_report.xlsx");
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text("Grades Report", 14, 15);
    const tableData = records.map((r) => [r.subject, r.score, r.students?.full_name, r.term]);
    doc.autoTable({
      head: [["Subject", "Score", "Student", "Term"]],
      body: tableData,
      startY: 20,
    });
    doc.save("grades_report.pdf");
  };

  return (
    <div className="min-h-screen bg-gray-900 p-8 text-white">
      <h1 className="mb-6 text-3xl font-semibold">Grades Reports</h1>

      <div className="mb-6 flex flex-wrap gap-3">
        <select
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          className="rounded bg-gray-800 p-2"
        >
          <option value="">Select Class</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={selectedTerm}
          onChange={(e) => setSelectedTerm(e.target.value)}
          className="rounded bg-gray-800 p-2"
        >
          <option value="First Term">First Term</option>
          <option value="Second Term">Second Term</option>
          <option value="Third Term">Third Term</option>
        </select>

        <button onClick={fetchReport} className="rounded bg-green-600 px-4 py-2 hover:bg-green-700">
          Generate
        </button>
      </div>

      <table className="w-full rounded bg-gray-800 text-sm">
        <thead className="bg-gray-700">
          <tr>
            <th className="p-2 text-left">Subject</th>
            <th className="p-2 text-left">Score</th>
            <th className="p-2 text-left">Student</th>
            <th className="p-2 text-left">Term</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r, idx) => (
            <tr key={idx} className="border-b border-gray-700">
              <td className="p-2">{r.subject}</td>
              <td className="p-2">{r.score}</td>
              <td className="p-2">{r.students?.full_name}</td>
              <td className="p-2">{r.term}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {records.length > 0 && (
        <div className="mt-6 flex gap-3">
          <button onClick={exportToPDF} className="rounded bg-blue-600 px-4 py-2 hover:bg-blue-700">
            Export PDF
          </button>
          <button onClick={exportToExcel} className="rounded bg-yellow-600 px-4 py-2 hover:bg-yellow-700">
            Export Excel
          </button>
        </div>
      )}
    </div>
  );
}
