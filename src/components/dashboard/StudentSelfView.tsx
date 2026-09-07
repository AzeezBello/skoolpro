"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import toast from "react-hot-toast";
import { CalendarCheck, Download, GraduationCap } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { authFetch } from "@/lib/client/authFetch";
import { getLetterGrade } from "@/lib/grading";
import { AnnouncementsPanel } from "@/components/dashboard/AnnouncementsPanel";
import { useSchoolSettings } from "@/lib/hooks/useSchoolSettings";
import { useT } from "@/components/i18n/LocaleProvider";

interface TermOption {
  id: string;
  name: string;
  session_id: string;
  sessions?: { name?: string; is_current?: boolean } | null;
}

export function StudentSelfView() {
  const { t } = useT();
  const [student, setStudent] = useState<any>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [terms, setTerms] = useState<TermOption[]>([]);
  const [termId, setTermId] = useState<string>("");
  const [results, setResults] = useState<any[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const { settings } = useSchoolSettings();

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    if (studentId && termId) fetchResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, termId]);

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

    const id = profile.related_id || userId;
    const { data: studentData, error } = await supabase
      .from("students")
      .select("*, classes(name, teachers(full_name))")
      .eq("id", id)
      .single();

    if (error) {
      toast.error(error.message);
      return;
    }

    setStudent(studentData);
    setStudentId(id);

    const { data: att } = await supabase.from("attendance").select("*").eq("student_id", id);
    setAttendance(att || []);

    const { data: termData } = await supabase
      .from("terms")
      .select("id, name, session_id, sessions(name, is_current)")
      .order("start_date", { ascending: false });

    const termList: TermOption[] = (termData as any) || [];
    setTerms(termList);

    const currentSessionTerm = termList.find((t) => t.sessions?.is_current);
    setTermId(currentSessionTerm?.id || termList[0]?.id || "");
  };

  const fetchResults = async () => {
    if (!studentId || !termId) return;
    setResultsLoading(true);
    const { data, error } = await supabase
      .from("results")
      .select("ca_score, exam_score, total_score, subjects(name)")
      .eq("student_id", studentId)
      .eq("term_id", termId);
    setResultsLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setResults(data || []);
  };

  const downloadReportCard = async () => {
    if (!studentId || !termId) return;
    setDownloading(true);
    try {
      const res = await authFetch(`/api/report-cards/${studentId}?termId=${encodeURIComponent(termId)}`);
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        toast.error(payload?.error || "Could not fetch report card");
        return;
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch {
      toast.error("Failed to download report card");
    } finally {
      setDownloading(false);
    }
  };

  const selectedTermLabel = terms.find((t) => t.id === termId)?.name || "this term";

  return (
    <div className="space-y-2">
      {student ? (
        <>
          <h1 className="text-3xl font-semibold mb-4">{t("page.welcome", { name: student.full_name })}</h1>
          <p data-tour="student-class-info" className="text-gray-400 mb-6">
            Class: {student.classes?.name || "Unassigned"} <br />
            Teacher: {student.classes?.teachers?.full_name || "—"}
          </p>

          <AnnouncementsPanel />

          <h2 className="text-2xl font-semibold mb-3 mt-6">Attendance</h2>
          {attendance.length === 0 ? (
            <EmptyState
              icon={<CalendarCheck size={20} />}
              title="No attendance recorded yet"
              description="Once your teacher marks attendance, it will show up here."
              className="mb-6"
            />
          ) : (
            <ul data-tour="student-attendance" className="bg-gray-800 p-4 rounded mb-6">
              {attendance.map((a) => (
                <li key={a.id} className="border-b border-gray-700 p-2">
                  {a.date}: {a.status}
                </li>
              ))}
            </ul>
          )}

          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold">Results</h2>
            <div className="flex items-center gap-2">
              <select
                value={termId}
                onChange={(e) => setTermId(e.target.value)}
                className="rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm"
              >
                {terms.length === 0 && <option value="">No terms yet</option>}
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.sessions?.name ? `${t.sessions.name} — ${t.name}` : t.name}
                  </option>
                ))}
              </select>
              <button
                onClick={downloadReportCard}
                disabled={downloading || !termId}
                className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
              >
                <Download size={14} />
                {downloading ? "Preparing..." : "Report card"}
              </button>
            </div>
          </div>

          {!termId ? (
            <EmptyState
              icon={<GraduationCap size={20} />}
              title="No terms set up yet"
              description="Your school hasn't created any academic terms yet."
            />
          ) : resultsLoading ? (
            <p className="text-sm text-gray-400">Loading...</p>
          ) : results.length === 0 ? (
            <EmptyState
              icon={<GraduationCap size={20} />}
              title="No results recorded yet"
              description={`Once your teacher enters scores for ${selectedTermLabel}, they'll show up here.`}
            />
          ) : (
            <table data-tour="student-grades" className="w-full bg-gray-800 rounded">
              <thead className="bg-gray-700">
                <tr>
                  <th className="p-2">Subject</th>
                  <th className="p-2">CA</th>
                  <th className="p-2">Exam</th>
                  <th className="p-2">Total</th>
                  <th className="p-2">Grade</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r: any, i: number) => (
                  <tr key={i} className="border-b border-gray-700">
                    <td className="p-2">{r.subjects?.name || "-"}</td>
                    <td className="p-2">{r.ca_score ?? "-"}</td>
                    <td className="p-2">{r.exam_score ?? "-"}</td>
                    <td className="p-2">{r.total_score}</td>
                    <td className="p-2">{getLetterGrade(Number(r.total_score), settings.grading)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      ) : (
        <p>Loading...</p>
      )}
    </div>
  );
}
