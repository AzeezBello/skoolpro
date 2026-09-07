-- Tracks whether a user has completed the in-app onboarding flow (welcome
-- steps + guided product tour), so it survives across devices/browsers
-- instead of living in localStorage. Self-updatable under the existing
-- profiles_update_own_or_admin RLS policy; the new
-- protect_profile_privileged_columns trigger only guards role/school_id, so
-- this column is unaffected by it.

alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz;
