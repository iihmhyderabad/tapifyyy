insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
)
select
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@greview.local',
  crypt('GReview#2026!Admin', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}', '{}'
where not exists (select 1 from auth.users where email = 'admin@greview.local');

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data,
  last_sign_in_at, created_at, updated_at
)
select u.id, u.id, 'email', 'email',
  json_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  now(), now(), now()
from auth.users u
where u.email = 'admin@greview.local'
  and not exists (
    select 1 from auth.identities i
    where i.user_id = u.id and i.provider = 'email'
  );

insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users
where email = 'admin@greview.local'
  and not exists (
    select 1 from public.user_roles r where r.user_id = auth.users.id and r.role = 'admin'
  );