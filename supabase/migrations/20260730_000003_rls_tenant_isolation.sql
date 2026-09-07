-- Real tenant isolation, enforced in the database instead of relying on the
-- app opting in via SAAS_ENABLE_TENANCY.
--
-- Every "select_authenticated" policy from the initial schema used
-- `using (auth.role() = 'authenticated')` — meaning any logged-in user, from
-- any school, could read every other school's teachers/classes/students/
-- invoices/payments/attendance/grades. And every "manage_admin" policy only
-- checked `current_app_role() = 'admin'`, with no school check at all, so an
-- admin from School A could read *and write* School B's data outright.
--
-- Postgres RLS policies for the same command are OR'd together, so tightening
-- only the "select" policy is not enough on its own: the "manage_admin"
-- policies also grant SELECT (they're `for all`), so both had to be scoped or
-- the manage policy alone would still leak cross-school reads.
--
-- public.current_school_id() already existed (defined in the init migration)
-- and does exactly what's needed here: the school_id of the calling user's
-- own profile. This migration scopes every policy to that value.
--
-- This applies unconditionally, regardless of SAAS_ENABLE_TENANCY: in the
-- default single-school deployment every profile shares the same school_id,
-- so nothing changes for that case. In a multi-school deployment, it's now
-- the database — not an app-layer filter that could be skipped or forgotten
-- in some code path — that guarantees isolation.
--
-- Known limitation left out of scope here: self-service signups get
-- school_id = null (see 20260730_000001), and any admin can "claim" an
-- unassigned profile into their own school (see profiles policies below) —
-- there's no school-specific signup link/domain yet to route new users to
-- the right school automatically, so first-claim-wins across the whole
-- instance. Also out of scope: public.messages has no school_id column, so
-- direct messaging is intentionally left unscoped by this migration.

-- schools: a user may only see/manage their own school, not the full list.
drop policy if exists "schools_select_authenticated" on public.schools;
create policy "schools_select_authenticated"
on public.schools for select
using (id = public.current_school_id());

drop policy if exists "schools_manage_admin" on public.schools;
create policy "schools_manage_admin"
on public.schools for all
using (public.current_app_role() = 'admin' and id = public.current_school_id())
with check (public.current_app_role() = 'admin' and id = public.current_school_id());

-- profiles: an admin may act on profiles in their own school, or on
-- not-yet-assigned self-signups (school_id is null) in order to onboard
-- them — but never on another school's existing members.
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
on public.profiles for select
using (
  auth.uid() = id
  or (
    public.current_app_role() = 'admin'
    and (school_id = public.current_school_id() or school_id is null)
  )
);

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin"
on public.profiles for update
using (
  auth.uid() = id
  or (
    public.current_app_role() = 'admin'
    and (school_id = public.current_school_id() or school_id is null)
  )
)
with check (
  auth.uid() = id
  or (public.current_app_role() = 'admin' and school_id = public.current_school_id())
);

-- teachers / classes / students / fee_items / invoices / payments: same
-- shape throughout — select is scoped to the caller's school, and the admin
-- "manage" policy additionally requires the row already belongs to (or, for
-- inserts, is being created in) that same school.
drop policy if exists "teachers_select_authenticated" on public.teachers;
create policy "teachers_select_authenticated"
on public.teachers for select
using (school_id = public.current_school_id());

drop policy if exists "teachers_manage_admin" on public.teachers;
create policy "teachers_manage_admin"
on public.teachers for all
using (public.current_app_role() = 'admin' and school_id = public.current_school_id())
with check (public.current_app_role() = 'admin' and school_id = public.current_school_id());

drop policy if exists "classes_select_authenticated" on public.classes;
create policy "classes_select_authenticated"
on public.classes for select
using (school_id = public.current_school_id());

drop policy if exists "classes_manage_admin" on public.classes;
create policy "classes_manage_admin"
on public.classes for all
using (public.current_app_role() = 'admin' and school_id = public.current_school_id())
with check (public.current_app_role() = 'admin' and school_id = public.current_school_id());

drop policy if exists "students_select_authenticated" on public.students;
create policy "students_select_authenticated"
on public.students for select
using (school_id = public.current_school_id());

drop policy if exists "students_manage_admin" on public.students;
create policy "students_manage_admin"
on public.students for all
using (public.current_app_role() = 'admin' and school_id = public.current_school_id())
with check (public.current_app_role() = 'admin' and school_id = public.current_school_id());

drop policy if exists "fee_items_select_authenticated" on public.fee_items;
create policy "fee_items_select_authenticated"
on public.fee_items for select
using (school_id = public.current_school_id());

drop policy if exists "fee_items_manage_admin" on public.fee_items;
create policy "fee_items_manage_admin"
on public.fee_items for all
using (public.current_app_role() = 'admin' and school_id = public.current_school_id())
with check (public.current_app_role() = 'admin' and school_id = public.current_school_id());

drop policy if exists "invoices_select_authenticated" on public.invoices;
create policy "invoices_select_authenticated"
on public.invoices for select
using (school_id = public.current_school_id());

drop policy if exists "invoices_manage_admin" on public.invoices;
create policy "invoices_manage_admin"
on public.invoices for all
using (public.current_app_role() = 'admin' and school_id = public.current_school_id())
with check (public.current_app_role() = 'admin' and school_id = public.current_school_id());

drop policy if exists "payments_select_authenticated" on public.payments;
create policy "payments_select_authenticated"
on public.payments for select
using (school_id = public.current_school_id());

drop policy if exists "payments_manage_admin" on public.payments;
create policy "payments_manage_admin"
on public.payments for all
using (public.current_app_role() = 'admin' and school_id = public.current_school_id())
with check (public.current_app_role() = 'admin' and school_id = public.current_school_id());

-- attendance / grades: same shape, but managed by admin or teacher.
drop policy if exists "attendance_select_authenticated" on public.attendance;
create policy "attendance_select_authenticated"
on public.attendance for select
using (school_id = public.current_school_id());

drop policy if exists "attendance_manage_admin_teacher" on public.attendance;
create policy "attendance_manage_admin_teacher"
on public.attendance for all
using (public.current_app_role() in ('admin', 'teacher') and school_id = public.current_school_id())
with check (public.current_app_role() in ('admin', 'teacher') and school_id = public.current_school_id());

drop policy if exists "grades_select_authenticated" on public.grades;
create policy "grades_select_authenticated"
on public.grades for select
using (school_id = public.current_school_id());

drop policy if exists "grades_manage_admin_teacher" on public.grades;
create policy "grades_manage_admin_teacher"
on public.grades for all
using (public.current_app_role() in ('admin', 'teacher') and school_id = public.current_school_id())
with check (public.current_app_role() in ('admin', 'teacher') and school_id = public.current_school_id());

-- notifications: select/update were already scoped to the recipient, which
-- is not a tenant leak by itself. The insert policy, however, let any
-- authenticated user create a notification addressed to any recipient_id
-- across any school; scope it to the sender's own school for consistency
-- with everything else (it does not verify the recipient is a member of
-- that school, since notifications has no direct link to the recipient's
-- profile beyond recipient_id).
drop policy if exists "notifications_insert_authenticated" on public.notifications;
create policy "notifications_insert_authenticated"
on public.notifications for insert
with check (school_id = public.current_school_id());
