-- Plan purchases paid online (Paystack) by school admins.
create table if not exists public.plan_payments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  plan_id text not null references public.plans(id),
  months integer not null check (months > 0),
  amount numeric(12,2) not null,
  currency text not null default 'NGN',
  gateway text not null default 'paystack',
  reference text not null unique,
  status text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  initiated_by uuid references auth.users(id) on delete set null,
  gateway_response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists idx_plan_payments_school on public.plan_payments(school_id, created_at desc);
alter table public.plan_payments enable row level security;
drop policy if exists "plan_payments_select_admin" on public.plan_payments;
create policy "plan_payments_select_admin" on public.plan_payments for select
using (public.current_app_role() = 'admin' and school_id = public.current_school_id());

-- Applies a successful plan purchase exactly once (idempotent on reference).
create or replace function public.apply_plan_payment(p_reference text, p_gateway_response jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.plan_payments%rowtype;
  v_base timestamptz;
  v_expires timestamptz;
begin
  select * into v_row from public.plan_payments where reference = p_reference for update;
  if not found then
    return jsonb_build_object('applied', false, 'reason', 'unknown reference');
  end if;
  if v_row.status = 'success' then
    return jsonb_build_object('applied', false, 'reason', 'already applied', 'school_id', v_row.school_id);
  end if;

  -- Extend from the current expiry when renewing the same plan, else from now.
  select case when s.plan_id = v_row.plan_id and s.plan_expires_at > now() then s.plan_expires_at else now() end
  into v_base from public.schools s where s.id = v_row.school_id;
  v_expires := coalesce(v_base, now()) + (v_row.months || ' months')::interval;

  update public.plan_payments
  set status = 'success', paid_at = now(), gateway_response = coalesce(p_gateway_response, '{}'::jsonb)
  where id = v_row.id;

  update public.schools set plan_id = v_row.plan_id, plan_expires_at = v_expires, updated_at = now() where id = v_row.school_id;

  return jsonb_build_object('applied', true, 'school_id', v_row.school_id, 'plan_id', v_row.plan_id, 'plan_expires_at', v_expires);
end;
$$;
revoke all on function public.apply_plan_payment(text, jsonb) from public, anon, authenticated;
grant execute on function public.apply_plan_payment(text, jsonb) to service_role;

-- Expired paid plans fall back to free (nightly, alongside the overdue sweep).
create or replace function public.expire_plans()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  update public.schools set plan_id = 'free', plan_expires_at = null, updated_at = now()
  where plan_id <> 'free' and plan_expires_at is not null and plan_expires_at < now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.expire_plans() from public, anon, authenticated;
grant execute on function public.expire_plans() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'skoolpro_expire_plans';
    perform cron.schedule('skoolpro_expire_plans', '30 0 * * *', 'select public.expire_plans();');
  end if;
exception when others then
  raise notice 'could not schedule plan expiry: %', sqlerrm;
end
$$;

-- Admissions: public application form per school (by slug), reviewed by admins.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'admission_status') then
    create type public.admission_status as enum ('pending', 'accepted', 'rejected', 'waitlisted');
  end if;
end
$$;

create table if not exists public.admission_applications (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  applicant_name text not null,
  date_of_birth date,
  gender text check (gender is null or gender in ('male', 'female', 'other')),
  applying_for_class_id uuid references public.classes(id) on delete set null,
  applying_for_class_name text,
  previous_school text,
  parent_name text not null,
  parent_email text not null,
  parent_phone text,
  address text,
  notes text,
  status public.admission_status not null default 'pending',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  student_id uuid references public.students(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_admissions_school_status on public.admission_applications(school_id, status, created_at desc);
alter table public.admission_applications enable row level security;
drop policy if exists "admissions_manage_admin" on public.admission_applications;
create policy "admissions_manage_admin" on public.admission_applications for all
using (public.current_app_role() = 'admin' and school_id = public.current_school_id())
with check (public.current_app_role() = 'admin' and school_id = public.current_school_id());

alter table public.schools add column if not exists admissions_open boolean not null default false;
