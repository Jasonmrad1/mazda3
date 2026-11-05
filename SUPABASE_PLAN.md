# Supabase persistence plan

## Current state

The React app is offline-first today. Dexie stores a `GarageData` snapshot in browser IndexedDB; this is not SQLite and is specific to this browser profile. Clearing site data can remove the local copy. There is no Supabase project configured, so the app must not imply that records are cloud backed up.

## Goal

Keep IndexedDB as the fast offline working copy, with optional authenticated Supabase sync so a lost browser profile does not mean losing the garage. A signed-in account should be able to restore its car profile, odometer readings, maintenance and fuel history, tire checks, reminders, and expenses on another device.

## Implementation phases

1. **Connect a project.** Create a Supabase project and provide its project URL and public publishable key. Configure the app's allowed auth redirect URLs for the production Site and local development. These two client values are public by design; never put a `service_role` key in the browser or source repository.
2. **Add sign-in.** Use Supabase Auth email magic links. Keep the garage fully usable while signed out. Show explicit states: `On this device`, `Syncing`, `Synced`, `Offline`, and actionable sync errors.
3. **Create private storage.** Add a `garage_snapshots` table with one JSONB snapshot per authenticated user, plus `schema_version`, monotonic `revision`, and `updated_at`. Enable RLS and allow select/insert/update only when `auth.uid() = user_id`. The client can read and write only its own row.
4. **Preserve offline edits.** Continue saving to IndexedDB first. Queue/coalesce sync after successful local commits and retry on reconnect. Store the last synced revision and snapshot locally. Use a compare-and-swap RPC (expected revision) so one device cannot silently overwrite newer cloud changes.
5. **Resolve first sync and conflicts safely.** If the account has no cloud snapshot, offer to upload this device's existing records. If both sides have edits since the last sync, retain both copies and offer `Use cloud copy`, `Keep this device`, or export before replacing. Never silently replace either side. Validate schema versions before applying remote data.
6. **Move documents to private object storage.** The current `Document.data` field can contain large inline file data. Upload document/photo bytes to a private Storage bucket under the authenticated user's ID, apply matching Storage RLS, and keep metadata plus object paths in the garage snapshot. Migrate existing inline attachments without deleting the source until upload verification succeeds.
7. **Back up and verify.** Keep the existing JSON/CSV export as a portable backup. Add an account-level `last synced` indicator, a manual sync action, and clear account disconnect/delete flows. Test two-device restore, offline edits, simultaneous edits, expired sessions, oversized attachments, and user-isolation policies before calling cloud sync complete.

## Initial database shape

```sql
create table public.garage_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  schema_version integer not null,
  revision bigint not null default 1,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.garage_snapshots enable row level security;
create policy "read own garage" on public.garage_snapshots
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "create own garage" on public.garage_snapshots
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own garage" on public.garage_snapshots
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
```

Production writes should go through a small revision-checking database function, not blind last-write-wins upserts. Apply migrations in a Supabase project and validate the policies with two different user accounts before enabling sync in the app.

## Needed to start

- Supabase project URL
- Supabase public publishable key (or legacy public anon key)
- Auth redirect URL allowlist configured for the production app

Do not send a service-role key. Until the project is connected and two-device restore is verified, local IndexedDB and the user's own export remain the only persistence guarantees.
