-- Online exams (CBT): multiple-choice papers per class/subject, timed
-- attempts, auto-marking. Students only see published exams for their class
-- within the window; correct answers are never exposed to students via RLS
-- (questions are read through a SECURITY DEFINER function that strips them).
do $$
begin
  if not exists (select 1 from pg_type where typname = 'exam_status') then
    create type public.exam_status as enum ('draft', 'published', 'closed');
  end if;
end
$$;

create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  term_id uuid references public.terms(id) on delete set null,
  title text not null,
  instructions text,
  duration_minutes integer not null default 30 check (duration_minutes > 0),
  opens_at timestamptz,
  closes_at timestamptz,
  status public.exam_status not null default 'draft',
  shuffle_questions boolean not null default true,
  show_results boolean not null default true,
  max_attempts integer not null default 1 check (max_attempts > 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_exams_class_status on public.exams(class_id, status);
create index if not exists idx_exams_school on public.exams(school_id);

create table if not exists public.exam_questions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  exam_id uuid not null references public.exams(id) on delete cascade,
  position integer not null default 0,
  prompt text not null,
  options jsonb not null default '[]'::jsonb,   -- ["A text", "B text", ...]
  correct_index integer not null check (correct_index >= 0),
  marks numeric(6,2) not null default 1 check (marks > 0),
  created_at timestamptz not null default now()
);
create index if not exists idx_exam_questions_exam on public.exam_questions(exam_id, position);

create table if not exists public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  exam_id uuid not null references public.exams(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  answers jsonb not null default '{}'::jsonb,   -- {question_id: chosen_index}
  score numeric(8,2),
  max_score numeric(8,2),
  attempt_number integer not null default 1,
  unique (exam_id, student_id, attempt_number)
);
create index if not exists idx_exam_attempts_exam on public.exam_attempts(exam_id);
create index if not exists idx_exam_attempts_student on public.exam_attempts(student_id);

drop trigger if exists trg_exams_set_updated_at on public.exams;
create trigger trg_exams_set_updated_at before update on public.exams for each row execute function public.set_updated_at();
drop trigger if exists trg_exams_populate_context on public.exams;
create trigger trg_exams_populate_context before insert or update on public.exams for each row execute function public.populate_class_scoped_context();

create or replace function public.populate_exam_child_context()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_school uuid;
begin
  select e.school_id into v_school from public.exams e where e.id = new.exam_id;
  if v_school is not null then new.school_id := v_school; end if;
  return new;
end;
$$;
drop trigger if exists trg_exam_questions_populate on public.exam_questions;
create trigger trg_exam_questions_populate before insert or update on public.exam_questions for each row execute function public.populate_exam_child_context();
drop trigger if exists trg_exam_attempts_populate on public.exam_attempts;
create trigger trg_exam_attempts_populate before insert or update on public.exam_attempts for each row execute function public.populate_exam_child_context();

alter table public.exams enable row level security;
alter table public.exam_questions enable row level security;
alter table public.exam_attempts enable row level security;

drop policy if exists "exams_select" on public.exams;
create policy "exams_select" on public.exams for select
using (
  school_id = public.current_school_id()
  and (
    public.current_app_role() in ('admin', 'teacher')
    or (
      status = 'published'
      and class_id in (
        select s.class_id from public.students s
        where s.id = (select coalesce(p.related_id, p.id) from public.profiles p where p.id = auth.uid())
           or public.is_parent_of(s.id)
      )
    )
  )
);
drop policy if exists "exams_manage_staff" on public.exams;
create policy "exams_manage_staff" on public.exams for all
using (public.current_app_role() in ('admin', 'teacher') and school_id = public.current_school_id())
with check (public.current_app_role() in ('admin', 'teacher') and school_id = public.current_school_id());

-- Questions (with answers) are staff-only through the table; students use
-- the function below.
drop policy if exists "exam_questions_staff" on public.exam_questions;
create policy "exam_questions_staff" on public.exam_questions for all
using (public.current_app_role() in ('admin', 'teacher') and school_id = public.current_school_id())
with check (public.current_app_role() in ('admin', 'teacher') and school_id = public.current_school_id());

drop policy if exists "exam_attempts_select" on public.exam_attempts;
create policy "exam_attempts_select" on public.exam_attempts for select
using (
  (public.current_app_role() in ('admin', 'teacher') and school_id = public.current_school_id())
  or student_id = (select coalesce(p.related_id, p.id) from public.profiles p where p.id = auth.uid())
  or public.is_parent_of(student_id)
);
drop policy if exists "exam_attempts_staff_manage" on public.exam_attempts;
create policy "exam_attempts_staff_manage" on public.exam_attempts for all
using (public.current_app_role() in ('admin', 'teacher') and school_id = public.current_school_id())
with check (public.current_app_role() in ('admin', 'teacher') and school_id = public.current_school_id());

