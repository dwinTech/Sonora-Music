-- Public catalog for music intentionally published by trusted admins.
-- Admin authorization is read from the signed JWT app_metadata claim, which
-- users cannot edit through the browser auth API.

create table if not exists public.public_music (
  id          uuid        primary key default gen_random_uuid(),
  admin_id    uuid        not null references auth.users (id) on delete cascade,
  title       text        not null check (length(trim(title)) > 0),
  artist      text        not null default '',
  album       text        not null default '',
  genre       text        not null default 'Other',
  duration    text        not null default '',
  cover_url   text        not null default '',
  audio_path  text        not null,
  created_at  timestamptz not null default now(),
  constraint public_music_audio_owned_by_admin
    check (audio_path like admin_id::text || '/%')
);

create index if not exists public_music_created_at_idx
  on public.public_music (created_at desc);

alter table public.public_music enable row level security;

grant select on table public.public_music to anon, authenticated;
grant insert, update, delete on table public.public_music to authenticated;

drop policy if exists "public music: visible to everyone" on public.public_music;
create policy "public music: visible to everyone"
  on public.public_music for select
  using (true);

drop policy if exists "public music: admins insert own tracks" on public.public_music;
create policy "public music: admins insert own tracks"
  on public.public_music for insert
  with check (
    admin_id = (select auth.uid())
    and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    and lower((select auth.jwt() ->> 'email')) = 'angoringedwin12@gmail.com'
  );

drop policy if exists "public music: admins update own tracks" on public.public_music;
drop policy if exists "public music: admins update tracks" on public.public_music;
create policy "public music: admins update tracks"
  on public.public_music for update
  using (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    and lower((select auth.jwt() ->> 'email')) = 'angoringedwin12@gmail.com'
  )
  with check (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    and lower((select auth.jwt() ->> 'email')) = 'angoringedwin12@gmail.com'
  );

drop policy if exists "public music: admins delete own tracks" on public.public_music;
drop policy if exists "public music: admins delete tracks" on public.public_music;
create policy "public music: admins delete tracks"
  on public.public_music for delete
  using (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    and lower((select auth.jwt() ->> 'email')) = 'angoringedwin12@gmail.com'
  );

insert into storage.buckets (id, name, public, file_size_limit)
values ('public-music', 'public-music', true, 52428800)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

drop policy if exists "public music audio: readable by everyone" on storage.objects;
create policy "public music audio: readable by everyone"
  on storage.objects for select
  using (bucket_id = 'public-music');

drop policy if exists "public music audio: admins upload own files" on storage.objects;
create policy "public music audio: admins upload own files"
  on storage.objects for insert
  with check (
    bucket_id = 'public-music'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    and lower((select auth.jwt() ->> 'email')) = 'angoringedwin12@gmail.com'
  );

drop policy if exists "public music audio: admins update own files" on storage.objects;
create policy "public music audio: admins update own files"
  on storage.objects for update
  using (
    bucket_id = 'public-music'
    and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    and lower((select auth.jwt() ->> 'email')) = 'angoringedwin12@gmail.com'
  )
  with check (
    bucket_id = 'public-music'
    and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    and lower((select auth.jwt() ->> 'email')) = 'angoringedwin12@gmail.com'
  );

drop policy if exists "public music audio: admins delete own files" on storage.objects;
create policy "public music audio: admins delete own files"
  on storage.objects for delete
  using (
    bucket_id = 'public-music'
    and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    and lower((select auth.jwt() ->> 'email')) = 'angoringedwin12@gmail.com'
  );

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'public_music'
     ) then
    execute 'alter publication supabase_realtime add table public.public_music';
  end if;
end
$$;

notify pgrst, 'reload schema';
