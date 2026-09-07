-- Give the public API (/api/public/*) a way to scope requests to a single
-- school instead of always returning every school's data.
--
-- Previously /api/public/* used a single global PUBLIC_API_TOKEN and read
-- with the service-role client (which bypasses RLS), so any caller with the
-- token saw every school's students, invoices, and payment history. When
-- SAAS_ENABLE_TENANCY is on, callers must now present a per-school token
-- from this table instead, and every public query is scoped to that school.
--
-- Deliberately no RLS policies are defined for anon/authenticated roles:
-- with row level security enabled and zero matching policies, Postgres
-- denies all access to those roles by default. Only the service-role
-- client (supabaseAdmin, which bypasses RLS) can read this table, so the
-- tokens are never reachable through the normal authenticated API surface.

create table if not exists public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  token text not null unique,
  label text,
  created_at timestamptz not null default now()
);

alter table public.api_tokens enable row level security;

create index if not exists idx_api_tokens_school_id on public.api_tokens(school_id);
