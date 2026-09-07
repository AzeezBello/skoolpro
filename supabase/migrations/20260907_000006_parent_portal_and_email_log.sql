-- Parent/guardian accounts. A parent profile is linked to one or more
-- students through parent_students; RLS below lets a parent read their own
-- children's rows (students, attendance, results, enrollments, invoices,
-- payments) without widening staff policies.

create table if not exists public.parent_students (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  relationship text,
  school_id uuid references public.schools(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (parent_id, student_id)
);

create index if not exists idx_parent_students_parent on public.parent_students(parent_id);
create index if not exists idx_parent_students_student on public.parent_students(student_id);
create index if not exists idx_parent_students_school on public.parent_students(school_id);

create or replace function public.populate_parent_student_context()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id uuid;
begin
  select s.school_id into v_school_id from public.students s where s.id = new.student_id;
  if v_school_id is not null then
    new.school_id := v_school_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_parent_students_populate_context on public.parent_students;
create trigger trg_parent_students_populate_context
before insert or update on public.parent_students
for each row execute function public.populate_parent_student_context();

alter table public.parent_students enable row level security;

drop policy if exists "parent_students_select_own_or_admin" on public.parent_students;
create policy "parent_students_select_own_or_admin"
on public.parent_students for select
using (
  parent_id = auth.uid()
  or (public.current_app_role() in ('admin', 'teacher') and school_id = public.current_school_id())
);

drop policy if exists "parent_students_manage_admin" on public.parent_students;
create policy "parent_students_manage_admin"
on public.parent_students for all
using (public.current_app_role() = 'admin' and school_id = public.current_school_id())
with check (public.current_app_role() = 'admin' and school_id = public.current_school_id());

-- Helper used by the per-table policies below.
create or replace function public.is_parent_of(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.parent_students ps
    where ps.parent_id = auth.uid() and ps.student_id = p_student_id
  )
$$;

-- Tighten intra-school reads that were school-wide for every role: students
-- could see every invoice/payment/attendance row in their school. Staff keep
-- school-wide access; students/parents see only their own.
drop policy if exists "students_select_authenticated" on public.students;
create policy "students_select_authenticated"
on public.students for select
using (
  (public.current_app_role() in ('admin', 'teacher') and school_id = public.current_school_id())
  or id = (select coalesce(p.related_id, p.id) from public.profiles p where p.id = auth.uid())
  or public.is_parent_of(id)
);

drop policy if exists "invoices_select_authenticated" on public.invoices;
create policy "invoices_select_authenticated"
on public.invoices for select
using (
  (public.current_app_role() in ('admin', 'teacher') and school_id = public.current_school_id())
  or student_id = (select coalesce(p.related_id, p.id) from public.profiles p where p.id = auth.uid())
  or public.is_parent_of(student_id)
);

drop policy if exists "payments_select_authenticated" on public.payments;
create policy "payments_select_authenticated"
on public.payments for select
using (
  (public.current_app_role() in ('admin', 'teacher') and school_id = public.current_school_id())
  or exists (
    select 1 from public.invoices i
    where i.id = payments.invoice_id
      and (
        i.student_id = (select coalesce(p.related_id, p.id) from public.profiles p where p.id = auth.uid())
        or public.is_parent_of(i.student_id)
      )
  )
);

drop policy if exists "attendance_select_authenticated" on public.attendance;
create policy "attendance_select_authenticated"
on public.attendance for select
using (
  (public.current_app_role() in ('admin', 'teacher') and school_id = public.current_school_id())
  or student_id = (select coalesce(p.related_id, p.id) from public.profiles p where p.id = auth.uid())
  or public.is_parent_of(student_id)
);

drop policy if exists "results_select_staff_or_own" on public.results;
create policy "results_select_staff_or_own"
on public.results for select
using (
  (public.current_app_role() in ('admin', 'teacher') and school_id = public.current_school_id())
  or student_id = (select coalesce(p.related_id, p.id) from public.profiles p where p.id = auth.uid())
  or public.is_parent_of(student_id)
);

drop policy if exists "student_enrollments_select_staff_or_own" on public.student_enrollments;
create policy "student_enrollments_select_staff_or_own"
on public.student_enrollments for select
using (
  (public.current_app_role() in ('admin', 'teacher') and school_id = public.current_school_id())
  or student_id = (select coalesce(p.related_id, p.id) from public.profiles p where p.id = auth.uid())
  or public.is_parent_of(student_id)
);

-- Outbound email log: every send is recorded (queued/sent/failed) so
-- reminders are auditable and failures are visible instead of silent.
create table if not exists public.email_log (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete set null,
  to_email text not null,
  subject text not null,
  template text,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  provider_id text,
  error text,
  related_type text,
  related_id uuid,
  sent_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists idx_email_log_school on public.email_log(school_id, created_at desc);
create index if not exists idx_email_log_related on public.email_log(related_type, related_id);

alter table public.email_log enable row level security;

drop policy if exists "email_log_select_admin" on public.email_log;
create policy "email_log_select_admin"
on public.email_log for select
using (public.current_app_role() = 'admin' and school_id = public.current_school_id());

-- School-facing audit log (results edits, payments, role changes, etc.).
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  action text not null,
  entity_type text,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_log_school_created on public.audit_log(school_id, created_at desc);
create index if not exists idx_audit_log_entity on public.audit_log(entity_type, entity_id);

alter table public.audit_log enable row level security;

drop policy if exists "audit_log_select_admin" on public.audit_log;
create policy "audit_log_select_admin"
on public.audit_log for select
using (public.current_app_role() = 'admin' and school_id = public.current_school_id());
