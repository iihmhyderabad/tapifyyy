-- Enable necessary extensions
create extension if not exists "pgcrypto";

-- =========================================================
-- 1. QR Records Table
-- =========================================================
create table if not exists public.qr_records (
  id uuid primary key default gen_random_uuid(),
  qr_code text not null unique,
  client_name text not null default 'Unassigned',
  destination_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  scan_count integer not null default 0,
  last_scanned_at timestamptz
);

-- =========================================================
-- 2. User Roles Table
-- =========================================================
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null check (role in ('admin', 'super_admin', 'user')),
  unique (user_id, role)
);

-- =========================================================
-- 3. User Permissions Table
-- =========================================================
create table if not exists public.user_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  can_create boolean not null default false,
  can_edit boolean not null default false,
  can_toggle boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- 3b. Supabase Pause Prevention Keep-Alive Table
-- =========================================================
create table if not exists public.keep_alive (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- =========================================================
-- 4. Helper Functions
-- =========================================================
create or replace function public.has_role(_user_id uuid, _role text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

create or replace function public.has_permission(_user_id uuid, _permission text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select case _permission
    when 'qr.create' then coalesce((select can_create from public.user_permissions where user_id = _user_id), false)
    when 'qr.edit' then coalesce((select can_edit from public.user_permissions where user_id = _user_id), false)
    when 'qr.toggle' then coalesce((select can_toggle from public.user_permissions where user_id = _user_id), false)
    else false
  end
$$;

create or replace function public.record_scan(_qr_code text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.qr_records
    set scan_count = scan_count + 1, last_scanned_at = now()
    where qr_code = _qr_code;
end;
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Trigger for auto updating updated_at timestamp
drop trigger if exists qr_records_updated_at on public.qr_records;
create trigger qr_records_updated_at
before update on public.qr_records
for each row execute function public.set_updated_at();

-- =========================================================
-- 5. Row-Level Security (RLS) & Policies
-- =========================================================
alter table public.qr_records enable row level security;
alter table public.user_roles enable row level security;
alter table public.user_permissions enable row level security;

-- Policies on qr_records (Allowing public scan, redirect, and dashboard operations)
drop policy if exists "public can read qr records" on public.qr_records;
create policy "public can read qr records"
  on public.qr_records for select to anon, authenticated
  using (true);

drop policy if exists "public can insert qr records" on public.qr_records;
create policy "public can insert qr records"
  on public.qr_records for insert to anon, authenticated
  with check (true);

drop policy if exists "public can update qr records" on public.qr_records;
create policy "public can update qr records"
  on public.qr_records for update to anon, authenticated
  using (true) with check (true);

drop policy if exists "public can delete qr records" on public.qr_records;
create policy "public can delete qr records"
  on public.qr_records for delete to anon, authenticated
  using (true);

-- Policies on user_roles
drop policy if exists "users can read own roles" on public.user_roles;
create policy "users can read own roles"
  on public.user_roles for select to authenticated
  using (auth.uid() = user_id);

-- Policies on user_permissions
drop policy if exists "users can read own permissions" on public.user_permissions;
create policy "users can read own permissions"
  on public.user_permissions for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "super admin can read all permissions" on public.user_permissions;
create policy "super admin can read all permissions"
  on public.user_permissions for select to authenticated
  using (public.has_role(auth.uid(), 'super_admin'));

drop policy if exists "super admin can insert permissions" on public.user_permissions;
create policy "super admin can insert permissions"
  on public.user_permissions for insert to authenticated
  with check (public.has_role(auth.uid(), 'super_admin'));

drop policy if exists "super admin can update permissions" on public.user_permissions;
create policy "super admin can update permissions"
  on public.user_permissions for update to authenticated
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

drop policy if exists "super admin can delete permissions" on public.user_permissions;
create policy "super admin can delete permissions"
  on public.user_permissions for delete to authenticated
  using (public.has_role(auth.uid(), 'super_admin'));

-- Policies on keep_alive
alter table public.keep_alive enable row level security;
drop policy if exists "allow keep_alive read" on public.keep_alive;
create policy "allow keep_alive read" on public.keep_alive for select to anon, authenticated using (true);
drop policy if exists "allow keep_alive insert" on public.keep_alive;
create policy "allow keep_alive insert" on public.keep_alive for insert to anon, authenticated with check (true);
drop policy if exists "allow keep_alive delete" on public.keep_alive;
create policy "allow keep_alive delete" on public.keep_alive for delete to anon, authenticated using (true);

-- =========================================================
-- 6. Grants & Permissions
-- =========================================================
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.qr_records to anon, authenticated;
grant all on public.qr_records to service_role;

grant select, insert, update, delete on public.keep_alive to anon, authenticated;
grant all on public.keep_alive to service_role;

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

grant select, insert, update, delete on public.user_permissions to authenticated;
grant all on public.user_permissions to service_role;

grant execute on function public.record_scan(text) to anon, authenticated;
grant execute on function public.has_role(uuid, text) to authenticated;
grant execute on function public.has_permission(uuid, text) to authenticated;

-- =========================================================
-- 7. Seed Records (500 cards each)
-- =========================================================
-- Seed 500 permanent Google Review QR cards (GREV-001 to GREV-500)
insert into public.qr_records (qr_code, client_name)
select 
  'GREV-' || lpad(i::text, 3, '0'),
  'Client ' || lpad(i::text, 3, '0')
from generate_series(1, 500) as i
on conflict (qr_code) do nothing;

-- Seed 500 Card Designs Google cards (CD-GOOGLE-001 to CD-GOOGLE-500)
insert into public.qr_records (qr_code, client_name)
select 
  'CD-GOOGLE-' || lpad(i::text, 3, '0'),
  'Google Review NFC Card'
from generate_series(1, 500) as i
on conflict (qr_code) do nothing;

-- Seed 500 Card Designs Instagram cards (CD-INSTAGRAM-001 to CD-INSTAGRAM-500)
insert into public.qr_records (qr_code, client_name)
select 
  'CD-INSTAGRAM-' || lpad(i::text, 3, '0'),
  'Instagram NFC Card'
from generate_series(1, 500) as i
on conflict (qr_code) do nothing;

