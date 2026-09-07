import { supabaseAdmin } from "@/lib/supabaseServer";
import { applyTenantFilter, type TenantContext } from "@/lib/server/tenant";
import { getLetterGrade, parseGradingConfig, type GradingConfig } from "@/lib/grading";

export type ReportCardResultRow = {
  subject: string;
  ca: number | null;
  exam: number | null;
  total: number | null;
  grade: string | null;
  position: number | null;
  classAverage: number | null;
};

export type TermInfo = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  session_id: string | null;
  sessions?: { name?: string } | null;
};

export type ReportCardData = {
  student: { id: string; full_name: string; admission_number?: string | null };
  className: string | undefined;
  classId: string | null;
  sessionName: string | undefined;
  termName: string;
  results: ReportCardResultRow[];
  average: number | null;
  overallPosition: number | null;
  classSize: number | null;
  attendanceRate: number | null;
  attendanceScopeLabel: string;
};

export async function getTermInfo(termId: string, tenant: TenantContext | null): Promise<TermInfo | null> {
  let termQuery = supabaseAdmin
    .from("terms")
    .select("id, name, start_date, end_date, session_id, sessions(name)")
    .eq("id", termId);
  termQuery = applyTenantFilter(termQuery, tenant);
  const { data } = await termQuery.maybeSingle();
  return (data as any) || null;
}

/**
 * The class a student belonged to for a given session: the enrollment record
 * when one exists, otherwise the student's current class. Past-session report
 * cards previously always printed the current class.
 */
export async function resolveStudentClassForSession(
  studentId: string,
  sessionId: string | null,
  tenant: TenantContext | null
): Promise<{ classId: string | null; className: string | undefined }> {
  if (sessionId) {
    let enrollQuery = supabaseAdmin
      .from("student_enrollments")
      .select("class_id, classes(name)")
      .eq("student_id", studentId)
      .eq("session_id", sessionId);
    enrollQuery = applyTenantFilter(enrollQuery, tenant);
    const { data: enrollment } = await enrollQuery.maybeSingle();
    if (enrollment?.class_id) {
      return { classId: enrollment.class_id, className: (enrollment as any).classes?.name };
    }
  }

  let studentQuery = supabaseAdmin.from("students").select("class_id, classes(name)").eq("id", studentId);
  studentQuery = applyTenantFilter(studentQuery, tenant);
  const { data: student } = await studentQuery.maybeSingle();
  return { classId: student?.class_id ?? null, className: (student as any)?.classes?.name };
}

/** Students in a class for a session (enrollment-aware, falls back to current roster). */
export async function listClassRosterForSession(classId: string, sessionId: string | null, tenant: TenantContext | null) {
  if (sessionId) {
    let enrollQuery = supabaseAdmin
      .from("student_enrollments")
      .select("student_id, students(id, full_name)")
      .eq("class_id", classId)
      .eq("session_id", sessionId);
    enrollQuery = applyTenantFilter(enrollQuery, tenant);
    const { data } = await enrollQuery;
    const rows = (data || [])
      .map((r: any) => r.students)
      .filter(Boolean)
      .sort((a: any, b: any) => String(a.full_name).localeCompare(String(b.full_name)));
    if (rows.length > 0) return rows as Array<{ id: string; full_name: string }>;
  }

  let studentsQuery = supabaseAdmin
    .from("students")
    .select("id, full_name")
    .eq("class_id", classId)
    .eq("status", "active")
    .order("full_name");
  studentsQuery = applyTenantFilter(studentsQuery, tenant);
  const { data } = await studentsQuery;
  return (data || []) as Array<{ id: string; full_name: string }>;
}

type ClassStats = {
  bySubject: Map<string, { totals: number[]; }>;
  overallAverages: Map<string, number>;
};

// Per-class, per-term aggregates used for subject positions, class averages
// and the overall position. Computed once per class so a bulk export doesn't
// re-query per student.
export async function buildClassStats(classId: string | null, termId: string, tenant: TenantContext | null): Promise<ClassStats> {
  const stats: ClassStats = { bySubject: new Map(), overallAverages: new Map() };
  if (!classId) return stats;

  let query = supabaseAdmin
    .from("results")
    .select("student_id, subject_id, total_score")
    .eq("class_id", classId)
    .eq("term_id", termId);
  query = applyTenantFilter(query, tenant);
  const { data } = await query;

  const perStudent = new Map<string, number[]>();
  for (const row of data || []) {
    const total = Number(row.total_score ?? 0);
    const subj = stats.bySubject.get(row.subject_id) ?? { totals: [] };
    subj.totals.push(total);
    stats.bySubject.set(row.subject_id, subj);

    const arr = perStudent.get(row.student_id) ?? [];
    arr.push(total);
    perStudent.set(row.student_id, arr);
  }

  for (const [studentId, totals] of perStudent) {
    stats.overallAverages.set(studentId, totals.reduce((a, b) => a + b, 0) / totals.length);
  }

  return stats;
}

