-- Login removed by request: the dashboard is open, so anonymous writes are
-- allowed again (same as the earlier no-login version). The auth/permissions
-- tables stay in place but are not used by the app.
drop policy if exists "anon can read qr records" on public.qr_records;
drop policy if exists "staff can read qr records" on public.qr_records;
drop policy if exists "permitted users can insert qr records" on public.qr_records;
drop policy if exists "permitted users can update qr records" on public.qr_records;
drop policy if exists "super admin can delete qr records" on public.qr_records;

grant insert, update, delete on public.qr_records to anon;

create policy "public can read qr records"
  on public.qr_records for select to anon, authenticated
  using (true);

create policy "public can insert qr records"
  on public.qr_records for insert to anon, authenticated
  with check (true);

create policy "public can update qr records"
  on public.qr_records for update to anon, authenticated
  using (true) with check (true);

create policy "public can delete qr records"
  on public.qr_records for delete to anon, authenticated
  using (true);
