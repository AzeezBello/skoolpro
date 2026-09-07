-- (a) profiles.related_id is the pointer from an auth account to its
-- students/teachers row. It was left out of the privileged-column guard
-- (20260730_000004), so any student could re-point their own profile at
-- another student's id: RLS on results/enrollments keys off
-- coalesce(related_id, id), and sync_profile_related_records() would then
-- overwrite the victim's name/email. Protect it exactly like role/school_id.
create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if public.current_app_role() = 'admin' then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'Only an admin can change a profile''s role.';
  end if;

  if new.school_id is distinct from old.school_id then
    raise exception 'Only an admin can change a profile''s school assignment.';
  end if;

  if new.related_id is distinct from old.related_id then
    raise exception 'Only an admin can change which record a profile is linked to.';
  end if;

  return new;
end;
$$;

-- (b) Attendance: one row per student per day. Both entry screens used a
-- plain insert, so re-saving a day duplicated rows and inflated the rates
-- printed on report cards. Keep the most recent row for each duplicate.
with ranked as (
  select id,
         row_number() over (partition by student_id, date order by created_at desc) as rn
  from public.attendance
)
delete from public.attendance a using ranked r where a.id = r.id and r.rn > 1;

alter table public.attendance
  drop constraint if exists attendance_student_date_unique;
alter table public.attendance
  add constraint attendance_student_date_unique unique (student_id, date);

-- Normalise status casing so filters/reports can compare directly.
update public.attendance set status = lower(status) where status <> lower(status);

-- (c) Restore the composite results index lost when results.term was
-- replaced by term_id in 20260730_000007.
create index if not exists idx_results_class_term_id on public.results(class_id, term_id);

-- (d) "Current term": the app previously guessed (first-by-date, latest term
-- of the current session). Make it explicit, at most one per school.
alter table public.terms add column if not exists is_current boolean not null default false;
create unique index if not exists idx_terms_one_current_per_school
  on public.terms(school_id) where is_current;