function rankOf(value: number, all: number[]) {
  // Standard competition ranking: ties share the higher position.
  return all.filter((v) => v > value).length + 1;
}

export async function loadGradingConfig(tenant: TenantContext | null): Promise<GradingConfig> {
  if (!tenant) return parseGradingConfig(null);
  const { data } = await supabaseAdmin.from("schools").select("grading_config").eq("id", tenant.value).maybeSingle();
  return parseGradingConfig(data?.grading_config);
}

export async function buildReportCardData(
  studentId: string,
  term: TermInfo,
  tenant: TenantContext | null,
  classStats?: ClassStats,
  grading?: GradingConfig
): Promise<ReportCardData | null> {
  const gradingConfig = grading ?? (await loadGradingConfig(tenant));
  let studentQuery = supabaseAdmin.from("students").select("id, full_name, admission_number").eq("id", studentId);
  studentQuery = applyTenantFilter(studentQuery, tenant);
  const { data: student, error: studentError } = await studentQuery.maybeSingle();
  if (studentError || !student) return null;

  const { classId, className } = await resolveStudentClassForSession(studentId, term.session_id, tenant);
  const stats = classStats ?? (await buildClassStats(classId, term.id, tenant));

  // Every subject assigned to the class appears on the card, even with no
  // score yet, so a missing entry is visible rather than silently omitted.
  let subjectsQuery = supabaseAdmin.from("class_subjects").select("subject_id, subjects(name)");
  if (classId) subjectsQuery = subjectsQuery.eq("class_id", classId);
  subjectsQuery = applyTenantFilter(subjectsQuery, tenant);
  const { data: classSubjects } = classId ? await subjectsQuery : { data: [] as any[] };

  let resultsQuery = supabaseAdmin
    .from("results")
    .select("subject_id, ca_score, exam_score, total_score, subjects(name)")
    .eq("student_id", studentId)
    .eq("term_id", term.id);
  resultsQuery = applyTenantFilter(resultsQuery, tenant);
  const { data: resultRows } = await resultsQuery;

  const resultBySubject = new Map<string, any>();
  for (const r of resultRows || []) resultBySubject.set(r.subject_id, r);

  const subjectIds = new Set<string>([
    ...(classSubjects || []).map((cs: any) => cs.subject_id),
    ...(resultRows || []).map((r: any) => r.subject_id),
  ]);

  const results: ReportCardResultRow[] = [];
  for (const subjectId of subjectIds) {
    const r = resultBySubject.get(subjectId);
    const cs = (classSubjects || []).find((c: any) => c.subject_id === subjectId);
    const name = r?.subjects?.name || cs?.subjects?.name || "-";
    const total = r ? Number(r.total_score ?? 0) : null;
    const subjStats = stats.bySubject.get(subjectId);
    results.push({
      subject: name,
      ca: r?.ca_score ?? null,
      exam: r?.exam_score ?? null,
      total,
      grade: total === null ? null : getLetterGrade(total, gradingConfig),
      position: total === null || !subjStats ? null : rankOf(total, subjStats.totals),
      classAverage: subjStats && subjStats.totals.length
        ? Math.round((subjStats.totals.reduce((a, b) => a + b, 0) / subjStats.totals.length) * 10) / 10
        : null,
    });
  }
  results.sort((a, b) => a.subject.localeCompare(b.subject));

  const scored = results.filter((r) => r.total !== null) as Array<ReportCardResultRow & { total: number }>;
  const average = scored.length ? scored.reduce((sum, r) => sum + r.total, 0) / scored.length : null;

  const overallAverages = Array.from(stats.overallAverages.values());
  const overallPosition = average === null || overallAverages.length === 0 ? null : rankOf(average, overallAverages);

  let attendanceQuery = supabaseAdmin.from("attendance").select("status").eq("student_id", studentId);
  attendanceQuery = applyTenantFilter(attendanceQuery, tenant);

  let attendanceScopeLabel = "Attendance rate (all recorded days)";
  if (term.start_date && term.end_date) {
    attendanceQuery = attendanceQuery.gte("date", term.start_date).lte("date", term.end_date);
    attendanceScopeLabel = "Attendance rate (this term)";
  }
  const { data: attendanceRows } = await attendanceQuery;

  let attendanceRate: number | null = null;
  if (attendanceRows && attendanceRows.length > 0) {
    const present = attendanceRows.filter((a: any) => ["present", "late"].includes(String(a.status).toLowerCase())).length;
    attendanceRate = Math.round((present / attendanceRows.length) * 100);
  }

  return {
    student: { id: student.id, full_name: (student as any).full_name, admission_number: (student as any).admission_number },
    className,
    classId,
    sessionName: term.sessions?.name,
    termName: term.name,
    results,
    average,
    overallPosition,
    classSize: overallAverages.length || null,
    attendanceRate,
    attendanceScopeLabel,
  };
}
