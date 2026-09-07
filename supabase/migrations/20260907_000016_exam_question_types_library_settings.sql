-- Exams: short-answer (auto-marked against accepted answers) and essay
-- (teacher-marked) questions alongside multiple choice.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'exam_question_type') then
    create type public.exam_question_type as enum ('mcq', 'short', 'essay');
  end if;
end
$$;

alter table public.exam_questions add column if not exists type public.exam_question_type not null default 'mcq';
alter table public.exam_questions add column if not exists accepted_answers jsonb not null default '[]'::jsonb;  -- short: ["paris","Paris"]
alter table public.exam_questions add column if not exists model_answer text;                                  -- essay: guidance for the marker
alter table public.exam_questions alter column correct_index drop not null;
alter table public.exam_questions drop constraint if exists exam_questions_correct_index_check;
alter table public.exam_questions add constraint exam_questions_correct_index_check check (correct_index is null or correct_index >= 0);
alter table public.exam_questions add constraint exam_questions_type_shape check (
  (type = 'mcq' and correct_index is not null)
  or (type = 'short' and jsonb_array_length(accepted_answers) > 0)
  or (type = 'essay')
);

alter table public.exam_attempts add column if not exists manual_scores jsonb not null default '{}'::jsonb;  -- {question_id: score}
alter table public.exam_attempts add column if not exists auto_score numeric(8,2);
alter table public.exam_attempts add column if not exists needs_grading boolean not null default false;
alter table public.exam_attempts add column if not exists graded_by uuid references auth.users(id) on delete set null;
alter table public.exam_attempts add column if not exists graded_at timestamptz;

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

  select * into v_attempt from public.exam_attempts where exam_id = p_exam_id and student_id = v_student and submitted_at is null order by started_at desc limit 1;
  if not found then
    select count(*) into v_count from public.exam_attempts where exam_id = p_exam_id and student_id = v_student;
    if v_count >= v_exam.max_attempts then raise exception 'No attempts remaining' using errcode = 'P0001'; end if;
    insert into public.exam_attempts (exam_id, student_id, attempt_number, school_id)
    values (p_exam_id, v_student, v_count + 1, v_exam.school_id) returning * into v_attempt;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'type', q.type, 'prompt', q.prompt, 'options', case when q.type = 'mcq' then q.options else '[]'::jsonb end, 'marks', q.marks) order by
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

-- Answers: {question_id: number (mcq index) | string (short/essay text)}
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
  v_auto numeric := 0;
  v_max numeric := 0;
  v_needs boolean := false;
  q record;
  v_deadline timestamptz;
  v_given text;
  v_ok boolean;
begin
  select coalesce(p.related_id, p.id) into v_student from public.profiles p where p.id = auth.uid();
  select * into v_attempt from public.exam_attempts where id = p_attempt_id and student_id = v_student for update;
  if not found then raise exception 'Attempt not found' using errcode = 'P0002'; end if;
  if v_attempt.submitted_at is not null then
    return jsonb_build_object('submitted', true, 'score', v_attempt.score, 'max_score', v_attempt.max_score, 'needs_grading', v_attempt.needs_grading);
  end if;
  select * into v_exam from public.exams where id = v_attempt.exam_id;
  v_deadline := v_attempt.started_at + (v_exam.duration_minutes || ' minutes')::interval + interval '1 minute';

  update public.exam_attempts set answers = coalesce(p_answers, '{}'::jsonb) where id = p_attempt_id;

  if not p_final and now() <= v_deadline then
    return jsonb_build_object('submitted', false);
  end if;

  for q in select id, type, correct_index, accepted_answers, marks from public.exam_questions where exam_id = v_attempt.exam_id loop
    v_max := v_max + q.marks;
    v_given := coalesce(p_answers, '{}'::jsonb) ->> q.id::text;
    if q.type = 'mcq' then
      if v_given is not null and v_given ~ '^\d+$' and v_given::integer = q.correct_index then v_auto := v_auto + q.marks; end if;
    elsif q.type = 'short' then
      select exists (
        select 1 from jsonb_array_elements_text(q.accepted_answers) a
        where lower(regexp_replace(trim(a), '\s+', ' ', 'g')) = lower(regexp_replace(trim(coalesce(v_given, '')), '\s+', ' ', 'g'))
      ) into v_ok;
      if v_ok then v_auto := v_auto + q.marks; end if;
    else
      v_needs := true;
    end if;
  end loop;

  update public.exam_attempts
  set submitted_at = now(), auto_score = v_auto, max_score = v_max,
      needs_grading = v_needs,
      score = case when v_needs then null else v_auto end
  where id = p_attempt_id;

  return jsonb_build_object('submitted', true, 'score', case when v_exam.show_results and not v_needs then v_auto else null end, 'max_score', v_max, 'needs_grading', v_needs);
end;
$$;

-- Staff: record essay marks and finalise the score.
create or replace function public.grade_exam_attempt(p_attempt_id uuid, p_scores jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.exam_attempts%rowtype;
  v_manual numeric := 0;
  q record;
  v_val numeric;
begin
  if public.current_app_role() not in ('admin', 'teacher') then raise exception 'Staff only' using errcode = '42501'; end if;
  select * into v_attempt from public.exam_attempts where id = p_attempt_id and school_id = public.current_school_id() for update;
  if not found then raise exception 'Attempt not found' using errcode = 'P0002'; end if;
  if v_attempt.submitted_at is null then raise exception 'Attempt not submitted yet' using errcode = 'P0001'; end if;

  for q in select id, marks from public.exam_questions where exam_id = v_attempt.exam_id and type = 'essay' loop
    v_val := least(greatest(coalesce((p_scores ->> q.id::text)::numeric, 0), 0), q.marks);
    v_manual := v_manual + v_val;
  end loop;

  update public.exam_attempts
  set manual_scores = coalesce(p_scores, '{}'::jsonb),
      score = coalesce(auto_score, 0) + v_manual,
      needs_grading = false,
      graded_by = auth.uid(),
      graded_at = now()
  where id = p_attempt_id;

  return jsonb_build_object('score', coalesce(v_attempt.auto_score, 0) + v_manual, 'max_score', v_attempt.max_score);
end;
$$;
grant execute on function public.grade_exam_attempt(uuid, jsonb) to authenticated;

-- Library policy as school settings.
alter table public.schools add column if not exists library_fine_per_day numeric(12,2) not null default 50;
alter table public.schools add column if not exists library_loan_days integer not null default 14 check (library_loan_days > 0);
alter table public.schools add column if not exists library_max_loans integer not null default 3 check (library_max_loans > 0);
