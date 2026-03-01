-- Seed + bootstrap migration
-- - Seeds first school
-- - Seeds sample fee items and classes
-- - Bootstraps first auth user as admin profile

do $$
declare
  v_school_id uuid;
  v_teacher_1 uuid;
  v_teacher_2 uuid;
begin
  insert into public.schools (name, slug, settings)
  values (
    'SkoolPro Demo School',
    'skoolpro-demo-school',
    '{"currency":"NGN","country":"NG","timezone":"Africa/Lagos"}'::jsonb
  )
  on conflict (slug) do update
    set name = excluded.name,
        settings = excluded.settings,
        updated_at = now();

  select id
  into v_school_id
  from public.schools
  where slug = 'skoolpro-demo-school'
  limit 1;

  -- Sample fee items
  insert into public.fee_items (name, amount, description, school_id)
  values
    ('Tuition Fee', 50000, 'Standard tuition for the term', v_school_id),
    ('Exam Fee', 10000, 'Term examination fee', v_school_id),
    ('PTA Levy', 5000, 'Parent-Teacher Association levy', v_school_id)
  on conflict (lower(name), school_id) do update
    set amount = excluded.amount,
        description = excluded.description,
        updated_at = now();

  -- Sample teachers (insert only when missing)
  if not exists (
    select 1
    from public.teachers
    where school_id = v_school_id
      and lower(full_name) = lower('Ada Okafor')
  ) then
    insert into public.teachers (full_name, subject, email, school_id)
    values ('Ada Okafor', 'Mathematics', 'ada.okafor@demo.skoolpro.app', v_school_id);
  end if;

  if not exists (
    select 1
    from public.teachers
    where school_id = v_school_id
      and lower(full_name) = lower('Tunde Balogun')
  ) then
    insert into public.teachers (full_name, subject, email, school_id)
    values ('Tunde Balogun', 'English', 'tunde.balogun@demo.skoolpro.app', v_school_id);
  end if;

  select id into v_teacher_1
  from public.teachers
  where school_id = v_school_id
    and lower(full_name) = lower('Ada Okafor')
  order by created_at asc
  limit 1;

  select id into v_teacher_2
  from public.teachers
  where school_id = v_school_id
    and lower(full_name) = lower('Tunde Balogun')
  order by created_at asc
  limit 1;

  -- Sample classes
  insert into public.classes (name, teacher_id, school_id)
  values
    ('JSS1A', v_teacher_1, v_school_id),
    ('JSS2A', v_teacher_2, v_school_id)
  on conflict (lower(name), school_id) do update
    set teacher_id = excluded.teacher_id,
        updated_at = now();
end
$$;

create or replace function public.bootstrap_first_admin_profile()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_profile_count bigint;
  v_school_id uuid;
  v_full_name text;
begin
  -- Only bootstrap when there are no profiles yet.
  select count(*) into v_profile_count from public.profiles;
  if v_profile_count > 0 then
    return new;
  end if;

  select id
  into v_school_id
  from public.schools
  where slug = 'skoolpro-demo-school'
  limit 1;

  if v_school_id is null then
    insert into public.schools (name, slug)
    values ('SkoolPro Demo School', 'skoolpro-demo-school')
    on conflict (slug) do update set updated_at = now();

    select id
    into v_school_id
    from public.schools
    where slug = 'skoolpro-demo-school'
    limit 1;
  end if;

  v_full_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    split_part(coalesce(new.email, 'admin@local'), '@', 1)
  );

  insert into public.profiles (id, full_name, role, school_id)
  values (new.id, v_full_name, 'admin'::public.app_role, v_school_id)
  on conflict (id) do update
    set full_name = excluded.full_name,
        role = 'admin'::public.app_role,
        school_id = coalesce(public.profiles.school_id, excluded.school_id),
        updated_at = now();

  update public.schools
  set owner_user_id = new.id,
      updated_at = now()
  where id = v_school_id
    and owner_user_id is null;

  return new;
end;
$$;

drop trigger if exists trg_bootstrap_first_admin_profile on auth.users;
create trigger trg_bootstrap_first_admin_profile
after insert on auth.users
for each row execute function public.bootstrap_first_admin_profile();

-- Backfill existing first auth user as admin when profiles table is still empty.
do $$
declare
  v_user record;
  v_school_id uuid;
  v_full_name text;
begin
  if not exists (select 1 from public.profiles) then
    select id
    into v_school_id
    from public.schools
    where slug = 'skoolpro-demo-school'
    limit 1;

    select id, email, raw_user_meta_data
    into v_user
    from auth.users
    order by created_at asc
    limit 1;

    if found and not exists (select 1 from public.profiles where id = v_user.id) then
      v_full_name := coalesce(
        nullif(trim(v_user.raw_user_meta_data ->> 'full_name'), ''),
        split_part(coalesce(v_user.email, 'admin@local'), '@', 1)
      );

      insert into public.profiles (id, full_name, role, school_id)
      values (v_user.id, v_full_name, 'admin'::public.app_role, v_school_id)
      on conflict (id) do update
        set full_name = excluded.full_name,
            role = 'admin'::public.app_role,
            school_id = coalesce(public.profiles.school_id, excluded.school_id),
            updated_at = now();

      update public.schools
      set owner_user_id = v_user.id,
          updated_at = now()
      where id = v_school_id
        and owner_user_id is null;
    end if;
  end if;
end
$$;
