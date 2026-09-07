-- Results approval/publish workflow. Teachers enter scores throughout the
-- term; students and parents only see them once an admin publishes the term.
alter table public.terms add column if not exists results_published boolean not null default false;
alter table public.terms add column if not exists results_published_at timestamptz;

alter table public.results add column if not exists updated_by uuid references auth.users(id) on delete set null;

create or replace function public.stamp_result_actor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    if tg_op = 'INSERT' and new.created_by is null then
      new.created_by := auth.uid();
    end if;
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_results_stamp_actor on public.results;
create trigger trg_results_stamp_actor
before insert or update on public.results
for each row execute function public.stamp_result_actor();

drop policy if exists "results_select_staff_or_own" on public.results;
create policy "results_select_staff_or_own"
on public.results for select
using (
  (public.current_app_role() in ('admin', 'teacher') and school_id = public.current_school_id())
  or (
    exists (select 1 from public.terms t where t.id = results.term_id and t.results_published)
    and (
      student_id = (select coalesce(p.related_id, p.id) from public.profiles p where p.id = auth.uid())
      or public.is_parent_of(student_id)
    )
  )
);
