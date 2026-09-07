-- Explicit promotion path between classes (e.g. JSS1A -> JSS2A), so the
-- "promote everyone up one level" bulk action in the Sessions/Promotion tool
-- has something reliable to follow. Class names have no guaranteed parseable
-- ordering (a school might name classes "Eagles"/"Hawks", or a top class like
-- SS3 has no next class at all), so this is admin-configured rather than
-- inferred from the name string.

alter table public.classes
  add column if not exists next_class_id uuid references public.classes(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'classes_next_class_not_self'
  ) then
    alter table public.classes
      add constraint classes_next_class_not_self check (next_class_id is distinct from id);
  end if;
end
$$;
