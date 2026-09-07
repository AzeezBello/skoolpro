-- Per-school grading configuration: CA/exam maxima and the letter scale.
-- The hard-coded CHECK constraints (ca <= 40, exam <= 60) are replaced by a
-- trigger that validates against the owning school's config.
alter table public.schools add column if not exists grading_config jsonb not null default
  '{"ca_max": 40, "exam_max": 60, "scale": [{"min": 70, "grade": "A", "remark": "Excellent"}, {"min": 60, "grade": "B", "remark": "Very good"}, {"min": 50, "grade": "C", "remark": "Good"}, {"min": 45, "grade": "D", "remark": "Pass"}, {"min": 40, "grade": "E", "remark": "Weak pass"}, {"min": 0, "grade": "F", "remark": "Fail"}]}'::jsonb;

alter table public.results drop constraint if exists results_ca_score_check;
alter table public.results drop constraint if exists results_exam_score_check;
alter table public.results add constraint results_ca_score_nonneg check (ca_score is null or ca_score >= 0);
alter table public.results add constraint results_exam_score_nonneg check (exam_score is null or exam_score >= 0);

create or replace function public.validate_result_scores()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ca_max numeric;
  v_exam_max numeric;
begin
  select coalesce((s.grading_config ->> 'ca_max')::numeric, 40), coalesce((s.grading_config ->> 'exam_max')::numeric, 60)
  into v_ca_max, v_exam_max
  from public.schools s
  where s.id = new.school_id;

  if new.ca_score is not null and new.ca_score > coalesce(v_ca_max, 40) then
    raise exception 'CA score % exceeds the maximum of %', new.ca_score, coalesce(v_ca_max, 40) using errcode = '23514';
  end if;
  if new.exam_score is not null and new.exam_score > coalesce(v_exam_max, 60) then
    raise exception 'Exam score % exceeds the maximum of %', new.exam_score, coalesce(v_exam_max, 60) using errcode = '23514';
  end if;
  return new;
end;
$$;

-- Must fire after populate_result_context (which fills school_id); trigger
-- names fire alphabetically, hence the "z".
drop trigger if exists trg_z_results_validate_scores on public.results;
create trigger trg_z_results_validate_scores
before insert or update on public.results
for each row execute function public.validate_result_scores();
