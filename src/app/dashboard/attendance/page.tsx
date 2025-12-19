"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import toast from "react-hot-toast";

interface Student {
  id: string;
  full_name: string;
}

export default function AttendancePage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [tab, setTab] = useState<"attendance" | "grades">("attendance");
  const [date, setDate] = useState<string>("");
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [grades, setGrades] = useState<Record<string, string>>({});
  const [subject, setSubject] = useState("");

  useEffect(() => {
    fetchStudents();
    setDate(new Date().toISOString().split("T")[0]);
  }, []);

  const fetchStudents = async () => {
    const { data, error } = await supabase.from("students").select("id, full_name");
    if (error) toast.error(error.message);
    else setStudents(data || []);
  };

  const submitAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    const records = Object.entries(attendance).map(([student_id, status]) => ({
      student_id,
      date,
      status,
    }));
    const { error } = await supabase.from("attendance").insert(records);
    if (error) toast.error(error.message);
    else toast.success("Attendance recorded!");
  };

  const submitGrades = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject) return toast.error("Enter subject");
    const records = Object.entries(grades).map(([student_id, score]) => ({
      student_id,
      subject,
      score: parseFloat(score),
      term: "First Term",
    }));
    const { error } = await supabase.from("grades").insert(records);
    if (error) toast.error(error.message);
    else toast.success("Grades recorded!");
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Attendance & Grades</h1>

      <div className="flex gap-3">
        <button
          onClick={() => setTab("attendance")}
          className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
            tab === "attendance" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
          }`}
        >
          Attendance
        </button>
        <button
          onClick={() => setTab("grades")}
          className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
            tab === "grades" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
          }`}
        >
          Grades
        </button>
      </div>

      {tab === "attendance" && (
        <form onSubmit={submitAttendance} className="rounded-xl border border-border bg-card/80 p-6 shadow-soft">
          <label className="block mb-3 text-sm">
            <span className="text-muted-foreground">Date:</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="ml-2 rounded border border-input bg-background px-3 py-2 text-sm"
            />
          </label>
          <table className="mt-4 w-full text-left">
            <thead>
              <tr>
                <th className="p-2">Student</th>
                <th className="p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td className="p-2 text-sm">{s.full_name}</td>
                  <td className="p-2">
                    <select
                      value={attendance[s.id] || ""}
                      onChange={(e) => setAttendance({ ...attendance, [s.id]: e.target.value })}
                      className="rounded border border-input bg-background px-2 py-2 text-sm"
                    >
                      <option value="">—</option>
                      <option value="Present">Present</option>
                      <option value="Absent">Absent</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="mt-6 rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90">
            Save Attendance
          </button>
        </form>
      )}

      {tab === "grades" && (
        <form onSubmit={submitGrades} className="rounded-xl border border-border bg-card/80 p-6 shadow-soft">
          <input
            type="text"
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mb-4 w-full rounded border border-input bg-background p-2 text-sm"
          />
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className="p-2">Student</th>
                <th className="p-2">Score</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td className="p-2 text-sm">{s.full_name}</td>
                  <td className="p-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={grades[s.id] || ""}
                      onChange={(e) => setGrades({ ...grades, [s.id]: e.target.value })}
                      className="w-20 rounded border border-input bg-background p-2 text-sm"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="mt-6 rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90">
            Save Grades
          </button>
        </form>
      )}
    </div>
  );
}
