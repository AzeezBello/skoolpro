create table if not exists public.sms_log (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete set null,
  to_phone text not null,
  message text not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  provider_id text,
  error text,
  related_type text,
  related_id uuid,
  sent_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists idx_sms_log_school on public.sms_log(school_id, created_at desc);
alter table public.sms_log enable row level security;
drop policy if exists "sms_log_select_admin" on public.sms_log;
create policy "sms_log_select_admin" on public.sms_log for select
using (public.current_app_role() = 'admin' and school_id = public.current_school_id());
