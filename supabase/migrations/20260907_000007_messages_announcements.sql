-- Messages: scope to a school and restrict to participants (previously any
-- authenticated user could read every message in the instance).
alter table public.messages add column if not exists school_id uuid references public.schools(id) on delete cascade;
alter table public.messages add column if not exists read_at timestamptz;

update public.messages m
set school_id = p.school_id
from public.profiles p
where m.school_id is null and p.id = m.sender_id;

create index if not exists idx_messages_school_created on public.messages(school_id, created_at desc);
create index if not exists idx_messages_participants on public.messages(sender_id, receiver_id, created_at desc);
create index if not exists idx_messages_receiver_unread on public.messages(receiver_id) where read_at is null;

drop trigger if exists trg_messages_populate_school on public.messages;
create trigger trg_messages_populate_school
before insert on public.messages
for each row execute function public.populate_school_id_from_profile();

alter table public.messages enable row level security;

drop policy if exists "messages_select_authenticated" on public.messages;
drop policy if exists "messages_insert_authenticated" on public.messages;
drop policy if exists "messages_select_participants" on public.messages;
drop policy if exists "messages_insert_sender" on public.messages;
drop policy if exists "messages_update_receiver" on public.messages;

create policy "messages_select_participants"
on public.messages for select
using (auth.uid() in (sender_id, receiver_id) and school_id = public.current_school_id());

create policy "messages_insert_sender"
on public.messages for insert
with check (
  auth.uid() = sender_id
  and sender_id <> receiver_id
  and exists (
    select 1 from public.profiles r
    where r.id = receiver_id and r.school_id = public.current_school_id()
  )
);

create policy "messages_update_receiver"
on public.messages for update
using (auth.uid() = receiver_id)
with check (auth.uid() = receiver_id);

-- Announcements / notice board, targeted by audience role (null = everyone
-- in the school) and optionally a single class.
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  title text not null,
  body text not null,
  audience public.app_role[],
  class_id uuid references public.classes(id) on delete cascade,
  pinned boolean not null default false,
  published_at timestamptz not null default now(),
  expires_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_announcements_school_published on public.announcements(school_id, published_at desc);

drop trigger if exists trg_announcements_set_updated_at on public.announcements;
create trigger trg_announcements_set_updated_at
before update on public.announcements
for each row execute function public.set_updated_at();

drop trigger if exists trg_announcements_populate_school on public.announcements;
create trigger trg_announcements_populate_school
before insert or update on public.announcements
for each row execute function public.populate_school_id_from_profile();

alter table public.announcements enable row level security;

drop policy if exists "announcements_select_school" on public.announcements;
create policy "announcements_select_school"
on public.announcements for select
using (
  school_id = public.current_school_id()
  and (audience is null or public.current_app_role() = any(audience) or public.current_app_role() = 'admin')
  and (expires_at is null or expires_at > now())
);

drop policy if exists "announcements_manage_staff" on public.announcements;
create policy "announcements_manage_staff"
on public.announcements for all
using (public.current_app_role() in ('admin', 'teacher') and school_id = public.current_school_id())
with check (public.current_app_role() in ('admin', 'teacher') and school_id = public.current_school_id());

-- Profiles: let members of the same school see each other's name/role so
-- messaging can show a contact list (still no cross-school visibility).
drop policy if exists "profiles_select_same_school" on public.profiles;
create policy "profiles_select_same_school"
on public.profiles for select
using (school_id is not null and school_id = public.current_school_id());
