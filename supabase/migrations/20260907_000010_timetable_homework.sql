-- Timetable: weekly periods per class. Homework/assignments: set by
-- teachers per class+subject, visible to students/parents in that class.

create table if not exists public.timetable_slots (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  teacher_id uuid references public.teachers(id) on delete set null,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  start_time time not null,
  end_time time not null,
  room text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

create index if not exists idx_timetable_class_day on public.timetable_slots(class_id, day_of_week, start_time);
create index if not exists idx_timetable_teacher_day on public.timetable_slots(teacher_id, day_of_week, start_time);
create index if not exists idx_timetable_school on public.timetable_slots(school_id);

create or replace function public.populate_class_scoped_context()
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

drop trigger if exists trg_timetable_populate_context on public.timetable_slots;
create trigger trg_timetable_populate_context
before insert or update on public.timetable_slots
for each row execute function public.populate_class_scoped_context();

drop trigger if exists trg_timetable_set_updated_at on public.timetable_slots;
create trigger trg_timetable_set_updated_at
before update on public.timetable_slots
for each row execute function public.set_updated_at();

alter table public.timetable_slots enable row level security;

-- Anyone in the school can read the timetable (students/parents need it).
drop policy if exists "timetable_select_school" on public.timetable_slots;
create policy "timetable_select_school"
on public.timetable_slots for select
using (school_id = public.current_school_id());

drop policy if exists "timetable_manage_admin" on public.timetable_slots;
create policy "timetable_manage_admin"
on public.timetable_slots for all
using (public.current_app_role() = 'admin' and school_id = public.current_school_id())
with check (public.current_app_role() = 'admin' and school_id = public.current_school_id());

-- Homework
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  title text not null,
  instructions text,
  due_date date,
  max_score numeric(6,2),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_assignments_class_due on public.assignments(class_id, due_date desc);
create index if not exists idx_assignments_school on public.assignments(school_id);

drop trigger if exists trg_assignments_populate_context on public.assignments;
create trigger trg_assignments_populate_context
before insert or update on public.assignments
for each row execute function public.populate_class_scoped_context();

drop trigger if exists trg_assignments_set_updated_at on public.assignments;
create trigger trg_assignments_set_updated_at
before update on public.assignments
for each row execute function public.set_updated_at();

create table if not exists public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  school_id uuid references public.schools(id) on delete cascade,
  content text,
  attachment_url text,
  submitted_at timestamptz not null default now(),
  score numeric(6,2),
  feedback text,
  graded_by uuid references auth.users(id) on delete set null,
  graded_at timestamptz,
  unique (assignment_id, student_id)
);

create index if not exists idx_submissions_assignment on public.assignment_submissions(assignment_id);
create index if not exists idx_submissions_student on public.assignment_submissions(student_id);

create or replace function public.populate_submission_context()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id uuid;
begin
  select a.school_id into v_school_id from public.assignments a where a.id = new.assignment_id;
  if v_school_id is not null then
    new.school_id := v_school_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_submissions_populate_context on public.assignment_submissions;
create trigger trg_submissions_populate_context
before insert or update on public.assignment_submissions
for each row execute function public.populate_submission_context();

alter table public.assignments enable row level security;
alter table public.assignment_submissions enable row level security;

-- Students/parents see assignments for the student's class; staff see all.
drop policy if exists "assignments_select" on public.assignments;
create policy "assignments_select"
on public.assignments for select
using (
  school_id = public.current_school_id()
  and (
    public.current_app_role() in ('admin', 'teacher')
    or class_id in (
      select s.class_id from public.students s
      where s.id = (select coalesce(p.related_id, p.id) from public.profiles p where p.id = auth.uid())
         or public.is_parent_of(s.id)
    )
  )
);

drop policy if exists "assignments_manage_staff" on public.assignments;
create policy "assignments_manage_staff"
on public.assignments for all
using (public.current_app_role() in ('admin', 'teacher') and school_id = public.current_school_id())
with check (public.current_app_role() in ('admin', 'teacher') and school_id = public.current_school_id());

drop policy if exists "submissions_select" on public.assignment_submissions;
create policy "submissions_select"
on public.assignment_submissions for select
using (
  (public.current_app_role() in ('admin', 'teacher') and school_id = public.current_school_id())
  or student_id = (select coalesce(p.related_id, p.id) from public.profiles p where p.id = auth.uid())
  or public.is_parent_of(student_id)
);

drop policy if exists "submissions_insert_student" on public.assignment_submissions;
create policy "submissions_insert_student"
on public.assignment_submissions for insert
with check (student_id = (select coalesce(p.related_id, p.id) from public.profiles p where p.id = auth.uid()));

drop policy if exists "submissions_update_student_or_staff" on public.assignment_submissions;
create policy "submissions_update_student_or_staff"
on public.assignment_submissions for update
using (
  (public.current_app_role() in ('admin', 'teacher') and school_id = public.current_school_id())
  or (student_id = (select coalesce(p.related_id, p.id) from public.profiles p where p.id = auth.uid()) and graded_at is null)
);
