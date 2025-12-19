"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import toast from "react-hot-toast";

export default function TeacherDashboard() {
  const [teacher, setTeacher] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [grades, setGrades] = useState<Record<string, string>>({});
  const [subject, setSubject] = useState("");
  const [date, setDate] = useState<string>("");

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return toast.error("Please login again.");

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, related_id")
      .eq("id", userId)
      .maybeSingle();

    if (!profile || profile.role !== "teacher") {
      toast.error("You need a teacher profile to view this page.");
      return;
    }

    const teacherId = profile.related_id || userId;
    const { data: teacherData, error } = await supabase
      .from("teachers")
      .select("id, full_name, subject, classes(id, name, students(*))")
      .eq("id", teacherId)
      .single();

    if (error) {
      toast.error(error.message);
      return;
    }

    setTeacher(teacherData);
    setStudents(teacherData?.classes?.students || []);
    setDate(new Date().toISOString().split("T")[0]);
  };

  const submitAttendance = async () => {
    const records = Object.entries(attendance).map(([student_id, status]) => ({
      student_id,
      date,
      status,
    }));
    const { error } = await supabase.from("attendance").insert(records);
    if (error) toast.error(error.message);
    else toast.success("Attendance saved!");
  };

  const submitGrades = async () => {
    if (!subject) return toast.error("Enter subject");
    const records = Object.entries(grades).map(([student_id, score]) => ({
      student_id,
      subject,
      score: parseFloat(score),
      term: "First Term",
    }));
    const { error } = await supabase.from("grades").insert(records);
    if (error) toast.error(error.message);
    else toast.success("Grades saved!");
  };

  return (
    <div className="p-8 bg-gray-900 text-white min-h-screen">
      <h1 className="text-3xl font-semibold mb-4">Teacher Dashboard</h1>
      {teacher ? (
        <>
          <p className="text-lg text-gray-300 mb-4">
            Welcome, {teacher.full_name} ({teacher.subject})
          </p>
          <p className="text-gray-400 mb-6">Class: {teacher.classes?.name || "Unassigned"}</p>

          <h2 className="text-2xl font-semibold mb-2">Mark Attendance</h2>
          <table className="w-full mb-6">
            <thead>
              <tr className="bg-gray-700">
                <th className="p-2">Student</th>
                <th className="p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="border-b border-gray-700">
                  <td className="p-2">{s.full_name}</td>
                  <td className="p-2">
                    <select
                      value={attendance[s.id] || ""}
                      onChange={(e) => setAttendance({ ...attendance, [s.id]: e.target.value })}
                      className="bg-gray-700 p-1 rounded"
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
          <button onClick={submitAttendance} className="bg-green-600 px-4 py-2 rounded hover:bg-green-700">
            Save Attendance
          </button>

          <h2 className="text-2xl font-semibold mt-10 mb-2">Record Grades</h2>
          <input
            type="text"
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="p-2 bg-gray-700 rounded mb-4"
          />
          <table className="w-full mb-4">
            <thead>
              <tr className="bg-gray-700">
                <th className="p-2">Student</th>
                <th className="p-2">Score</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="border-b border-gray-700">
                  <td className="p-2">{s.full_name}</td>
                  <td className="p-2">
                    <input
                      type="number"
                      value={grades[s.id] || ""}
                      onChange={(e) => setGrades({ ...grades, [s.id]: e.target.value })}
                      className="w-20 bg-gray-700 p-1 rounded"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={submitGrades} className="bg-blue-600 px-4 py-2 rounded hover:bg-blue-700">
            Save Grades
          </button>
        </>
      ) : (
        <p>Loading...</p>
      )}
    </div>
  );
}
