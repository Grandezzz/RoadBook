-- Run this in Supabase Dashboard → SQL Editor.
create table if not exists public.roadbook_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{"roadbooks":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Only emails explicitly added here by the site owner may enter the app.
create table if not exists public.roadbook_access (
  email text primary key check (email = lower(trim(email))),
  approved_at timestamptz not null default now()
);

alter table public.roadbook_data enable row level security;
alter table public.roadbook_access enable row level security;
revoke all on public.roadbook_data from anon;
revoke all on public.roadbook_access from anon;
grant select, insert, update, delete on public.roadbook_data to authenticated;
grant select on public.roadbook_access to authenticated;

drop policy if exists "Users can check their own approval" on public.roadbook_access;
create policy "Users can check their own approval"
  on public.roadbook_access
  for select
  to authenticated
  using (email = lower(auth.jwt() ->> 'email'));

drop policy if exists "Users can access their own roadbooks" on public.roadbook_data;
create policy "Users can access their own roadbooks"
  on public.roadbook_data
  for all
  to authenticated
  using (
    auth.uid() = user_id
    and exists (select 1 from public.roadbook_access a where a.email = lower(auth.jwt() ->> 'email'))
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.roadbook_access a where a.email = lower(auth.jwt() ->> 'email'))
  );

-- The owner approves access in SQL Editor, for example:
-- insert into public.roadbook_access (email) values (lower('person@example.com'));
-- Remove access with:
-- delete from public.roadbook_access where email = lower('person@example.com');

-- Private itinerary photos. Run this section once for existing projects too.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('roadbook-images', 'roadbook-images', false, 10485760,
  array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif'])
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Approved users upload own roadbook images" on storage.objects;
create policy "Approved users upload own roadbook images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'roadbook-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (select 1 from public.roadbook_access a where a.email = lower(auth.jwt() ->> 'email'))
  );

drop policy if exists "Approved users read own roadbook images" on storage.objects;
create policy "Approved users read own roadbook images"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'roadbook-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (select 1 from public.roadbook_access a where a.email = lower(auth.jwt() ->> 'email'))
  );
