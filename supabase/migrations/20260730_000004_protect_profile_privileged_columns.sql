-- Close a second privilege-escalation path found while wiring up onboarding
-- tracking on public.profiles.
--
-- profiles_update_own_or_admin's WITH CHECK only requires auth.uid() = id for
-- a self-update, with no restriction on which columns may change. RLS alone
-- can't express "column X may only change when actor is Y" for UPDATE — USING
-- sees the pre-update row and WITH CHECK sees the post-update row, but
-- neither can compare the two within a single policy expression. That means
-- any authenticated user could currently run, using nothing but the anon key:
--   supabase.from("profiles").update({ role: "admin" }).eq("id", myUserId)
-- and self-promote, entirely bypassing the registration-insert restriction
-- added in 20260730_000001 (which only guards INSERT, not UPDATE).
--
-- A BEFORE UPDATE trigger is the right tool here: it can compare OLD vs NEW
-- directly. Only an admin (promoting/reassigning someone, already scoped to
-- their own school by the RLS policy itself) or the service role (auth.uid()
-- is null in that context, e.g. backend jobs) may change role or school_id.
-- Any other update to your own row leaves those two columns untouched.

create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service-role/backend contexts have no auth.uid(); leave them unrestricted.
  if auth.uid() is null then
    return new;
  end if;

  -- Admins may reassign role/school_id (RLS already limits which rows an
  -- admin can even target to their own school or an unassigned signup).
  if public.current_app_role() = 'admin' then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'Only an admin can change a profile''s role.';
  end if;

  if new.school_id is distinct from old.school_id then
    raise exception 'Only an admin can change a profile''s school assignment.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_protect_privileged_columns on public.profiles;
create trigger trg_profiles_protect_privileged_columns
before update on public.profiles
for each row execute function public.protect_profile_privileged_columns();
