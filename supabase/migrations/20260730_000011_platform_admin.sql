-- Platform-admin layer: internal SkoolPro ops tooling that sits above every
-- school, not exposed to any school's own admin. Deliberately built as a
-- separate surface rather than folding into the existing tenant-scoped role
-- system (profiles.role / current_app_role() / current_school_id()):
--
-- - public.platform_admins is a standalone allowlist (RLS enabled, zero
--   policies defined for anon/authenticated — same deny-by-default pattern
--   as public.api_tokens from 20260730_000002 — so it's only ever readable
--   via the service-role client). It is NOT a profiles.role value, because
--   platform admins aren't scoped to any single school at all.
-- - Every table/route built so far scopes access through current_school_id().
--   Platform-admin routes instead check platform_admins directly and use
--   the service-role client, bypassing RLS entirely by design — that's the
--   one deliberate hole in tenant isolation this session adds, contained to
--   a narrow set of explicitly-gated /api/platform/* routes rather than a
--   broad "OR is_platform_admin()" clause added to every existing policy.

create table if not exists public.platform_admins (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

-- School suspension. Enforced with a single surgical change to
-- current_school_id() (the function nearly every RLS policy in this schema
-- already keys off) rather than touching dozens of individual policies:
-- once a school is suspended, current_school_id() returns null for its
-- members, and every "school_id = current_school_id()" check across the
-- whole schema then denies them automatically.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'school_status') then
    create type public.school_status as enum ('active', 'suspended');
  end if;
end
$$;

alter table public.schools
  add column if not exists status public.school_status not null default 'active';

create or replace function public.current_school_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.school_id
  from public.profiles p
  join public.schools s on s.id = p.school_id
  where p.id = auth.uid()
    and s.status = 'active'
  limit 1
$$;

-- Audit trail for impersonation events. Every "log in as this user" action
-- from the platform-admin tooling writes a row here before returning the
-- link to the caller, so there's a durable record independent of Supabase's
-- own auth logs.
create table if not exists public.impersonation_audit_log (
  id uuid primary key default gen_random_uuid(),
  platform_admin_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  target_school_id uuid references public.schools(id) on delete set null,
  started_at timestamptz not null default now()
);

alter table public.impersonation_audit_log enable row level security;

create index if not exists idx_schools_status on public.schools(status);
create index if not exists idx_impersonation_audit_log_started_at on public.impersonation_audit_log(started_at desc);
