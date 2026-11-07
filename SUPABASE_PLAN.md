# Record-based persistence and sync

Apply `supabase/migrations/202611070002_relational_sync.sql` in Supabase SQL Editor after migration 001. It imports legacy snapshots and disables their write RPC. Then apply `202611070003_remove_legacy_snapshots.sql`: it checks that every legacy record ID exists in the new tables before dropping the old table and function. Do not replay migration 002 after completing cleanup 003.

## Database

Typed tables: `vehicles`, `odometer_readings`, `service_records`, `fuel_entries`, `tires`, `documents`, `reminders`, `custom_tasks`, `user_settings`. Each has an account-scoped primary key, server revision, mutation ID, soft deletion flag, and server update time. Child rows reference the owning account's vehicle. `ownership_expenses` combines service and fuel costs without duplicating them. Flexible editable vehicle specifications use JSONB; numeric values, dates, booleans, files, and records have their own columns.

RLS permits authenticated users to read only their own rows. Writes go through `sync_garage_record`, which derives the owner from the session, checks the expected revision, and recognizes duplicate mutation IDs. The RPC cannot target arbitrary tables. Anonymous access and direct client writes are denied. Photos/PDFs stay in the existing private Storage bucket, with user-scoped file paths.

## Offline behavior

Dexie version 2 stores individual records in IndexedDB. Each record includes `pending`, `deleted`, `revision`, and `mutationId`. An edit and its pending flag are committed in the same local transaction. The UI still receives a convenient assembled vehicle view; that view is never persisted or uploaded as a snapshot.

The worker pulls remote rows, preserves pending local edits, uploads pending rows, and clears each flag only after acknowledging that exact mutation. Edits made during an upload remain pending. Deletions are durable tombstones, so offline devices cannot recreate deleted records by omission. A lost server response is recovered by mutation ID without inserting duplicates.

Sync runs after edits, on reconnect, on focus, at launch/sign-in, and periodically while open. Failed rows stay pending for retry. It runs once at a time per browser, using Web Locks when supported. Conflicting records retain both local and remote values until the user resolves them in Settings. Choosing a side affects conflicting records only.

Account caches are isolated. Signing out hides that account's local records while preserving its pending work. Reopening offline uses the account cache when the session cannot be refreshed. Sync requires a valid signed-in session; fully closed browsers cannot run this worker.

## Migration and files

The IndexedDB version-2 upgrade converts the old local backup into individual pending records; version 3 removes that obsolete local store. Upgrades directly from version 1 execute the import first. The SQL migration copies the old cloud backup into the typed tables. Matching records reconcile without copying the complete garage; disagreements become per-record conflicts. Cloud backup removal is a separate guarded migration, 003.

Files use deterministic content-hash paths and references in `documents.file_ref` / `vehicles.photo`. Downloaded files are cached locally for offline use. Removing a record syncs its tombstone; old file objects are retained for recovery rather than automatically garbage collected.

## Build and checks

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in ignored `.env.local` / `.env.production.local` files, saved as UTF-8 without a BOM. The browser must never receive a Supabase secret or service-role key. Configure the deployed origin in Supabase Auth's redirect allowlist.

`npm test` covers local persistence, migrations, pending changes, failed uploads, deletion retries, account isolation, concurrent edits, and lost responses. `supabase/tests/relational_sync.sql` contains PostgreSQL assertions for the local test fixture: imported records, account RLS, RPC ownership, anonymous denial, duplicate retries, and stale-edit rejection. A production account's authentication and Storage permissions still require a signed-in end-to-end check after applying the migration.
