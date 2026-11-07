-- My Garage: private offline-first cloud backup.
-- Apply this once in Supabase SQL Editor or with `supabase db push`.
-- The app's current GarageData shape is kept as one JSONB snapshot per user;
-- photos and PDFs live in a separate private Storage bucket.

begin;

create table if not exists public.garage_snapshots (
  user_id uuid primary key references auth.users (id) on delete cascade,
  schema_version integer not null check (schema_version = 1),
  revision bigint not null default 1 check (revision > 0),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.garage_snapshots enable row level security;

revoke all on table public.garage_snapshots from anon, authenticated;
grant select, delete on table public.garage_snapshots to authenticated;

drop policy if exists "Read own garage snapshot" on public.garage_snapshots;
create policy "Read own garage snapshot"
  on public.garage_snapshots
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Delete own garage snapshot" on public.garage_snapshots;
create policy "Delete own garage snapshot"
  on public.garage_snapshots
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Writes are allowed only through this compare-and-swap RPC. The expected
-- revision prevents one signed-in device from silently replacing newer data.
create or replace function public.save_garage_snapshot(
  p_expected_revision bigint,
  p_schema_version integer,
  p_data jsonb
)
returns table (revision bigint, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_revision bigint;
  v_updated_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'Sign in is required to save a garage.'
      using errcode = '42501';
  end if;

  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'Expected revision must be zero or greater.'
      using errcode = '22023';
  end if;

  if p_schema_version is distinct from 1 then
    raise exception 'Unsupported garage schema version.'
      using errcode = '22023';
  end if;

  if p_data is null or jsonb_typeof(p_data) is distinct from 'object' then
    raise exception 'Garage data must be a JSON object.'
      using errcode = '22023';
  end if;

  if p_expected_revision = 0 then
    insert into public.garage_snapshots as snapshot (user_id, schema_version, revision, data)
    values (v_user_id, p_schema_version, 1, p_data)
    on conflict (user_id) do nothing
    returning snapshot.revision, snapshot.updated_at
      into v_revision, v_updated_at;
  else
    update public.garage_snapshots as snapshot
       set schema_version = p_schema_version,
           revision = snapshot.revision + 1,
           data = p_data,
           updated_at = now()
     where snapshot.user_id = v_user_id
       and snapshot.revision = p_expected_revision
    returning snapshot.revision, snapshot.updated_at
      into v_revision, v_updated_at;
  end if;

  if v_revision is null then
    raise exception 'Garage changed on another device. Reload or resolve the copies before saving.'
      using errcode = '40001';
  end if;

  return query select v_revision, v_updated_at;
end;
$$;

revoke all on function public.save_garage_snapshot(bigint, integer, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_garage_snapshot(bigint, integer, jsonb)
  to authenticated;

-- Keep user photos and imported PDFs out of the JSON row. Object names must
-- start with the signed-in user's UUID, e.g. <uid>/vehicle/<uuid>.jpg.
insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
values (
  'garage-private-files',
  'garage-private-files',
  false,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'application/pdf']
)
on conflict (id) do update
  set name = excluded.name,
      public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Read own garage files" on storage.objects;
create policy "Read own garage files"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'garage-private-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Upload own garage files" on storage.objects;
create policy "Upload own garage files"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'garage-private-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Update own garage files" on storage.objects;
create policy "Update own garage files"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'garage-private-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'garage-private-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Delete own garage files" on storage.objects;
create policy "Delete own garage files"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'garage-private-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

commit;
