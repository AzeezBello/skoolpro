import { randomUUID } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requireRequestUser } from "@/lib/server/auth";
import { visibleStudentIds } from "@/lib/server/invoiceAccess";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { applyTenantFilter, withTenantPayload } from "@/lib/server/tenant";
import { recordAudit } from "@/lib/server/audit";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function parsePositiveNumber(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return numeric;
}

function parsePage(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
}

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireRequestUser(req, { roles: ["admin", "teacher", "student", "parent"] });
  if (!auth.ok) return auth.response;

  const searchParams = req.nextUrl.searchParams;
  const page = parsePage(searchParams.get("page"), 1);
  const pageSize = Math.min(parsePage(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
  const status = (searchParams.get("status") || "").trim().toLowerCase();
  const query = (searchParams.get("query") || "").trim();
  const studentId = (searchParams.get("studentId") || "").trim();
  const classId = (searchParams.get("classId") || "").trim();

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let dbQuery = supabaseAdmin
    .from("invoices")
    .select(
      "id, reference, total_amount, amount, amount_paid, status, due_date, student_id, payment_history, created_at, fee_items(name), students!inner(full_name, parent_email, parent_name, class_id, classes(name))",
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  dbQuery = applyTenantFilter(dbQuery, auth.ctx.tenant);

  const allowed = await visibleStudentIds(auth.ctx);
  if (allowed) {
    if (allowed.length === 0) return NextResponse.json({ data: [], meta: { page, pageSize, total: 0, totalPages: 0 } });
    dbQuery = dbQuery.in("student_id", allowed);
  }

  if (status && status !== "all") dbQuery = dbQuery.eq("status", status);
  if (studentId) dbQuery = dbQuery.eq("student_id", studentId);
  if (classId) dbQuery = dbQuery.eq("students.class_id", classId);
  if (query) dbQuery = dbQuery.or(`reference.ilike.%${query}%,students.full_name.ilike.%${query}%`);

  const { data, error, count } = await dbQuery.range(from, to);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const shaped = (data || []).map((invoice: any) => {
    const total = Number(invoice.total_amount ?? invoice.amount ?? 0);
    const paid = Number(invoice.amount_paid ?? 0);
    const balance = Math.max(total - paid, 0);
    const { students, fee_items, ...rest } = invoice;

    return {
      ...rest,
      balance,
      fee_name: fee_items?.name ?? null,
      student_full_name: students?.full_name ?? null,
      class_name: students?.classes?.name ?? null,
      parent_email: auth.ctx.role === "admin" || auth.ctx.role === "teacher" ? students?.parent_email ?? null : undefined,
      parent_name: students?.parent_name ?? null,
    };
  });

  return NextResponse.json({
    data: shaped,
    meta: { page, pageSize, total: count ?? 0, totalPages: count ? Math.ceil(count / pageSize) : 0 },
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireRequestUser(req, { roles: ["admin"] });
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const studentId = typeof body.student_id === "string" ? body.student_id : "";
    const feeItemId = typeof body.fee_item_id === "string" ? body.fee_item_id : "";
    const dueDateRaw = typeof body.due_date === "string" ? body.due_date : "";
    const discount = Math.max(Number(body.discount || 0), 0);

    if (!studentId || !feeItemId) {
      return NextResponse.json({ error: "student_id and fee_item_id are required" }, { status: 400 });
    }

    const dueDate = dueDateRaw ? new Date(dueDateRaw) : null;
    if (dueDateRaw && Number.isNaN(dueDate?.getTime())) {
      return NextResponse.json({ error: "Invalid due_date" }, { status: 400 });
    }

    let studentQuery = supabaseAdmin.from("students").select("id").eq("id", studentId);
    studentQuery = applyTenantFilter(studentQuery, auth.ctx.tenant);
    const { data: student } = await studentQuery.maybeSingle();
    if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

    let feeQuery = supabaseAdmin.from("fee_items").select("id, amount, name").eq("id", feeItemId);
    feeQuery = applyTenantFilter(feeQuery, auth.ctx.tenant);
    const { data: feeItem } = await feeQuery.maybeSingle();
    if (!feeItem) return NextResponse.json({ error: "Fee item not found" }, { status: 404 });

    // Amount defaults to the fee item's amount; an explicit override or a
    // discount (scholarship, sibling discount) may reduce it.
    const baseAmount = parsePositiveNumber(body.amount) ?? Number(feeItem.amount);
    const amount = Math.max(baseAmount - discount, 0);
    if (amount <= 0) return NextResponse.json({ error: "Invoice amount must be greater than zero" }, { status: 400 });

    const reference = `INV-${randomUUID().slice(0, 8).toUpperCase()}`;

    const payload = withTenantPayload(
      {
        student_id: studentId,
        fee_item_id: feeItemId,
        amount,
        total_amount: amount,
        amount_paid: 0,
        due_date: dueDate ? dueDate.toISOString().slice(0, 10) : null,
        reference,
        status: null,
        payment_history: discount > 0 ? [{ type: "discount", amount: discount, date: new Date().toISOString(), by: auth.ctx.email }] : [],
      },
      auth.ctx.tenant
    );

    const { data: invoice, error: insertError } = await supabaseAdmin
      .from("invoices")
      .insert([payload])
      .select("id, reference, total_amount, amount, amount_paid, status, due_date, student_id")
      .single();

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

    await recordAudit({
      schoolId: auth.ctx.tenant?.value,
      actorId: auth.ctx.userId,
      actorEmail: auth.ctx.email,
      action: "invoice.created",
      entityType: "invoice",
      entityId: invoice.id,
      details: { reference, amount, fee: feeItem.name, discount },
    });

    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Unexpected error" }, { status: 500 });
  }
}
