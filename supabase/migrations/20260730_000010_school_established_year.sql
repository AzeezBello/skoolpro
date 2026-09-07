-- "Established year" for the school profile — shown as "Est. YYYY" next to
-- the school name on generated documents (report cards, receipts).
--
-- The upper bound is a static literal, not a now()-derived one: Postgres
-- CHECK constraints must be immutable expressions, and now()/current_date
-- are not, so an upper bound like "<= extract(year from now())" would be
-- rejected outright. 2100 is just a generous fixed sanity ceiling.

alter table public.schools
  add column if not exists established_year integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'schools_established_year_range'
  ) then
    alter table public.schools
      add constraint schools_established_year_range
      check (established_year is null or established_year between 1600 and 2100);
  end if;
end
$$;
