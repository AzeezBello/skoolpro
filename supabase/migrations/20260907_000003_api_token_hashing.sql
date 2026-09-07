-- Public API tokens were stored in plaintext and looked up by equality, with
-- no expiry or revocation. Store only a SHA-256 hash; the plaintext is shown
-- to the admin once at creation time and never persisted.
alter table public.api_tokens add column if not exists token_hash text;
alter table public.api_tokens add column if not exists expires_at timestamptz;
alter table public.api_tokens add column if not exists revoked_at timestamptz;
alter table public.api_tokens add column if not exists last_used_at timestamptz;
alter table public.api_tokens add column if not exists created_by uuid references auth.users(id) on delete set null;

update public.api_tokens
set token_hash = encode(digest(token, 'sha256'), 'hex')
where token_hash is null and token is not null;

alter table public.api_tokens drop column if exists token;
alter table public.api_tokens alter column token_hash set not null;
create unique index if not exists idx_api_tokens_token_hash on public.api_tokens(token_hash);
