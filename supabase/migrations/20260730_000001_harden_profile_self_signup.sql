-- Close a privilege-escalation hole: the previous "profiles_insert_own" policy
-- only checked auth.uid() = id, so any newly signed-up user could insert their
-- own profile row with role = 'admin' (or 'teacher') and immediately gain
-- every admin-gated RLS permission (schools_manage_admin, students_manage_admin,
-- invoices_manage_admin, payments_manage_admin, etc.) with no verification.
--
-- Self-service signups may now only create their own profile as role='student'
-- with no school assignment. Promoting a user to teacher/admin, or attaching
-- them to a school, requires an existing admin to update the profile via the
-- "profiles_update_own_or_admin" policy, which is unaffected by this change.
--
-- The one-time first-admin bootstrap trigger (bootstrap_first_admin_profile)
-- is a SECURITY DEFINER function owned by the migration role and therefore
-- bypasses RLS, so it continues to work unchanged.

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
with check (
  auth.uid() = id
  and role = 'student'::public.app_role
  and school_id is null
);
