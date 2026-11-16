-- Permissions assigned by the Main Admin to each additional user
create table public.user_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  can_create boolean not null default false,
  can_edit boolean not null default false,
  can_toggle boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.user_permissions to authenticated;
grant all on public.user_permissions to service_role;

alter table public.user_permissions enable row level security;

create policy "users can read own permissions"
  on public.user_permissions for select to authenticated
  using (auth.uid() = user_id);

create policy "super admin can read all permissions"
  on public.user_permissions for select to authenticated
  using (public.has_role(auth.uid(), 'super_admin'));

create policy "super admin can insert permissions"
  on public.user_permissions for insert to authenticated
  with check (public.has_role(auth.uid(), 'super_admin'));

create policy "super admin can update permissions"
  on public.user_permissions for update to authenticated
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

create policy "super admin can delete permissions"
  on public.user_permissions for delete to authenticated
  using (public.has_role(auth.uid(), 'super_admin'));

-- Security-definer permission check used by qr_records RLS
create or replace function public.has_permission(_user_id uuid, _permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case _permission
    when 'qr.create' then coalesce((select can_create from public.user_permissions where user_id = _user_id), false)
    when 'qr.edit' then coalesce((select can_edit from public.user_permissions where user_id = _user_id), false)
    when 'qr.toggle' then coalesce((select can_toggle from public.user_permissions where user_id = _user_id), false)
    else false
  end
$$;

-- Lock qr_records: no anonymous writes anymore; writes need the Main Admin
-- role or a matching permission
drop policy if exists "public can insert qr records" on public.qr_records;
drop policy if exists "public can update qr records" on public.qr_records;
drop policy if exists "public can delete qr records" on public.qr_records;
drop policy if exists "admins can read qr records" on public.qr_records;

revoke insert, update, delete on public.qr_records from anon;
grant select on public.qr_records to anon;
grant select, insert, update, delete on public.qr_records to authenticated;
grant all on public.qr_records to service_role;

create policy "staff can read qr records"
  on public.qr_records for select to authenticated
  using (true);

create policy "permitted users can insert qr records"
  on public.qr_records for insert to authenticated
  with check (
    public.has_role(auth.uid(), 'super_admin')
    or public.has_permission(auth.uid(), 'qr.create')
  );

create policy "permitted users can update qr records"
  on public.qr_records for update to authenticated
  using (
    public.has_role(auth.uid(), 'super_admin')
    or public.has_permission(auth.uid(), 'qr.edit')
    or public.has_permission(auth.uid(), 'qr.toggle')
  )
  with check (
    public.has_role(auth.uid(), 'super_admin')
    or public.has_permission(auth.uid(), 'qr.edit')
    or public.has_permission(auth.uid(), 'qr.toggle')
  );

create policy "super admin can delete qr records"
  on public.qr_records for delete to authenticated
  using (public.has_role(auth.uid(), 'super_admin'));
