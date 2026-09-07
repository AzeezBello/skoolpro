"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import toast from "react-hot-toast";
import { ClipboardList, FileText } from "lucide-react";
import { AttendanceSheet } from "@/components/dashboard/AttendanceSheet";
import { AnnouncementsPanel } from "@/components/dashboard/AnnouncementsPanel";
import { useT } from "@/components/i18n/LocaleProvider";

type ClassRow = { id: string; name: string; students?: Array<{ id: string }> };

export function TeacherSelfView() {
  const { t } = useT();
  const [teacher, setTeacher] = useState<any>(null);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void init();
  }, []);

  const init = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      toast.error("Please login again.");
      return;
    }

    const { data: profile } = await supabase.from("profiles").select("role, related_id").eq("id", userId).maybeSingle();
    if (!profile || profile.role !== "teacher") {
      toast.error("You need a teacher profile to view this page.");
      setLoading(false);
      return;
    }

    const teacherId = profile.related_id || userId;
    const { data: teacherData, error } = await supabase
      .from("teachers")
      .select("id, full_name, subject, classes(id, name, students(id))")
      .eq("id", teacherId)
      .maybeSingle();

    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!teacherData) {
      toast.error("Your login isn't linked to a teacher record yet. Ask your admin to link it under Team & Access.");
      return;
    }

    setTeacher(teacherData);
    setClasses(((teacherData as any).classes as ClassRow[]) || []);
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading...</p>;
  if (!teacher) return <p className="text-sm text-muted-foreground">No teacher record found.</p>;

  const totalStudents = classes.reduce((n, c) => n + (c.students?.length || 0), 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">{t("page.welcome", { name: teacher.full_name })}</h1>
        <p className="text-muted-foreground">
          {teacher.subject ? `${teacher.subject} · ` : ""}
          {classes.length} class{classes.length === 1 ? "" : "es"} · {totalStudents} student{totalStudents === 1 ? "" : "s"}
        </p>
      </div>

      <AnnouncementsPanel />

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/dashboard/results"
          data-tour="teacher-results-link"
          className="flex items-center gap-3 rounded-xl border border-border bg-card/80 p-4 transition hover:border-primary/60"
        >
          <ClipboardList size={20} className="text-primary" />
          <div>
            <p className="font-medium">Enter results</p>
            <p className="text-xs text-muted-foreground">CA and exam scores per subject and term</p>
          </div>
        </Link>
        <Link
          href="/dashboard/reports/grades"
          className="flex items-center gap-3 rounded-xl border border-border bg-card/80 p-4 transition hover:border-primary/60"
        >
          <FileText size={20} className="text-primary" />
          <div>
            <p className="font-medium">Reports &amp; report cards</p>
            <p className="text-xs text-muted-foreground">Class performance and printable report cards</p>
          </div>
        </Link>
      </div>

      <div data-tour="teacher-attendance-table">
        <AttendanceSheet classes={classes.map((c) => ({ id: c.id, name: c.name }))} title={t("page.attendance.mark")} />
      </div>
    </div>
  );
}
