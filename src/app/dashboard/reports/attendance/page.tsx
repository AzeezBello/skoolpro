"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import toast from "react-hot-toast";

export default function AttendanceReport() {
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [records, setRecords] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    const { data } = await supabase.from("classes").select("id, name");
    setClasses(data || []);
  };

  const fetchReport = async () => {
    if (!selectedClass || !dateRange.start || !dateRange.end)
      return toast.error("Please select all filters");

    const { data, error } = await supabase
      .from("attendance")
      .select(`date, status, students(full_name), class_id`)
      .eq("class_id", selectedClass)
      .gte("date", dateRange.start)
      .lte("date", dateRange.end);

    if (error) return toast.error(error.message);
    setRecords(data || []);
  };

  const exportToExcel = () => {
    const formatted = records.map((r) => ({
      Date: r.date,
      Student: r.students?.full_name,
      Status: r.status,
    }));

    const ws = XLSX.utils.json_to_sheet(formatted);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");
    XLSX.writeFile(wb, "attendance_report.xlsx");
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text("Attendance Report", 14, 15);
    const tableData = records.map((r) => [r.date, r.students?.full_name, r.status]);
    autoTable(doc, {
      head: [["Date", "Student", "Status"]],
      body: tableData,
      startY: 20,
    });
    doc.save("attendance_report.pdf");
  };

  return (
    <div className="p-8 bg-gray-900 text-white min-h-screen">
      <h1 className="text-3xl font-semibold mb-6">Attendance Reports</h1>

      <div className="flex gap-4 mb-6">
        <select
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          className="bg-gray-800 p-2 rounded"
        >
          <option value="">Select Class</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <input
          type="date"
          value={dateRange.start}
          onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
          className="bg-gray-800 p-2 rounded"
        />
        <input
          type="date"
          value={dateRange.end}
          onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
          className="bg-gray-800 p-2 rounded"
        />

        <button
          onClick={fetchReport}
          className="bg-green-600 px-4 py-2 rounded hover:bg-green-700"
        >
          Generate
        </button>
      </div>

      <table className="w-full bg-gray-800 rounded text-sm">
        <thead className="bg-gray-700">
          <tr>
            <th className="p-2">Date</th>
            <th className="p-2">Student</th>
            <th className="p-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r, i) => (
            <tr key={i} className="border-b border-gray-700">
              <td className="p-2">{r.date}</td>
              <td className="p-2">{r.students?.full_name}</td>
              <td className="p-2">{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {records.length > 0 && (
        <div className="flex gap-4 mt-6">
          <button onClick={exportToPDF} className="bg-blue-600 px-4 py-2 rounded hover:bg-blue-700">
            Export PDF
          </button>
          <button onClick={exportToExcel} className="bg-yellow-600 px-4 py-2 rounded hover:bg-yellow-700">
            Export Excel
          </button>
        </div>
      )}
    </div>
  );
}
