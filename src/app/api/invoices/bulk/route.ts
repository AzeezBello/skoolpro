import { randomUUID } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requireRequestUser } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { applyTenantFilter } from "@/lib/server/tenant";
import { recordAudit } from "@/lib/server/audit";

// Bulk invoicing: one invoice per (student, fee item) for every active
// student in a class (or the whole school). Skips combinations that already
// have an open invoice for that fee item so re-running is safe.
export async function POST(req: NextRequest) {
  const auth = await requireRequestUser(req, { roles: ["admin"] });
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const classId = typeof body?.class_id === "string" && body.class_id ? body.class_id : null;
  const feeItemIds: string[] = Array.isArray(body?.fee_item_ids) ? body.fee_item_ids.filter((x: unknown) => typeof x === "string") : [];
  const dueDateRaw = typeof body?.due_date === "string" ? body.due_date : "";

  if (feeItemIds.length === 0) return NextResponse.json({ error: "Select at least one fee item" }, { status: 400 });
  const dueDate = dueDateRaw ? new Date(dueDateRaw) : null;
  if (dueDateRaw && Number.isNaN(dueDate?.getTime())) return NextResponse.json({ error: "Invalid due_date" }, { status: 400 });

  const schoolId = auth.ctx.tenant!.value;

  let feeQuery = supabaseAdmin.from("fee_items").select("id, name, amount").in("id", feeItemIds);
  feeQuery = applyTenantFilter(feeQuery, auth.ctx.tenant);
  const { data: feeItems } = await feeQuery;
  if (!feeItems || feeItems.length !== feeItemIds.length) {
    return NextResponse.json({ error: "One or more fee items were not found" }, { status: 404 });
  }

  let studentsQuery = supabaseAdmin.from("students").select("id").eq("status", "active");
  if (classId) studentsQuery = studentsQuery.eq("class_id", classId);
  studentsQuery = applyTenantFilter(studentsQuery, auth.ctx.tenant);
  const { data: students } = await studentsQuery;
  if (!students || students.length === 0) return NextResponse.json({ error: "No active students found" }, { status: 404 });

  const studentIds = students.map((s: any) => s.id as string);

  const { data: existing } = await supabaseAdmin
    .from("invoices")
    .select("student_id, fee_item_id")
    .in("student_id", studentIds)
    .in("fee_item_id", feeItemIds)
    .in("status", ["pending", "partial", "overdue"]);
  const existingKeys = new Set((existing || []).map((e: any) => `${e.student_id}:${e.fee_item_id}`));

  const rows: any[] = [];
  for (const studentId of studentIds) {
    for (const fee of feeItems) {
      if (existingKeys.has(`${studentId}:${fee.id}`)) continue;
      const amount = Number(fee.amount);
      if (amount <= 0) continue;
      rows.push({
        student_id: studentId,
        fee_item_id: fee.id,
        amount,
        total_amount: amount,
        amount_paid: 0,
        due_date: dueDate ? dueDate.toISOString().slice(0, 10) : null,
        reference: `INV-${randomUUID().slice(0, 8).toUpperCase()}`,
        school_id: schoolId,
      });
    }
  }

  if (rows.length === 0) {
    return NextResponse.json({ created: 0, skipped: existingKeys.size, message: "Every student already has an open invoice for the selected fees" });
  }

  const { error } = await supabaseAdmin.from("invoices").insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await recordAudit({
    schoolId,
    actorId: auth.ctx.userId,
    actorEmail: auth.ctx.email,
    action: "invoice.bulk_created",
    entityType: "class",
    entityId: classId,
    details: { created: rows.length, skipped: existingKeys.size, fee_item_ids: feeItemIds },
  });

  return NextResponse.json({ created: rows.length, skipped: existingKeys.size }, { status: 201 });
}
