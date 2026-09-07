-- Richer impersonation audit + a general platform action log.
alter table public.impersonation_audit_log add column if not exists reason text;
alter table public.impersonation_audit_log add column if not exists ip_address text;
alter table public.impersonation_audit_log add column if not exists user_agent text;
alter table public.impersonation_audit_log add column if not exists failed boolean not null default false;

create table if not exists public.platform_audit_log (
  id uuid primary key default gen_random_uuid(),
  platform_admin_id uuid references auth.users(id) on delete set null,
  action text not null,
  school_id uuid references public.schools(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_platform_audit_log_created on public.platform_audit_log(created_at desc);
alter table public.platform_audit_log enable row level security;

-- Subscription plans for schools (v1): a plan with limits, set by the
-- platform operator after payment. Enforced in the database so client-side
-- inserts respect the cap too.
create table if not exists public.plans (
  id text primary key,
  name text not null,
  max_students integer,
  max_teachers integer,
  price_monthly numeric(12,2) not null default 0,
  features jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

insert into public.plans (id, name, max_students, max_teachers, price_monthly, features) values
  ('free', 'Free', 50, 5, 0, '{"online_payments": true, "sms": false}'),
  ('basic', 'Basic', 300, 30, 15000, '{"online_payments": true, "sms": true}'),
  ('pro', 'Pro', null, null, 40000, '{"online_payments": true, "sms": true, "priority_support": true}')
on conflict (id) do update set name = excluded.name, max_students = excluded.max_students, max_teachers = excluded.max_teachers, price_monthly = excluded.price_monthly, features = excluded.features;

alter table public.schools add column if not exists plan_id text not null default 'free' references public.plans(id);
alter table public.schools add column if not exists plan_expires_at timestamptz;

alter table public.plans enable row level security;
drop policy if exists "plans_select_all" on public.plans;
create policy "plans_select_all" on public.plans for select using (true);

create or replace function public.enforce_plan_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer;
  v_count integer;
  v_school uuid := new.school_id;
begin
  if v_school is null then
    return new;
  end if;

  if tg_table_name = 'students' then
    select p.max_students into v_limit from public.schools s join public.plans p on p.id = s.plan_id where s.id = v_school;
    if v_limit is not null then
      select count(*) into v_count from public.students where school_id = v_school and status = 'active';
      if v_count >= v_limit then
        raise exception 'Student limit reached for your plan (%). Upgrade under School Profile.', v_limit using errcode = 'P0001';
      end if;
    end if;
  elsif tg_table_name = 'teachers' then
    select p.max_teachers into v_limit from public.schools s join public.plans p on p.id = s.plan_id where s.id = v_school;
    if v_limit is not null then
      select count(*) into v_count from public.teachers where school_id = v_school;
      if v_count >= v_limit then
        raise exception 'Teacher limit reached for your plan (%). Upgrade under School Profile.', v_limit using errcode = 'P0001';
      end if;
    end if;
  end if;

  return new;
end;
$$;

-- Runs AFTER the populate_school triggers (alphabetical firing order: "trg_z…")
-- so school_id is already filled in.
drop trigger if exists trg_z_students_plan_limit on public.students;
create trigger trg_z_students_plan_limit
before insert on public.students
for each row execute function public.enforce_plan_limits();

drop trigger if exists trg_z_teachers_plan_limit on public.teachers;
create trigger trg_z_teachers_plan_limit
before insert on public.teachers
for each row execute function public.enforce_plan_limits();
