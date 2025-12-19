"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import toast from "react-hot-toast";

export default function StudentDashboard() {
  const [student, setStudent] = useState<any>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);

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

    if (!profile || profile.role !== "student") {
      toast.error("You need a student profile to view this page.");
      return;
    }

    const studentId = profile.related_id || userId;
    const { data: studentData, error } = await supabase
      .from("students")
      .select("*, classes(name, teachers(full_name))")
      .eq("id", studentId)
      .single();

    if (error) {
      toast.error(error.message);
      return;
    }

    setStudent(studentData);

    const { data: att } = await supabase.from("attendance").select("*").eq("student_id", studentId);
    const { data: grd } = await supabase.from("grades").select("*").eq("student_id", studentId);
    setAttendance(att || []);
    setGrades(grd || []);
  };

  return (
    <div className="p-8 bg-gray-900 text-white min-h-screen">
      {student ? (
        <>
          <h1 className="text-3xl font-semibold mb-4">Welcome, {student.full_name}</h1>
          <p className="text-gray-400 mb-6">
            Class: {student.classes?.name || "Unassigned"} <br />
            Teacher: {student.classes?.teachers?.full_name || "—"}
          </p>

          <h2 className="text-2xl font-semibold mb-3">Attendance</h2>
          <ul className="bg-gray-800 p-4 rounded mb-6">
            {attendance.map((a) => (
              <li key={a.id} className="border-b border-gray-700 p-2">
                {a.date}: {a.status}
              </li>
            ))}
          </ul>

          <h2 className="text-2xl font-semibold mb-3">Grades</h2>
          <table className="w-full bg-gray-800 rounded">
            <thead className="bg-gray-700">
              <tr>
                <th className="p-2">Subject</th>
                <th className="p-2">Score</th>
                <th className="p-2">Term</th>
              </tr>
            </thead>
            <tbody>
              {grades.map((g) => (
                <tr key={g.id} className="border-b border-gray-700">
                  <td className="p-2">{g.subject}</td>
                  <td className="p-2">{g.score}</td>
                  <td className="p-2">{g.term}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p>Loading...</p>
      )}
    </div>
  );
}
