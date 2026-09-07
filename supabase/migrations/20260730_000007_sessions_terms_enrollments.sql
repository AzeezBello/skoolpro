-- Academic sessions (years) and terms with real start/end dates, plus a
-- historical per-session class enrollment record — needed because students
-- move from class to class at the end of each session, and the previous
-- migration's free-text `results.term` ("First Term" etc.) can't tell this
-- year's First Term apart from last year's, nor say which class a student
-- was actually in when a past term's results were entered.
--
-- students.class_id is left as-is and keeps meaning "current class" — it's
-- what attendance and the teacher/admin "current roster" views already
-- rely on. student_enrollments is a separate, additive historical record:
-- which class a student was in for a given session. Results resolve their
-- class_id from the enrollment for that result's session when one exists,
-- falling back to the student's current class_id for schools that don't
-- bother with enrollments at all.

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date,
  end_date date,
  is_current boolean not null default false,
  school_id uuid references public.schools(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.terms (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  name text not null,
  start_date date,
  end_date date,
  school_id uuid references public.schools(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, name)
);

create table if not exists public.student_enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  school_id uuid references public.schools(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, session_id)
);

-- results.term (free text) -> results.term_id (references terms). The
-- results table was only just introduced in 20260730_000006 and has no
-- real-world data yet, so this is a clean redefinition, not a lossy migration.
alter table public.results drop constraint if exists results_student_id_subject_id_term_key;
alter table public.results drop column if exists term;
alter table public.results add column if not exists term_id uuid references public.terms(id) on delete cascade;
alter table public.results alter column term_id set not null;
alter table public.results add constraint results_student_subject_term_unique unique (student_id, subject_id, term_id);

-- Replaces the reused populate_student_context() trigger from the previous
-- migration: that one always pulls the student's *current* class, which is
-- wrong once a student has moved on to a new class in a later session.
create or replace function public.populate_result_context()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_class_id uuid;
  v_school_id uuid;
begin
  select t.session_id into v_session_id from public.terms t where t.id = new.term_id;

  if v_session_id is not null then
    select se.class_id, se.school_id
    into v_class_id, v_school_id
    from public.student_enrollments se
    where se.student_id = new.student_id
      and se.session_id = v_session_id;
  end if;

  if v_class_id is null then
    select s.class_id, s.school_id into v_class_id, v_school_id
    from public.students s
    where s.id = new.student_id;
  end if;

  if new.class_id is null then
    new.class_id := v_class_id;
  end if;

  if v_school_id is not null then
    new.school_id := v_school_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_results_populate_context on public.results;
create trigger trg_results_populate_context
before insert or update on public.results
for each row execute function public.populate_result_context();

create or replace function public.populate_term_context()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id uuid;
begin
  select s.school_id into v_school_id from public.sessions s where s.id = new.session_id;

  if v_school_id is not null then
    new.school_id := v_school_id;
  end if;

  return new;
end;
$$;

create or replace function public.populate_enrollment_context()
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

drop trigger if exists trg_sessions_set_updated_at on public.sessions;
create trigger trg_sessions_set_updated_at
before update on public.sessions
for each row execute function public.set_updated_at();

drop trigger if exists trg_sessions_populate_school on public.sessions;
create trigger trg_sessions_populate_school
before insert or update on public.sessions
for each row execute function public.populate_school_id_from_profile();

drop trigger if exists trg_terms_set_updated_at on public.terms;
create trigger trg_terms_set_updated_at
before update on public.terms
for each row execute function public.set_updated_at();

drop trigger if exists trg_terms_populate_context on public.terms;
create trigger trg_terms_populate_context
before insert or update on public.terms
for each row execute function public.populate_term_context();

drop trigger if exists trg_student_enrollments_set_updated_at on public.student_enrollments;
create trigger trg_student_enrollments_set_updated_at
before update on public.student_enrollments
for each row execute function public.set_updated_at();

drop trigger if exists trg_student_enrollments_populate_context on public.student_enrollments;
create trigger trg_student_enrollments_populate_context
before insert or update on public.student_enrollments
for each row execute function public.populate_enrollment_context();

create unique index if not exists idx_sessions_unique_name_school on public.sessions(lower(name), school_id);
-- At most one "current" session per school.
create unique index if not exists idx_sessions_one_current_per_school on public.sessions(school_id) where is_current;
create index if not exists idx_sessions_school_id on public.sessions(school_id);

create index if not exists idx_terms_session_id on public.terms(session_id);
create index if not exists idx_terms_school_id on public.terms(school_id);

create index if not exists idx_student_enrollments_student_id on public.student_enrollments(student_id);
create index if not exists idx_student_enrollments_session_id on public.student_enrollments(session_id);
create index if not exists idx_student_enrollments_school_id on public.student_enrollments(school_id);

create index if not exists idx_results_term_id on public.results(term_id);

alter table public.sessions enable row level security;
alter table public.terms enable row level security;
alter table public.student_enrollments enable row level security;

drop policy if exists "sessions_select_authenticated" on public.sessions;
create policy "sessions_select_authenticated"
on public.sessions for select
using (school_id = public.current_school_id());

drop policy if exists "sessions_manage_admin" on public.sessions;
create policy "sessions_manage_admin"
on public.sessions for all
using (public.current_app_role() = 'admin' and school_id = public.current_school_id())
with check (public.current_app_role() = 'admin' and school_id = public.current_school_id());

drop policy if exists "terms_select_authenticated" on public.terms;
create policy "terms_select_authenticated"
on public.terms for select
using (school_id = public.current_school_id());

drop policy if exists "terms_manage_admin" on public.terms;
create policy "terms_manage_admin"
on public.terms for all
using (public.current_app_role() = 'admin' and school_id = public.current_school_id())
with check (public.current_app_role() = 'admin' and school_id = public.current_school_id());

drop policy if exists "student_enrollments_select_staff_or_own" on public.student_enrollments;
create policy "student_enrollments_select_staff_or_own"
on public.student_enrollments for select
using (
  (public.current_app_role() in ('admin', 'teacher') and school_id = public.current_school_id())
  or student_id = (select coalesce(p.related_id, p.id) from public.profiles p where p.id = auth.uid())
);

drop policy if exists "student_enrollments_manage_admin" on public.student_enrollments;
create policy "student_enrollments_manage_admin"
on public.student_enrollments for all
using (public.current_app_role() = 'admin' and school_id = public.current_school_id())
with check (public.current_app_role() = 'admin' and school_id = public.current_school_id());
