-- Library: catalogue, physical copies, loans and fines.
create table if not exists public.library_books (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  title text not null,
  author text,
  isbn text,
  category text,
  publisher text,
  year integer,
  total_copies integer not null default 1 check (total_copies >= 0),
  available_copies integer not null default 1 check (available_copies >= 0),
  shelf text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_library_books_school on public.library_books(school_id, title);

create table if not exists public.library_loans (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  book_id uuid not null references public.library_books(id) on delete cascade,
  student_id uuid references public.students(id) on delete set null,
  teacher_id uuid references public.teachers(id) on delete set null,
  borrowed_at date not null default current_date,
  due_date date not null,
  returned_at date,
  fine_amount numeric(12,2) not null default 0,
  fine_paid boolean not null default false,
  issued_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (student_id is not null or teacher_id is not null)
);
create index if not exists idx_library_loans_school_open on public.library_loans(school_id) where returned_at is null;
create index if not exists idx_library_loans_student on public.library_loans(student_id);

drop trigger if exists trg_library_books_set_updated_at on public.library_books;
create trigger trg_library_books_set_updated_at before update on public.library_books for each row execute function public.set_updated_at();
drop trigger if exists trg_library_books_populate_school on public.library_books;
create trigger trg_library_books_populate_school before insert or update on public.library_books for each row execute function public.populate_school_id_from_profile();
drop trigger if exists trg_library_loans_populate_school on public.library_loans;
create trigger trg_library_loans_populate_school before insert or update on public.library_loans for each row execute function public.populate_school_id_from_profile();

-- Keep available_copies in step with open loans.
create or replace function public.library_loan_adjust_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.returned_at is null then
    update public.library_books set available_copies = available_copies - 1 where id = new.book_id and available_copies > 0;
    if not found then
      raise exception 'No copies of this book are available' using errcode = 'P0001';
    end if;
  elsif tg_op = 'UPDATE' and old.returned_at is null and new.returned_at is not null then
    update public.library_books set available_copies = least(available_copies + 1, total_copies) where id = new.book_id;
  elsif tg_op = 'DELETE' and old.returned_at is null then
    update public.library_books set available_copies = least(available_copies + 1, total_copies) where id = old.book_id;
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists trg_library_loans_stock on public.library_loans;
create trigger trg_library_loans_stock after insert or update or delete on public.library_loans for each row execute function public.library_loan_adjust_stock();

alter table public.library_books enable row level security;
alter table public.library_loans enable row level security;
drop policy if exists "library_books_select_school" on public.library_books;
create policy "library_books_select_school" on public.library_books for select using (school_id = public.current_school_id());
drop policy if exists "library_books_manage_staff" on public.library_books;
create policy "library_books_manage_staff" on public.library_books for all
using (public.current_app_role() in ('admin', 'teacher') and school_id = public.current_school_id())
with check (public.current_app_role() in ('admin', 'teacher') and school_id = public.current_school_id());
drop policy if exists "library_loans_select" on public.library_loans;
create policy "library_loans_select" on public.library_loans for select
using (
  (public.current_app_role() in ('admin', 'teacher') and school_id = public.current_school_id())
  or student_id = (select coalesce(p.related_id, p.id) from public.profiles p where p.id = auth.uid())
  or public.is_parent_of(student_id)
);
drop policy if exists "library_loans_manage_staff" on public.library_loans;
create policy "library_loans_manage_staff" on public.library_loans for all
using (public.current_app_role() in ('admin', 'teacher') and school_id = public.current_school_id())
with check (public.current_app_role() in ('admin', 'teacher') and school_id = public.current_school_id());

-- Transport: routes, vehicles, stops, student assignments.
create table if not exists public.transport_routes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  name text not null,
  vehicle_plate text,
  driver_name text,
  driver_phone text,
  capacity integer,
  fee_amount numeric(12,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.transport_stops (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  route_id uuid not null references public.transport_routes(id) on delete cascade,
  name text not null,
  pickup_time time,
  dropoff_time time,
  position integer not null default 0
);
create table if not exists public.transport_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  route_id uuid not null references public.transport_routes(id) on delete cascade,
  stop_id uuid references public.transport_stops(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (student_id)
);
create index if not exists idx_transport_routes_school on public.transport_routes(school_id);
create index if not exists idx_transport_stops_route on public.transport_stops(route_id, position);
create index if not exists idx_transport_assignments_route on public.transport_assignments(route_id);

drop trigger if exists trg_transport_routes_populate_school on public.transport_routes;
create trigger trg_transport_routes_populate_school before insert or update on public.transport_routes for each row execute function public.populate_school_id_from_profile();
drop trigger if exists trg_transport_stops_populate_school on public.transport_stops;
create trigger trg_transport_stops_populate_school before insert or update on public.transport_stops for each row execute function public.populate_school_id_from_profile();
drop trigger if exists trg_transport_assignments_populate_school on public.transport_assignments;
create trigger trg_transport_assignments_populate_school before insert or update on public.transport_assignments for each row execute function public.populate_school_id_from_profile();

alter table public.transport_routes enable row level security;
alter table public.transport_stops enable row level security;
alter table public.transport_assignments enable row level security;
drop policy if exists "transport_routes_select" on public.transport_routes;
create policy "transport_routes_select" on public.transport_routes for select using (school_id = public.current_school_id());
drop policy if exists "transport_routes_manage" on public.transport_routes;
create policy "transport_routes_manage" on public.transport_routes for all
using (public.current_app_role() = 'admin' and school_id = public.current_school_id())
with check (public.current_app_role() = 'admin' and school_id = public.current_school_id());
drop policy if exists "transport_stops_select" on public.transport_stops;
create policy "transport_stops_select" on public.transport_stops for select using (school_id = public.current_school_id());
drop policy if exists "transport_stops_manage" on public.transport_stops;
create policy "transport_stops_manage" on public.transport_stops for all
using (public.current_app_role() = 'admin' and school_id = public.current_school_id())
with check (public.current_app_role() = 'admin' and school_id = public.current_school_id());
drop policy if exists "transport_assignments_select" on public.transport_assignments;
create policy "transport_assignments_select" on public.transport_assignments for select
using (
  (public.current_app_role() in ('admin', 'teacher') and school_id = public.current_school_id())
  or student_id = (select coalesce(p.related_id, p.id) from public.profiles p where p.id = auth.uid())
  or public.is_parent_of(student_id)
);
drop policy if exists "transport_assignments_manage" on public.transport_assignments;
create policy "transport_assignments_manage" on public.transport_assignments for all
using (public.current_app_role() = 'admin' and school_id = public.current_school_id())
with check (public.current_app_role() = 'admin' and school_id = public.current_school_id());

-- Hostel: buildings, rooms, bed allocations.
create table if not exists public.hostels (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  name text not null,
  gender text check (gender is null or gender in ('male', 'female', 'mixed')),
  warden_name text,
  warden_phone text,
  created_at timestamptz not null default now()
);
create table if not exists public.hostel_rooms (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  hostel_id uuid not null references public.hostels(id) on delete cascade,
  name text not null,
  capacity integer not null default 4 check (capacity > 0),
  unique (hostel_id, name)
);
create table if not exists public.hostel_allocations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  room_id uuid not null references public.hostel_rooms(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete set null,
  bed_label text,
  allocated_at date not null default current_date,
  vacated_at date,
  created_at timestamptz not null default now()
);
create index if not exists idx_hostels_school on public.hostels(school_id);
create index if not exists idx_hostel_rooms_hostel on public.hostel_rooms(hostel_id);
create index if not exists idx_hostel_alloc_room_open on public.hostel_allocations(room_id) where vacated_at is null;
create unique index if not exists idx_hostel_alloc_one_active_per_student on public.hostel_allocations(student_id) where vacated_at is null;

drop trigger if exists trg_hostels_populate_school on public.hostels;
create trigger trg_hostels_populate_school before insert or update on public.hostels for each row execute function public.populate_school_id_from_profile();
drop trigger if exists trg_hostel_rooms_populate_school on public.hostel_rooms;
create trigger trg_hostel_rooms_populate_school before insert or update on public.hostel_rooms for each row execute function public.populate_school_id_from_profile();
drop trigger if exists trg_hostel_alloc_populate_school on public.hostel_allocations;
create trigger trg_hostel_alloc_populate_school before insert or update on public.hostel_allocations for each row execute function public.populate_school_id_from_profile();

create or replace function public.hostel_check_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_cap integer; v_used integer;
begin
  if new.vacated_at is not null then return new; end if;
  select capacity into v_cap from public.hostel_rooms where id = new.room_id;
  select count(*) into v_used from public.hostel_allocations where room_id = new.room_id and vacated_at is null and id <> new.id;
  if v_used >= coalesce(v_cap, 0) then
    raise exception 'This room is full (% beds)', v_cap using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_hostel_alloc_capacity on public.hostel_allocations;
create trigger trg_hostel_alloc_capacity before insert or update on public.hostel_allocations for each row execute function public.hostel_check_capacity();

alter table public.hostels enable row level security;
alter table public.hostel_rooms enable row level security;
alter table public.hostel_allocations enable row level security;
drop policy if exists "hostels_select" on public.hostels;
create policy "hostels_select" on public.hostels for select using (school_id = public.current_school_id());
drop policy if exists "hostels_manage" on public.hostels;
create policy "hostels_manage" on public.hostels for all
using (public.current_app_role() = 'admin' and school_id = public.current_school_id())
with check (public.current_app_role() = 'admin' and school_id = public.current_school_id());
drop policy if exists "hostel_rooms_select" on public.hostel_rooms;
create policy "hostel_rooms_select" on public.hostel_rooms for select using (school_id = public.current_school_id());
drop policy if exists "hostel_rooms_manage" on public.hostel_rooms;
create policy "hostel_rooms_manage" on public.hostel_rooms for all
using (public.current_app_role() = 'admin' and school_id = public.current_school_id())
with check (public.current_app_role() = 'admin' and school_id = public.current_school_id());
drop policy if exists "hostel_alloc_select" on public.hostel_allocations;
create policy "hostel_alloc_select" on public.hostel_allocations for select
using (
  (public.current_app_role() in ('admin', 'teacher') and school_id = public.current_school_id())
  or student_id = (select coalesce(p.related_id, p.id) from public.profiles p where p.id = auth.uid())
  or public.is_parent_of(student_id)
);
drop policy if exists "hostel_alloc_manage" on public.hostel_allocations;
create policy "hostel_alloc_manage" on public.hostel_allocations for all
using (public.current_app_role() = 'admin' and school_id = public.current_school_id())
with check (public.current_app_role() = 'admin' and school_id = public.current_school_id());
