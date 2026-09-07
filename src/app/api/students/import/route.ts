import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireRequestUser } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { recordAudit } from "@/lib/server/audit";

const rowSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().optional().or(z.literal("")),
  admission_number: z.string().trim().max(40).optional().or(z.literal("")),
  class_name: z.string().trim().max(80).optional().or(z.literal("")),
  gender: z.enum(["male", "female", "other"]).optional().or(z.literal("")),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  parent_name: z.string().trim().max(120).optional().or(z.literal("")),
  parent_email: z.string().trim().email().optional().or(z.literal("")),
  parent_phone: z.string().trim().max(30).optional().or(z.literal("")),
});

const bodySchema = z.object({ rows: z.array(z.record(z.string(), z.unknown())).min(1).max(2000) });

// Bulk student import from CSV rows parsed client-side. Classes are matched
// by name (case-insensitive) and created when missing. Rows with an existing
// admission number in this school are updated instead of duplicated.
export async function POST(req: NextRequest) {
  const auth = await requireRequestUser(req, { roles: ["admin"] });
  if (!auth.ok) return auth.response;

  const parsedBody = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsedBody.success) return NextResponse.json({ error: "rows[] is required (max 2000)" }, { status: 400 });

  const schoolId = auth.ctx.tenant!.value;
  const errors: Array<{ row: number; message: string }> = [];
  const valid: Array<z.infer<typeof rowSchema> & { row: number }> = [];

  parsedBody.data.rows.forEach((raw, i) => {
    const normalized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) normalized[k.trim().toLowerCase().replace(/\s+/g, "_")] = typeof v === "string" ? v.trim() : v;
    if (typeof normalized.gender === "string") normalized.gender = normalized.gender.toLowerCase();
    const parsed = rowSchema.safeParse(normalized);
    if (!parsed.success) errors.push({ row: i + 1, message: parsed.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ") });
    else valid.push({ ...parsed.data, row: i + 1 });
  });

  if (valid.length === 0) return NextResponse.json({ error: "No valid rows", errors }, { status: 400 });

  const { data: classRows } = await supabaseAdmin.from("classes").select("id, name").eq("school_id", schoolId);
  const classByName = new Map((classRows || []).map((c: any) => [String(c.name).toLowerCase(), c.id as string]));

  const wanted = new Set(valid.map((r) => (r.class_name || "").toLowerCase()).filter(Boolean));
  for (const name of wanted) {
    if (classByName.has(name)) continue;
    const original = valid.find((r) => (r.class_name || "").toLowerCase() === name)!.class_name!;
    const { data: created } = await supabaseAdmin.from("classes").insert([{ name: original, school_id: schoolId }]).select("id").single();
    if (created) classByName.set(name, created.id);
  }

  const admissionNumbers = valid.map((r) => r.admission_number).filter(Boolean) as string[];
  const { data: existing } = admissionNumbers.length
    ? await supabaseAdmin.from("students").select("id, admission_number").eq("school_id", schoolId).in("admission_number", admissionNumbers)
    : { data: [] as any[] };
  const existingByAdm = new Map((existing || []).map((s: any) => [String(s.admission_number).toLowerCase(), s.id as string]));

  let inserted = 0;
  let updated = 0;
  const inserts: any[] = [];

  for (const r of valid) {
    const payload = {
      full_name: r.full_name,
      email: r.email || null,
      admission_number: r.admission_number || null,
      class_id: r.class_name ? classByName.get(r.class_name.toLowerCase()) || null : null,
      gender: r.gender || null,
      date_of_birth: r.date_of_birth || null,
      parent_name: r.parent_name || null,
      parent_email: r.parent_email || null,
      parent_phone: r.parent_phone || null,
      school_id: schoolId,
    };
    const existingId = r.admission_number ? existingByAdm.get(r.admission_number.toLowerCase()) : undefined;
    if (existingId) {
      const { error } = await supabaseAdmin.from("students").update(payload).eq("id", existingId);
      if (error) errors.push({ row: r.row, message: error.message });
      else updated += 1;
    } else {
      inserts.push(payload);
    }
  }

  for (let i = 0; i < inserts.length; i += 200) {
    const chunk = inserts.slice(i, i + 200);
    const { error } = await supabaseAdmin.from("students").insert(chunk);
    if (error) errors.push({ row: 0, message: `Batch insert failed: ${error.message}` });
    else inserted += chunk.length;
  }

  await recordAudit({ schoolId, actorId: auth.ctx.userId, actorEmail: auth.ctx.email, action: "students.imported", entityType: "students", details: { inserted, updated, failed: errors.length } });

  return NextResponse.json({ inserted, updated, errors });
}
