-- QR records
create table public.qr_records (
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

-- Admin roles (separate table, never on profiles/users)
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null check (role in ('admin')),
  unique (user_id, role)
);

create or replace function public.has_role(_user_id uuid, _role text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
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

create trigger qr_records_updated_at
before update on public.qr_records
for each row execute function public.set_updated_at();

-- Grants (same migration as CREATE TABLE)
grant select, insert, update, delete on public.qr_records to authenticated;
grant select on public.qr_records to anon;
grant all on public.qr_records to service_role;
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
grant execute on function public.record_scan(text) to anon, authenticated;
grant execute on function public.has_role(uuid, text) to authenticated;

alter table public.qr_records enable row level security;
alter table public.user_roles enable row level security;

create policy "anon can read qr records"
on public.qr_records for select to anon using (true);
create policy "admins can read qr records"
on public.qr_records for select to authenticated
using (public.has_role(auth.uid(), 'admin'));
create policy "admins can insert qr records"
on public.qr_records for insert to authenticated
with check (public.has_role(auth.uid(), 'admin'));
create policy "admins can update qr records"
on public.qr_records for update to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));
create policy "admins can delete qr records"
on public.qr_records for delete to authenticated
using (public.has_role(auth.uid(), 'admin'));
create policy "users can read own roles"
on public.user_roles for select to authenticated
using (auth.uid() = user_id);

-- Seed the 10 permanent QR records (idempotent)
insert into public.qr_records (qr_code, client_name) values
  ('GREV-001', 'Client 01'),
  ('GREV-002', 'Client 02'),
  ('GREV-003', 'Client 03'),
  ('GREV-004', 'Client 04'),
  ('GREV-005', 'Client 05'),
  ('GREV-006', 'Client 06'),
  ('GREV-007', 'Client 07'),
  ('GREV-008', 'Client 08'),
  ('GREV-009', 'Client 09'),
  ('GREV-010', 'Client 10')
on conflict (qr_code) do nothing;