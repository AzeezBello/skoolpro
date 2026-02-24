# SkoolPro (Next.js + Supabase)

SkoolPro is a school operations platform with dashboards for students, teachers, attendance, invoices, and payment processing.

## What is now SaaS-ready

- Centralized API auth via bearer token or synced session cookie
- Role checks for sensitive invoice actions (`admin` required)
- Optional multi-tenant scoping for API reads/writes
- Secure internal invoice API with pagination and filters
- Public API token guard for `/api/public/*`
- Hardened Paystack/Flutterwave flows with improved idempotency and invoice-balance updates
- Session-cookie sync for middleware/server-route compatibility
- Baseline security headers and package import optimization

## Quick start

1. Copy `.env.example` to `.env.local`.
2. Fill in all required secrets.
3. Install dependencies:

```bash
npm install
```

4. Run in development:

```bash
npm run dev
```

## Key environment variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=
NEXT_PUBLIC_BASE_URL=
NEXT_PUBLIC_APP_URL=

PAYSTACK_SECRET_KEY=
PAYSTACK_PUBLIC_KEY=
FLW_SECRET_KEY=
FLW_PUBLIC_KEY=
FLW_WEBHOOK_SECRET_HASH=

RESEND_API_KEY=
FROM_EMAIL=

PUBLIC_API_TOKEN=
SAAS_ENABLE_TENANCY=false
SAAS_TENANCY_STRICT=false
SAAS_TENANT_COLUMN=school_id
```

## Tenant configuration

Tenancy is opt-in and controlled by env vars.

- Set `SAAS_ENABLE_TENANCY=true` to enforce tenant-aware filtering in protected invoice APIs.
- Set `SAAS_TENANCY_STRICT=true` to reject authenticated requests that have no tenant context.
- Set `SAAS_TENANT_COLUMN` if your tenant key differs from defaults (`organization_id`, `school_id`, `tenant_id`).

## Public API behavior

Public routes are under `/api/public/*`.

- In development: routes work without token if `PUBLIC_API_TOKEN` is unset.
- In production: `PUBLIC_API_TOKEN` must be configured.
- Pass token using `x-public-api-token` header or `api_token` query string.

## Notes

- Ensure Supabase RLS policies are enabled and aligned with your role/tenant model.
- Payment webhooks should be configured in your gateway dashboards before going live.
