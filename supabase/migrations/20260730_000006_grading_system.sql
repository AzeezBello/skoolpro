-- Grading system: subjects, per-class subject assignment, and CA/exam
-- results (replacing the old free-text subject + single-score model that
-- lived directly on public.grades).
--
-- Design decisions (confirmed with the school):
-- - Subjects are assigned per class, not per student — every student in a
--   class shares that class's subject list.
-- - Scores follow the standard CA (0-40) + Exam (0-60) = Total (100) split.
-- - Report cards are generated per student, per term.
--
-- public.grades is left in place (untouched, no data migrated) rather than
-- dropped, since dropping a table that existing rows depend on is a
-- destructive step beyond what was asked; the app simply stops writing to
-- it in favor of this new schema.

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  school_id uuid references public.schools(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.class_subjects (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  school_id uuid references public.schools(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (class_id, subject_id)
);

create table if not exists public.results (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  term text not null default 'First Term',
  ca_score numeric(5,2) check (ca_score >= 0 and ca_score <= 40),
  exam_score numeric(5,2) check (exam_score >= 0 and exam_score <= 60),
  total_score numeric(5,2) generated always as (coalesce(ca_score, 0) + coalesce(exam_score, 0)) stored,
  created_by uuid references auth.users(id) on delete set null,
  school_id uuid references public.schools(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, subject_id, term)
);

-- Mirrors populate_school_id_from_profile's use on classes/fee_items: fills
-- school_id from the class being assigned, so a forged/mismatched value on
-- insert can't slip past the school_id = current_school_id() RLS check.
create or replace function public.populate_class_subject_context()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id uuid;
begin
  select c.school_id into v_school_id from public.classes c where c.id = new.class_id;

  if v_school_id is not null then
    new.school_id := v_school_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_subjects_set_updated_at on public.subjects;
create trigger trg_subjects_set_updated_at
before update on public.subjects
for each row execute function public.set_updated_at();

drop trigger if exists trg_subjects_populate_school on public.subjects;
create trigger trg_subjects_populate_school
before insert or update on public.subjects
for each row execute function public.populate_school_id_from_profile();

drop trigger if exists trg_class_subjects_populate_context on public.class_subjects;
create trigger trg_class_subjects_populate_context
before insert or update on public.class_subjects
for each row execute function public.populate_class_subject_context();

drop trigger if exists trg_results_set_updated_at on public.results;
create trigger trg_results_set_updated_at
before update on public.results
for each row execute function public.set_updated_at();

-- Reuses the existing populate_student_context() trigger function (already
-- used by attendance/grades) unchanged: it fills class_id from the student
-- when absent and always overrides school_id from the student's real
-- school, which is exactly what results needs too.
drop trigger if exists trg_results_populate_context on public.results;
create trigger trg_results_populate_context
before insert or update on public.results
for each row execute function public.populate_student_context();

create index if not exists idx_subjects_school_id on public.subjects(school_id);
create unique index if not exists idx_subjects_unique_name_school on public.subjects(lower(name), school_id);

create index if not exists idx_class_subjects_class_id on public.class_subjects(class_id);
create index if not exists idx_class_subjects_subject_id on public.class_subjects(subject_id);
create index if not exists idx_class_subjects_school_id on public.class_subjects(school_id);

create index if not exists idx_results_student_id on public.results(student_id);
create index if not exists idx_results_subject_id on public.results(subject_id);
create index if not exists idx_results_class_term on public.results(class_id, term);
create index if not exists idx_results_school_id on public.results(school_id);

alter table public.subjects enable row level security;
alter table public.class_subjects enable row level security;
alter table public.results enable row level security;

drop policy if exists "subjects_select_authenticated" on public.subjects;
create policy "subjects_select_authenticated"
on public.subjects for select
using (school_id = public.current_school_id());

drop policy if exists "subjects_manage_admin" on public.subjects;
create policy "subjects_manage_admin"
on public.subjects for all
using (public.current_app_role() = 'admin' and school_id = public.current_school_id())
with check (public.current_app_role() = 'admin' and school_id = public.current_school_id());

drop policy if exists "class_subjects_select_authenticated" on public.class_subjects;
create policy "class_subjects_select_authenticated"
on public.class_subjects for select
using (school_id = public.current_school_id());

drop policy if exists "class_subjects_manage_admin" on public.class_subjects;
create policy "class_subjects_manage_admin"
on public.class_subjects for all
using (public.current_app_role() = 'admin' and school_id = public.current_school_id())
with check (public.current_app_role() = 'admin' and school_id = public.current_school_id());

-- A student may see only their own results row (tighter than the existing
-- attendance/grades policies, which are same-school-wide for select — built
-- correctly from the start here rather than carrying that looseness
-- forward). Staff (admin/teacher) keep the same same-school scope used
-- throughout the rest of the schema.
drop policy if exists "results_select_staff_or_own" on public.results;
create policy "results_select_staff_or_own"
on public.results for select
using (
  (public.current_app_role() in ('admin', 'teacher') and school_id = public.current_school_id())
  or student_id = (select coalesce(p.related_id, p.id) from public.profiles p where p.id = auth.uid())
);

drop policy if exists "results_manage_admin_teacher" on public.results;
create policy "results_manage_admin_teacher"
on public.results for all
using (public.current_app_role() in ('admin', 'teacher') and school_id = public.current_school_id())
with check (public.current_app_role() in ('admin', 'teacher') and school_id = public.current_school_id());
