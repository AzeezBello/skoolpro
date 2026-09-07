-- Basic school profile fields (logo, contact info, motto, principal name),
-- so generated documents (report cards, invoice receipts) can carry the
-- school's actual branding instead of hardcoded "SkoolPro" placeholder text.
-- Already covered by the existing schools_select_authenticated (same-school
-- read) and schools_manage_admin (admin-only write) RLS policies — these are
-- just new columns on an already-protected table, no new policies needed.

alter table public.schools
  add column if not exists logo_url text,
  add column if not exists address text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists motto text,
  add column if not exists principal_name text;
