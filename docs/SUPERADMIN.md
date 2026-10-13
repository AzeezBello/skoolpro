# Platform superadmin

A **platform superadmin** (platform operator) is an auth user listed in `public.platform_admins`. That allowlist is separate from the per-school `profiles.role` system: it unlocks the `/platform` console (schools, suspension, plan assignment, admin assignment, audited impersonation) and nothing else. Platform access never depends on a profile or a school.

## Requested account

| Field | Value |
| --- | --- |
| Email | `demolablaze@gmail.com` |
| Password | `$Omerta93` |
| Role | Platform superadmin (`public.platform_admins`) |

## Status of this request

The account **could not be created from this workspace** because no live SkoolPro database is reachable:

- `.env.local` still holds the placeholder values from `.env.example` (`https://your-project.supabase.co`, a 21-character service key).
- None of the Supabase projects connected to the Claude Supabase integration (`vam-attendance`, `agently`, `Voice Agent Knowledge base`, `Agentor AI`) contain the SkoolPro schema (`schools`, `profiles`, `platform_admins`).

Everything needed to create it is ready and idempotent. Run one of the two paths below against the real project.

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