-- Student-facing: start an attempt and fetch questions without answers.
create or replace function public.start_exam_attempt(p_exam_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student uuid;
  v_exam public.exams%rowtype;
  v_attempt public.exam_attempts%rowtype;
  v_count integer;
  v_questions jsonb;
begin
  select coalesce(p.related_id, p.id) into v_student from public.profiles p where p.id = auth.uid() and p.role = 'student';
  if v_student is null then raise exception 'Only students can take exams' using errcode = '42501'; end if;

  select * into v_exam from public.exams where id = p_exam_id;
  if not found or v_exam.status <> 'published' then raise exception 'Exam is not available' using errcode = 'P0001'; end if;
  if v_exam.opens_at is not null and now() < v_exam.opens_at then raise exception 'Exam has not opened yet' using errcode = 'P0001'; end if;
  if v_exam.closes_at is not null and now() > v_exam.closes_at then raise exception 'Exam is closed' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.students s where s.id = v_student and s.class_id = v_exam.class_id) then
    raise exception 'This exam is not for your class' using errcode = '42501';
  end if;

  -- Resume an open attempt if one exists.
  select * into v_attempt from public.exam_attempts where exam_id = p_exam_id and student_id = v_student and submitted_at is null order by started_at desc limit 1;
  if not found then
    select count(*) into v_count from public.exam_attempts where exam_id = p_exam_id and student_id = v_student;
    if v_count >= v_exam.max_attempts then raise exception 'No attempts remaining' using errcode = 'P0001'; end if;
    insert into public.exam_attempts (exam_id, student_id, attempt_number, school_id)
    values (p_exam_id, v_student, v_count + 1, v_exam.school_id) returning * into v_attempt;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'prompt', q.prompt, 'options', q.options, 'marks', q.marks) order by
           case when v_exam.shuffle_questions then random() else q.position end), '[]'::jsonb)
  into v_questions from public.exam_questions q where q.exam_id = p_exam_id;

  return jsonb_build_object(
    'attempt_id', v_attempt.id,
    'started_at', v_attempt.started_at,
    'ends_at', v_attempt.started_at + (v_exam.duration_minutes || ' minutes')::interval,
    'answers', v_attempt.answers,
    'questions', v_questions
  );
end;
$$;

-- Save progress / submit. Auto-marks on submit.
create or replace function public.submit_exam_attempt(p_attempt_id uuid, p_answers jsonb, p_final boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student uuid;
  v_attempt public.exam_attempts%rowtype;
  v_exam public.exams%rowtype;
  v_score numeric := 0;
  v_max numeric := 0;
  q record;
  v_deadline timestamptz;
begin
  select coalesce(p.related_id, p.id) into v_student from public.profiles p where p.id = auth.uid();
  select * into v_attempt from public.exam_attempts where id = p_attempt_id and student_id = v_student for update;
  if not found then raise exception 'Attempt not found' using errcode = 'P0002'; end if;
  if v_attempt.submitted_at is not null then
    return jsonb_build_object('submitted', true, 'score', v_attempt.score, 'max_score', v_attempt.max_score);
  end if;
  select * into v_exam from public.exams where id = v_attempt.exam_id;
  v_deadline := v_attempt.started_at + (v_exam.duration_minutes || ' minutes')::interval + interval '1 minute';

  update public.exam_attempts set answers = coalesce(p_answers, '{}'::jsonb) where id = p_attempt_id;

  if not p_final and now() <= v_deadline then
    return jsonb_build_object('submitted', false);
  end if;

  for q in select id, correct_index, marks from public.exam_questions where exam_id = v_attempt.exam_id loop
    v_max := v_max + q.marks;
    if (coalesce(p_answers, '{}'::jsonb) ->> q.id::text)::integer = q.correct_index then
      v_score := v_score + q.marks;
    end if;
  end loop;

  update public.exam_attempts set submitted_at = now(), score = v_score, max_score = v_max where id = p_attempt_id;
  return jsonb_build_object('submitted', true, 'score', case when v_exam.show_results then v_score else null end, 'max_score', v_max);
end;
$$;

grant execute on function public.start_exam_attempt(uuid) to authenticated;
grant execute on function public.submit_exam_attempt(uuid, jsonb, boolean) to authenticated;
