import { randomUUID } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requireRequestUser } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { applyTenantFilter, withTenantPayload } from "@/lib/server/tenant";

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
  const auth = await requireRequestUser(req, { roles: ["admin", "teacher"] });
  if (!auth.ok) return auth.response;

  const searchParams = req.nextUrl.searchParams;
  const page = parsePage(searchParams.get("page"), 1);
  const pageSize = Math.min(parsePage(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
  const status = (searchParams.get("status") || "").trim().toLowerCase();
  const query = (searchParams.get("query") || "").trim();

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let dbQuery = supabaseAdmin
    .from("invoices")
    .select(
      "id, reference, total_amount, amount, amount_paid, status, due_date, student_id, payment_history, created_at, students(full_name, parent_email, parent_name)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  dbQuery = applyTenantFilter(dbQuery, auth.ctx.tenant);

  if (status && status !== "all") {
    dbQuery = dbQuery.eq("status", status);
  }

  if (query) {
    dbQuery = dbQuery.ilike("reference", `%${query}%`);
  }

  const { data, error, count } = await dbQuery.range(from, to);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const shaped = (data || []).map((invoice: any) => {
    const total = Number(invoice.total_amount ?? invoice.amount ?? 0);
    const paid = Number(invoice.amount_paid ?? 0);
    const balance = Math.max(total - paid, 0);

    return {
      ...invoice,
      balance,
      student_full_name: invoice.students?.full_name ?? null,
      parent_email: invoice.students?.parent_email ?? null,
      parent_name: invoice.students?.parent_name ?? null,
    };
  });

  return NextResponse.json({
    data: shaped,
    meta: {
      page,
      pageSize,
      total: count ?? 0,
      totalPages: count ? Math.ceil(count / pageSize) : 0,
    },
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireRequestUser(req, { roles: ["admin"] });
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const studentId = typeof body.student_id === "string" ? body.student_id : "";
    const feeItemId = typeof body.fee_item_id === "string" ? body.fee_item_id : "";
    const amount = parsePositiveNumber(body.amount);
    const dueDateRaw = typeof body.due_date === "string" ? body.due_date : "";

    if (!studentId || !feeItemId || amount === null) {
      return NextResponse.json({ error: "student_id, fee_item_id and amount are required" }, { status: 400 });
    }

    const dueDate = dueDateRaw ? new Date(dueDateRaw) : null;
    if (dueDateRaw && Number.isNaN(dueDate?.getTime())) {
      return NextResponse.json({ error: "Invalid due_date" }, { status: 400 });
    }

    let studentQuery = supabaseAdmin.from("students").select("id").eq("id", studentId);
    studentQuery = applyTenantFilter(studentQuery, auth.ctx.tenant);
    const { data: student, error: studentError } = await studentQuery.maybeSingle();
    if (studentError) return NextResponse.json({ error: studentError.message }, { status: 500 });
    if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

    let feeQuery = supabaseAdmin.from("fee_items").select("id").eq("id", feeItemId);
    feeQuery = applyTenantFilter(feeQuery, auth.ctx.tenant);
    const { data: feeItem, error: feeError } = await feeQuery.maybeSingle();
    if (feeError) return NextResponse.json({ error: feeError.message }, { status: 500 });
    if (!feeItem) return NextResponse.json({ error: "Fee item not found" }, { status: 404 });

    const reference = `INV-${randomUUID()}`;

    const payload = withTenantPayload(
      {
        student_id: studentId,
        fee_item_id: feeItemId,
        amount,
        total_amount: amount,
        amount_paid: 0,
        due_date: dueDate ? dueDate.toISOString() : null,
        reference,
        status: "pending",
      },
      auth.ctx.tenant
    );

    const { data: invoice, error: insertError } = await supabaseAdmin
      .from("invoices")
      .insert([payload])
      .select("id, reference, total_amount, amount, amount_paid, status, due_date, student_id")
      .single();

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Unexpected error" }, { status: 500 });
  }
}
