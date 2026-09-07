-- Self-service onboarding. Until now a self-signup produced an orphan
-- "student" profile with no school, and nothing in the UI could change a
-- role. Two paths are introduced:
--
--   1. "Create a school": a signed-up user with no school registers a new
--      school and becomes its admin (server route, service role).
--   2. Invitations: an admin invites an email address with a role; the
--      invitee signs up (or logs in) and accepts, which attaches the profile
--      to the school with that role and links/creates the matching
--      teachers/students row.
--
-- Tokens are stored hashed. RLS is enabled with zero policies (service-role
-- only), same pattern as api_tokens/platform_admins.

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  email text not null,
  role public.app_role not null default 'teacher',
  related_id uuid,
  token_hash text not null unique,
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_invitations_school_id on public.invitations(school_id);
create index if not exists idx_invitations_email on public.invitations(lower(email));

alter table public.invitations enable row level security;

-- Students: real-world fields that were missing from the schema, plus a
-- lifecycle status so promotion can graduate/withdraw instead of endlessly
-- re-enrolling.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'student_status') then
    create type public.student_status as enum ('active', 'graduated', 'withdrawn', 'suspended');
  end if;
end
$$;

alter table public.students add column if not exists status public.student_status not null default 'active';
alter table public.students add column if not exists admission_number text;
alter table public.students add column if not exists date_of_birth date;
alter table public.students add column if not exists gender text check (gender is null or gender in ('male', 'female', 'other'));
alter table public.students add column if not exists parent_phone text;

create unique index if not exists idx_students_admission_number_school
  on public.students(school_id, lower(admission_number))
  where admission_number is not null;
create index if not exists idx_students_status on public.students(status);

-- Teachers: email should be unique per school so invites can link to a row.
create unique index if not exists idx_teachers_email_school
  on public.teachers(school_id, lower(email))
  where email is not null;

-- Schools: currency is stored in settings but was never read; surface it as
-- a real column with the existing default.
alter table public.schools add column if not exists currency text not null default 'NGN';
update public.schools set currency = coalesce(nullif(settings ->> 'currency', ''), 'NGN') where currency = 'NGN';
