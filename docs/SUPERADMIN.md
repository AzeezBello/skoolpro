# Platform superadmin

A **platform superadmin** (platform operator) is an auth user listed in `public.platform_admins`. That allowlist is separate from the per-school `profiles.role` system: it unlocks the `/platform` console (schools, suspension, plan assignment, admin assignment, audited impersonation) and nothing else. Platform access never depends on a profile or a school.

## Requested account

| Field | Value |
| --- | --- |
| Email | `demolablaze@gmail.com` |
| Password | `$Omerta93` |
| Role | Platform superadmin (`public.platform_admins`) |

## Status of this request

`.env.local` now points at the real project. Two things were corrected on 2026-10-13:

- `NEXT_PUBLIC_SUPABASE_ANON_KEY` had a stray leading `y`; it was removed. Use the same corrected value in Vercel.
- The code reads `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`); the `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` line is unused.

The account is created with Path A once the pending migrations below have been applied; `platform_admins` does not exist until then.

## First: apply the pending migrations

The live project (`vfcqsvxbqwsnvtjxnkae`) only had the initial schema. The Supabase SQL editor runs a pasted script as **one transaction**, and `20260907_000005_parent_role_enum.sql` adds an enum value that cannot be used in the same transaction, so the pending migrations must be run as two scripts, in order:

1. `supabase/pending-migrations-part1.sql` (seed through `20260907_000005_parent_role_enum.sql`)
2. `supabase/pending-migrations-part2.sql` (`20260907_000006` through `20261013_000001`)

Both files are generated from `supabase/migrations/` and are git-ignored. Regenerate them with:

```bash
ALL=($(ls supabase/migrations/*.sql | sort))
gen() { out=$1; shift; { for f in "$@"; do echo "-- $(basename $f)"; cat "$f"; echo; done; } > "$out"; }
gen supabase/pending-migrations-part1.sql "${ALL[@]:1:17}"
gen supabase/pending-migrations-part2.sql "${ALL[@]:18}"
```

Both scripts were dry-run as single transactions against a local `supabase/postgres` container on 2026-10-13 and committed cleanly (45 public tables, demo school seeded). The first attempt had failed on `announcements_select_school` (`text = app_role`); that policy now casts `current_app_role()` to `app_role` before `= any(audience)`.

## Path A (preferred): `npm run superadmin`

Goes through the Supabase Admin API, so GoTrue creates the user, identity and confirmed email exactly as a normal sign-up would.

1. Put the real project values in `.env.local`:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
   SUPABASE_SERVICE_KEY=<service_role key>   # server-only, never commit
   ```

2. Make sure the migrations in `supabase/migrations/` have been applied (at least `20260730_000011_platform_admin.sql`).

3. Run:

   ```bash
   npm run superadmin -- --email demolablaze@gmail.com --password '$Omerta93' --name "Platform Admin"
   ```

   Quote the password in single quotes so the shell does not expand `$O`.

What it does, in order:

1. Creates the auth user with `email_confirm: true`, or updates the password if the email already exists.
2. Upserts the row in `public.platform_admins`.
3. Creates a `profiles` row (name only, no school) if none exists, so the dashboard hooks have a display name.

Re-running is safe. The script refuses to run while the URL is still the placeholder or the service key looks invalid.

## Path B: SQL only

If you only have the Supabase SQL editor, apply `supabase/migrations/20261013_000001_platform_superadmin_function.sql` (it is picked up automatically by `supabase db push`), then run:

```sql
select public.ensure_platform_superadmin('demolablaze@gmail.com', '$Omerta93', 'Platform Admin');
```

The function writes the `auth.users` and `auth.identities` rows with a bcrypt password, confirms the email, and upserts `platform_admins` and `profiles`. It is `SECURITY DEFINER`, revoked from `anon` and `authenticated`, and granted only to `service_role`, so it cannot be called from the app.

Caveat: the local `supabase/postgres` image ships an old stub of `auth.users`, so this function could only be syntax-checked, not executed, outside the hosted project. Its column list matches the current GoTrue schema. Prefer Path A, which lets GoTrue create the user.

## Signing in

1. Open `/login` and sign in with the email and password.
2. The login page now checks `/api/platform/me` first; platform admins are sent straight to `/platform` instead of school onboarding.
3. Platform admins can still create or join a school from `/onboarding` if they also want a school dashboard.

## Verifying

```sql
select u.email, pa.created_at
from public.platform_admins pa
join auth.users u on u.id = pa.id;
```

The row for `demolablaze@gmail.com` should be present, and `GET /api/platform/me` with that user's bearer token returns `{ "email": "demolablaze@gmail.com" }`.
