# SkoolPro (Next.js 15 + Supabase)

Multi-tenant school operations platform: students, teachers, classes, sessions/terms, attendance, results and report cards, fee invoicing with Paystack/Flutterwave, parent portal, messaging, announcements and a platform-operator console.

## Quick start

```bash
cp .env.example .env.local   # fill in Supabase, payment and email keys
npm install
npm run dev
```

Apply the SQL in `supabase/migrations/` to your Supabase project in filename order (Supabase CLI: `supabase db push`).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `npm run build` / `npm start` | Next.js |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (next/core-web-vitals) |
| `npm test` | Vitest unit tests |
| `npm run format` | Prettier |

## Architecture notes

- **Tenancy is always on.** Every API route derives the caller's school from `profiles.school_id` and refuses requests from accounts with no school (except onboarding routes). Suspended schools are refused. RLS enforces the same on direct client queries.
- **Auth/session**: `@supabase/ssr` cookie sessions. `middleware.ts` refreshes sessions and guards `/dashboard`, `/platform`, `/onboarding`. API routes accept either the cookie session or an `Authorization: Bearer` token (`lib/client/authFetch`).
- **Onboarding**: a new signup either creates a school (becoming its admin) or accepts an invitation (`/onboarding`). Admins manage members and invitations under *Team & Access*.
- **Payments**: all crediting goes through the `apply_invoice_payment` Postgres function (row lock + idempotent on gateway reference). Webhooks re-verify with the gateway and credit the settled amount only.
- **Email**: `lib/server/email.ts` wraps Resend and records every send in `email_log`.
- **Audit**: `lib/server/audit.ts` writes `audit_log`; admins see it under *Activity Log*.
- **Plans**: `plans` table with limits enforced by triggers; purchases go through `apply_plan_payment` (idempotent on reference) and expire nightly via `expire_plans`.
- **Overdue invoices**: flipped by trigger on write, nightly by `pg_cron` when available, or by `GET /api/cron/mark-overdue` (Vercel cron, `CRON_SECRET`).
- **Public API** (`/api/public/*`): per-school tokens minted under *School Profile*, stored hashed, sent in `X-API-Token`.

## Feature map

- Onboarding: create a school or accept an invitation; Team & Access for roles, invites, linking logins to teacher/student records, claiming unassigned sign-ups.
- Academics: sessions/terms (current term, results publishing), classes, subjects, enrollment-aware results entry, report cards with positions and class averages, promotion/graduation, timetable, homework with submissions and grading.
- Attendance: per-class daily sheet (present/late/absent/excused), one row per student per day, reports with exports.
- Fees: fee items, single and bulk invoicing, discounts, cancel, manual and online payments (Paystack/Flutterwave), receipts, reminders (email, optional SMS), arrears/aging report.
- Communication: announcements (by role/class), direct messages, in-app notifications, email log.
- Admin: activity log, public API tokens, configurable grading (CA/exam split and letter scale), currency, subscription plan with self-service Paystack or Flutterwave upgrade/renewal, student CSV import/export, printable ID cards.
- Admissions: public application form at `/apply/<school-slug>` (toggle under Admissions), review/accept into a class.
- Modules: library (catalogue, loans, fines and loan period set under School Profile), transport (routes, stops, riders), hostel (rooms, bed allocation), online exams (multiple-choice and short-answer auto-marked, essays marked by the teacher; answers never exposed to students).
- i18n: English, French, Hausa and Yorùbá dictionaries in `lib/i18n`; the shell, auth pages, landing page, and every dashboard page's heading, subtitle, table headers, primary buttons and attendance labels are translated (French complete; Hausa and Yorùbá cover titles and common actions); remaining body copy falls back to English. Add keys to `en` and translate in the other locales.
- Theme: light/dark toggle in the top bar (dashboard); marketing and auth pages stay dark. Installable as a PWA (manifest).
- Platform console: schools, suspension, plan assignment, admin assignment, audited impersonation.

## Roles

| Role | Can |
| --- | --- |
| admin | everything in their school |
| teacher | attendance and results for their classes, reports, messaging |
| student | own attendance, published results, report card, invoices (pay online) |
| parent | linked children's attendance, results, invoices (pay online) |
| platform admin | `/platform`: schools, suspension, impersonation (separate allowlist) |

## Environment

See `.env.example`. `SUPABASE_SERVICE_KEY` is server-only. `PUBLIC_API_TOKEN` is a legacy fallback honoured only while the database holds a single school.
