// Grading is configurable per school (schools.grading_config). These are the
// defaults: the common Nigerian CA (0-40) + Exam (0-60) = 100 split with a
// WAEC-style letter scale.
export type GradeBand = { min: number; grade: string; remark?: string };
export type GradingConfig = { ca_max: number; exam_max: number; scale: GradeBand[] };

export const DEFAULT_GRADING: GradingConfig = {
  ca_max: 40,
  exam_max: 60,
  scale: [
    { min: 70, grade: "A", remark: "Excellent" },
    { min: 60, grade: "B", remark: "Very good" },
    { min: 50, grade: "C", remark: "Good" },
    { min: 45, grade: "D", remark: "Pass" },
    { min: 40, grade: "E", remark: "Weak pass" },
    { min: 0, grade: "F", remark: "Fail" },
  ],
};

export const CA_MAX = DEFAULT_GRADING.ca_max;
export const EXAM_MAX = DEFAULT_GRADING.exam_max;

export function parseGradingConfig(raw: unknown): GradingConfig {
  if (!raw || typeof raw !== "object") return DEFAULT_GRADING;
  const r = raw as Record<string, unknown>;
  const caMax = Number(r.ca_max);
  const examMax = Number(r.exam_max);
  const scale = Array.isArray(r.scale)
    ? (r.scale as unknown[])
        .map((b: any) => ({ min: Number(b?.min), grade: String(b?.grade || "").trim(), remark: typeof b?.remark === "string" ? b.remark : undefined }))
        .filter((b) => Number.isFinite(b.min) && b.grade)
        .sort((a, b) => b.min - a.min)
    : [];
  return {
    ca_max: Number.isFinite(caMax) && caMax > 0 ? caMax : DEFAULT_GRADING.ca_max,
    exam_max: Number.isFinite(examMax) && examMax >= 0 ? examMax : DEFAULT_GRADING.exam_max,
    scale: scale.length ? scale : DEFAULT_GRADING.scale,
  };
}

export function getLetterGrade(total: number, config: GradingConfig | GradeBand[] = DEFAULT_GRADING): string {
  const scale = Array.isArray(config) ? config : config.scale;
  const band = scale.find((b) => total >= b.min);
  return band?.grade ?? scale[scale.length - 1]?.grade ?? "F";
}

export function getGradeRemark(total: number, config: GradingConfig = DEFAULT_GRADING): string | undefined {
  return config.scale.find((b) => total >= b.min)?.remark;
}

// Terms are real database rows; this is just a quick-fill convenience when
// an admin creates a term.
export const TERM_NAME_SUGGESTIONS = ["First Term", "Second Term", "Third Term"] as const;
