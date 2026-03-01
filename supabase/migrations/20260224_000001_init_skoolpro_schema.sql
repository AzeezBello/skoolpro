-- SkoolPro baseline SaaS schema
-- Created for Next.js + Supabase app usage in this repository.

create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('admin', 'teacher', 'student');
  end if;
  if not exists (select 1 from pg_type where typname = 'invoice_status') then
    create type public.invoice_status as enum ('pending', 'partial', 'paid', 'overdue', 'cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type public.payment_status as enum ('pending', 'success', 'failed', 'refunded');
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_gateway') then
    create type public.payment_gateway as enum ('manual', 'paystack', 'flutterwave');
  end if;
end
$$;

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  owner_user_id uuid references auth.users(id) on delete set null,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.app_role not null default 'student',
  related_id uuid,
  school_id uuid references public.schools(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  subject text,
  email text,
  school_id uuid references public.schools(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  teacher_id uuid references public.teachers(id) on delete set null,
  school_id uuid references public.schools(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  parent_name text,
  parent_email text,
  class_id uuid references public.classes(id) on delete set null,
  school_id uuid references public.schools(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fee_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  amount numeric(12,2) not null default 0 check (amount >= 0),
  description text,
  school_id uuid references public.schools(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  student_id uuid not null references public.students(id) on delete cascade,
  fee_item_id uuid not null references public.fee_items(id) on delete restrict,
  amount numeric(12,2) not null default 0 check (amount >= 0),
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  amount_paid numeric(12,2) not null default 0 check (amount_paid >= 0),
  status public.invoice_status not null default 'pending',
  due_date date,
  parent_email text,
  payment_history jsonb not null default '[]'::jsonb,
  last_reminder_sent timestamptz,
  school_id uuid references public.schools(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references public.invoices(id) on delete cascade,
  gateway public.payment_gateway not null,
  amount numeric(12,2) not null default 0 check (amount >= 0),
  currency text not null default 'NGN',
  status public.payment_status not null default 'pending',
  gateway_response jsonb not null default '{}'::jsonb,
  school_id uuid references public.schools(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  date date not null,
  status text not null,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  school_id uuid references public.schools(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_status_check check (lower(status) in ('present', 'absent', 'late', 'excused'))
);

create table if not exists public.grades (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  subject text not null,
  score numeric(5,2) not null check (score >= 0 and score <= 100),
  term text not null default 'First Term',
  created_by uuid references auth.users(id) on delete set null,
  school_id uuid references public.schools(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role,
  is_read boolean not null default false,
  school_id uuid references public.schools(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role::text
  from public.profiles p
  where p.id = auth.uid()
  limit 1
$$;

create or replace function public.current_school_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.school_id
  from public.profiles p
  where p.id = auth.uid()
  limit 1
$$;

create or replace function public.sync_profile_related_records()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_name text;
  account_email text;
  target_id uuid;
begin
  profile_name := coalesce(nullif(trim(new.full_name), ''), 'Unnamed User');
  select u.email into account_email from auth.users u where u.id = new.id;

  if new.role = 'teacher' then
    target_id := coalesce(new.related_id, new.id);
    insert into public.teachers (id, full_name, email, school_id)
    values (target_id, profile_name, account_email, new.school_id)
    on conflict (id) do update
      set full_name = excluded.full_name,
          email = coalesce(excluded.email, public.teachers.email),
          school_id = coalesce(excluded.school_id, public.teachers.school_id),
          updated_at = now();
  elsif new.role = 'student' then
    target_id := coalesce(new.related_id, new.id);
    insert into public.students (id, full_name, email, parent_email, school_id)
    values (target_id, profile_name, account_email, account_email, new.school_id)
    on conflict (id) do update
      set full_name = excluded.full_name,
          email = coalesce(excluded.email, public.students.email),
          school_id = coalesce(excluded.school_id, public.students.school_id),
          updated_at = now();
  end if;

  return new;
end;
$$;

create or replace function public.populate_student_context()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  student_class_id uuid;
  student_school_id uuid;
begin
  if new.student_id is null then
    return new;
  end if;

  select s.class_id, s.school_id
  into student_class_id, student_school_id
  from public.students s
  where s.id = new.student_id;

  if new.class_id is null then
    new.class_id := student_class_id;
  end if;

  if student_school_id is not null then
    new.school_id := student_school_id;
  end if;

  return new;
end;
$$;

create or replace function public.populate_invoice_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  student_email text;
  student_parent_email text;
  student_school_id uuid;
begin
  if new.total_amount is null then
    new.total_amount := coalesce(new.amount, 0);
  end if;

  if new.amount_paid is null then
    new.amount_paid := 0;
  end if;

  select s.email, s.parent_email, s.school_id
  into student_email, student_parent_email, student_school_id
  from public.students s
  where s.id = new.student_id;

  if coalesce(new.parent_email, '') = '' then
    new.parent_email := coalesce(student_parent_email, student_email);
  end if;

  if new.school_id is null then
    new.school_id := student_school_id;
  end if;

  if new.status is null then
    if coalesce(new.amount_paid, 0) >= coalesce(new.total_amount, 0) and coalesce(new.total_amount, 0) > 0 then
      new.status := 'paid'::public.invoice_status;
    elsif coalesce(new.amount_paid, 0) > 0 then
      new.status := 'partial'::public.invoice_status;
    else
      new.status := 'pending'::public.invoice_status;
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.populate_payment_context()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invoice_school_id uuid;
begin
  if new.invoice_id is not null and new.school_id is null then
    select i.school_id into invoice_school_id
    from public.invoices i
    where i.id = new.invoice_id;

    new.school_id := invoice_school_id;
  end if;

  return new;
end;
$$;

create or replace function public.populate_school_id_from_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_school_id uuid;
begin
  if new.school_id is not null then
    return new;
  end if;

  if auth.uid() is null then
    return new;
  end if;

  select p.school_id
  into profile_school_id
  from public.profiles p
  where p.id = auth.uid();

  new.school_id := profile_school_id;
  return new;
end;
$$;

drop trigger if exists trg_schools_set_updated_at on public.schools;
create trigger trg_schools_set_updated_at
before update on public.schools
for each row execute function public.set_updated_at();

drop trigger if exists trg_profiles_set_updated_at on public.profiles;
create trigger trg_profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_teachers_set_updated_at on public.teachers;
create trigger trg_teachers_set_updated_at
before update on public.teachers
for each row execute function public.set_updated_at();

drop trigger if exists trg_classes_set_updated_at on public.classes;
create trigger trg_classes_set_updated_at
before update on public.classes
for each row execute function public.set_updated_at();

drop trigger if exists trg_students_set_updated_at on public.students;
create trigger trg_students_set_updated_at
before update on public.students
for each row execute function public.set_updated_at();

drop trigger if exists trg_fee_items_set_updated_at on public.fee_items;
create trigger trg_fee_items_set_updated_at
before update on public.fee_items
for each row execute function public.set_updated_at();

drop trigger if exists trg_invoices_set_updated_at on public.invoices;
create trigger trg_invoices_set_updated_at
before update on public.invoices
for each row execute function public.set_updated_at();

drop trigger if exists trg_payments_set_updated_at on public.payments;
create trigger trg_payments_set_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

drop trigger if exists trg_attendance_set_updated_at on public.attendance;
create trigger trg_attendance_set_updated_at
before update on public.attendance
for each row execute function public.set_updated_at();

drop trigger if exists trg_grades_set_updated_at on public.grades;
create trigger trg_grades_set_updated_at
before update on public.grades
for each row execute function public.set_updated_at();

drop trigger if exists trg_profiles_sync_related_records on public.profiles;
create trigger trg_profiles_sync_related_records
after insert or update of role, full_name, related_id, school_id on public.profiles
for each row execute function public.sync_profile_related_records();

drop trigger if exists trg_attendance_populate_student_context on public.attendance;
create trigger trg_attendance_populate_student_context
before insert or update on public.attendance
for each row execute function public.populate_student_context();

drop trigger if exists trg_grades_populate_student_context on public.grades;
create trigger trg_grades_populate_student_context
before insert or update on public.grades
for each row execute function public.populate_student_context();

drop trigger if exists trg_invoices_populate_defaults on public.invoices;
create trigger trg_invoices_populate_defaults
before insert or update on public.invoices
for each row execute function public.populate_invoice_defaults();

drop trigger if exists trg_payments_populate_context on public.payments;
create trigger trg_payments_populate_context
before insert or update on public.payments
for each row execute function public.populate_payment_context();

drop trigger if exists trg_teachers_populate_school on public.teachers;
create trigger trg_teachers_populate_school
before insert or update on public.teachers
for each row execute function public.populate_school_id_from_profile();

drop trigger if exists trg_classes_populate_school on public.classes;
create trigger trg_classes_populate_school
before insert or update on public.classes
for each row execute function public.populate_school_id_from_profile();

drop trigger if exists trg_students_populate_school on public.students;
create trigger trg_students_populate_school
before insert or update on public.students
for each row execute function public.populate_school_id_from_profile();

drop trigger if exists trg_fee_items_populate_school on public.fee_items;
create trigger trg_fee_items_populate_school
before insert or update on public.fee_items
for each row execute function public.populate_school_id_from_profile();

drop trigger if exists trg_invoices_populate_school on public.invoices;
create trigger trg_invoices_populate_school
before insert or update on public.invoices
for each row execute function public.populate_school_id_from_profile();

drop trigger if exists trg_payments_populate_school on public.payments;
create trigger trg_payments_populate_school
before insert or update on public.payments
for each row execute function public.populate_school_id_from_profile();

drop trigger if exists trg_attendance_populate_school on public.attendance;
create trigger trg_attendance_populate_school
before insert or update on public.attendance
for each row execute function public.populate_school_id_from_profile();

drop trigger if exists trg_grades_populate_school on public.grades;
create trigger trg_grades_populate_school
before insert or update on public.grades
for each row execute function public.populate_school_id_from_profile();

drop trigger if exists trg_notifications_populate_school on public.notifications;
create trigger trg_notifications_populate_school
before insert or update on public.notifications
for each row execute function public.populate_school_id_from_profile();

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_related_id on public.profiles(related_id);
create index if not exists idx_profiles_school_id on public.profiles(school_id);

create index if not exists idx_teachers_school_id on public.teachers(school_id);

create index if not exists idx_classes_teacher_id on public.classes(teacher_id);
create index if not exists idx_classes_school_id on public.classes(school_id);
create unique index if not exists idx_classes_unique_name_school on public.classes(lower(name), school_id);

create index if not exists idx_students_class_id on public.students(class_id);
create index if not exists idx_students_school_id on public.students(school_id);
create index if not exists idx_students_parent_email on public.students(parent_email);

create index if not exists idx_fee_items_school_id on public.fee_items(school_id);
create unique index if not exists idx_fee_items_unique_name_school on public.fee_items(lower(name), school_id);

create index if not exists idx_invoices_student_id on public.invoices(student_id);
create index if not exists idx_invoices_fee_item_id on public.invoices(fee_item_id);
create index if not exists idx_invoices_status on public.invoices(status);
create index if not exists idx_invoices_due_date on public.invoices(due_date);
create index if not exists idx_invoices_school_id on public.invoices(school_id);
create index if not exists idx_invoices_created_at on public.invoices(created_at desc);

create index if not exists idx_payments_invoice_id on public.payments(invoice_id);
create index if not exists idx_payments_gateway_status on public.payments(gateway, status);
create index if not exists idx_payments_school_id on public.payments(school_id);
create index if not exists idx_payments_created_at on public.payments(created_at desc);
create index if not exists idx_payments_gateway_reference on public.payments(gateway, ((gateway_response ->> 'reference')));
create index if not exists idx_payments_gateway_tx_ref on public.payments(gateway, ((gateway_response ->> 'tx_ref')));

create index if not exists idx_attendance_student_date on public.attendance(student_id, date);
create index if not exists idx_attendance_class_date on public.attendance(class_id, date);
create index if not exists idx_attendance_school_id on public.attendance(school_id);

create index if not exists idx_grades_student_term on public.grades(student_id, term);
create index if not exists idx_grades_class_term on public.grades(class_id, term);
create index if not exists idx_grades_school_id on public.grades(school_id);

create index if not exists idx_notifications_recipient_created on public.notifications(recipient_id, created_at desc);
create index if not exists idx_notifications_recipient_is_read on public.notifications(recipient_id, is_read);

create index if not exists idx_messages_sender_created on public.messages(sender_id, created_at desc);
create index if not exists idx_messages_receiver_created on public.messages(receiver_id, created_at desc);

alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.teachers enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.fee_items enable row level security;
alter table public.invoices enable row level security;
alter table public.payments enable row level security;
alter table public.attendance enable row level security;
alter table public.grades enable row level security;
alter table public.notifications enable row level security;
alter table public.messages enable row level security;

drop policy if exists "schools_select_authenticated" on public.schools;
create policy "schools_select_authenticated"
on public.schools for select
using (auth.role() = 'authenticated');

drop policy if exists "schools_manage_admin" on public.schools;
create policy "schools_manage_admin"
on public.schools for all
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
with check (auth.uid() = id);

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
on public.profiles for select
using (auth.uid() = id or public.current_app_role() = 'admin');

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin"
on public.profiles for update
using (auth.uid() = id or public.current_app_role() = 'admin')
with check (auth.uid() = id or public.current_app_role() = 'admin');

drop policy if exists "teachers_select_authenticated" on public.teachers;
create policy "teachers_select_authenticated"
on public.teachers for select
using (auth.role() = 'authenticated');

drop policy if exists "teachers_manage_admin" on public.teachers;
create policy "teachers_manage_admin"
on public.teachers for all
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

drop policy if exists "classes_select_authenticated" on public.classes;
create policy "classes_select_authenticated"
on public.classes for select
using (auth.role() = 'authenticated');

drop policy if exists "classes_manage_admin" on public.classes;
create policy "classes_manage_admin"
on public.classes for all
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

drop policy if exists "students_select_authenticated" on public.students;
create policy "students_select_authenticated"
on public.students for select
using (auth.role() = 'authenticated');

drop policy if exists "students_manage_admin" on public.students;
create policy "students_manage_admin"
on public.students for all
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

drop policy if exists "fee_items_select_authenticated" on public.fee_items;
create policy "fee_items_select_authenticated"
on public.fee_items for select
using (auth.role() = 'authenticated');

drop policy if exists "fee_items_manage_admin" on public.fee_items;
create policy "fee_items_manage_admin"
on public.fee_items for all
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

drop policy if exists "invoices_select_authenticated" on public.invoices;
create policy "invoices_select_authenticated"
on public.invoices for select
using (auth.role() = 'authenticated');

drop policy if exists "invoices_manage_admin" on public.invoices;
create policy "invoices_manage_admin"
on public.invoices for all
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

drop policy if exists "payments_select_authenticated" on public.payments;
create policy "payments_select_authenticated"
on public.payments for select
using (auth.role() = 'authenticated');

drop policy if exists "payments_manage_admin" on public.payments;
create policy "payments_manage_admin"
on public.payments for all
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

drop policy if exists "attendance_select_authenticated" on public.attendance;
create policy "attendance_select_authenticated"
on public.attendance for select
using (auth.role() = 'authenticated');

drop policy if exists "attendance_manage_admin_teacher" on public.attendance;
create policy "attendance_manage_admin_teacher"
on public.attendance for all
using (public.current_app_role() in ('admin', 'teacher'))
with check (public.current_app_role() in ('admin', 'teacher'));

drop policy if exists "grades_select_authenticated" on public.grades;
create policy "grades_select_authenticated"
on public.grades for select
using (auth.role() = 'authenticated');

drop policy if exists "grades_manage_admin_teacher" on public.grades;
create policy "grades_manage_admin_teacher"
on public.grades for all
using (public.current_app_role() in ('admin', 'teacher'))
with check (public.current_app_role() in ('admin', 'teacher'));

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
on public.notifications for select
using (recipient_id = auth.uid());

drop policy if exists "notifications_insert_authenticated" on public.notifications;
create policy "notifications_insert_authenticated"
on public.notifications for insert
with check (auth.role() = 'authenticated');

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
on public.notifications for update
using (recipient_id = auth.uid())
with check (recipient_id = auth.uid());

drop policy if exists "messages_select_participants" on public.messages;
create policy "messages_select_participants"
on public.messages for select
using (sender_id = auth.uid() or receiver_id = auth.uid());

drop policy if exists "messages_insert_sender" on public.messages;
create policy "messages_insert_sender"
on public.messages for insert
with check (sender_id = auth.uid());

drop policy if exists "messages_update_sender" on public.messages;
create policy "messages_update_sender"
on public.messages for update
using (sender_id = auth.uid())
with check (sender_id = auth.uid());

drop policy if exists "messages_delete_sender" on public.messages;
create policy "messages_delete_sender"
on public.messages for delete
using (sender_id = auth.uid());
