-- Service-role helper to create or repair a platform superadmin straight from
-- SQL (Supabase SQL editor or psql) when running the Node script isn't
-- convenient. The preferred path is still `npm run superadmin`, which goes
-- through the GoTrue Admin API; this function writes the same rows directly.
--
-- It is SECURITY DEFINER and revoked from anon/authenticated, so only the
-- service role (or the SQL editor, which runs as postgres) can call it.
--
-- Usage:
--   select public.ensure_platform_superadmin('you@example.com', 'YourPassword', 'Full Name');

create extension if not exists pgcrypto;

create or replace function public.ensure_platform_superadmin(
  p_email text,
  p_password text,
  p_full_name text default 'Platform Admin'
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_email text := lower(trim(p_email));
  v_user_id uuid;
  v_encrypted text;
begin
  if v_email is null or position('@' in v_email) = 0 then
    raise exception 'A valid email is required';
  end if;
  if p_password is null or length(p_password) < 8 then
    raise exception 'Password must be at least 8 characters';
  end if;

  v_encrypted := extensions.crypt(p_password, extensions.gen_salt('bf'));

  select id into v_user_id from auth.users where lower(email) = v_email limit 1;

  if v_user_id is null then
    v_user_id := gen_random_uuid();

    -- GoTrue expects the token columns to be empty strings, not NULL; NULLs
    -- make it fail with "Database error querying schema" on login.
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at,
      recovery_token, recovery_sent_at, email_change_token_new, email_change,
      email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
      is_super_admin, created_at, updated_at, phone, phone_confirmed_at,
      phone_change, phone_change_token, phone_change_sent_at,
      email_change_token_current, email_change_confirm_status, banned_until,
      reauthentication_token, reauthentication_sent_at, is_sso_user, deleted_at
    ) values (
      '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
      v_email, v_encrypted,
      now(), null, '', null,
      '', null, '', '',
      null, null,
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      jsonb_build_object('full_name', p_full_name),
      false, now(), now(), null, null,
      '', '', null,
      '', 0, null,
      '', null, false, null
    );

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_user_id, v_user_id::text,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
      'email', now(), now(), now()
    );
  else
    update auth.users
    set encrypted_password = v_encrypted,
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('full_name', p_full_name),
        updated_at = now()
    where id = v_user_id;
  end if;

  insert into public.platform_admins (id, full_name)
  values (v_user_id, p_full_name)
  on conflict (id) do update set full_name = excluded.full_name;

  -- A profile row so dashboard hooks have a display name; the role is left
  -- as-is for existing accounts and starts as the unassigned default for new
  -- ones. Platform access never depends on profiles.role.
  insert into public.profiles (id, full_name, role)
  values (v_user_id, p_full_name, 'student'::public.app_role)
  on conflict (id) do update
    set full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name),
        updated_at = now();

  return v_user_id;
end;
$$;

revoke all on function public.ensure_platform_superadmin(text, text, text) from public;
revoke all on function public.ensure_platform_superadmin(text, text, text) from anon;
revoke all on function public.ensure_platform_superadmin(text, text, text) from authenticated;
grant execute on function public.ensure_platform_superadmin(text, text, text) to service_role;
