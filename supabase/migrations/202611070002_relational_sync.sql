-- Apply after 202611070001_garage_persistence.sql. Preserves the old backup table.
begin;

create table if not exists public.vehicles (
 user_id uuid not null references auth.users(id) on delete cascade,
 id text not null,
 specs jsonb,
 unit text,
 driving text,
 initial_meters numeric,
 photo text,
 photo_index numeric,
 vin text,
 pressure numeric,
 placard_verified boolean,
 revision bigint not null default 1 check(revision>0),
 mutation_id uuid not null,
 deleted boolean not null default false,
 updated_at timestamptz not null default now(),
 primary key(user_id,id)
);
alter table public.vehicles enable row level security;
revoke all on public.vehicles from anon, authenticated;
grant select on public.vehicles to authenticated;
drop policy if exists own_rows on public.vehicles;
create policy own_rows on public.vehicles for select to authenticated using ((select auth.uid())=user_id);
insert into public.vehicles
select (jsonb_populate_record(null::public.vehicles,jsonb_build_object('id',item->>'id','user_id',to_jsonb(s.user_id),'revision',1,'mutation_id',to_jsonb(gen_random_uuid()),'deleted',false,'updated_at',to_jsonb(now()),'specs',item->'specs','unit',item->'unit','driving',item->'driving','initial_meters',item->'initialMeters','photo',item->'photo','photo_index',item->'photoIndex','vin',item->'vin','pressure',item->'pressure','placard_verified',item->'placardVerified'))).*
from public.garage_snapshots s cross join lateral jsonb_array_elements(jsonb_build_array(s.data->'vehicle')) item
where item->>'id' is not null
on conflict(user_id,id) do nothing;

create table if not exists public.odometer_readings (
 user_id uuid not null references auth.users(id) on delete cascade,
 id text not null,
 vehicle_id text,
 recorded_date date,
 meters numeric,
 original_value numeric,
 unit text,
 reason text,
 revision bigint not null default 1 check(revision>0),
 mutation_id uuid not null,
 deleted boolean not null default false,
 updated_at timestamptz not null default now(),
 primary key(user_id,id),
 foreign key(user_id,vehicle_id) references public.vehicles(user_id,id),
 check(meters >= 0), check(original_value >= 0), check(unit in ('mi','km'))
);
alter table public.odometer_readings enable row level security;
revoke all on public.odometer_readings from anon, authenticated;
grant select on public.odometer_readings to authenticated;
drop policy if exists own_rows on public.odometer_readings;
create policy own_rows on public.odometer_readings for select to authenticated using ((select auth.uid())=user_id);
insert into public.odometer_readings
select (jsonb_populate_record(null::public.odometer_readings,jsonb_build_object('id',item->>'id','user_id',to_jsonb(s.user_id),'revision',1,'mutation_id',to_jsonb(gen_random_uuid()),'deleted',false,'updated_at',to_jsonb(now()),'vehicle_id',s.data->'vehicle'->'id','recorded_date',nullif(item->>'date','')::text,'meters',item->'meters','original_value',item->'original','unit',item->'unit','reason',item->'reason'))).*
from public.garage_snapshots s cross join lateral jsonb_array_elements(coalesce(s.data->'readings','[]'::jsonb)) item
where item->>'id' is not null
on conflict(user_id,id) do nothing;

create table if not exists public.service_records (
 user_id uuid not null references auth.users(id) on delete cascade,
 id text not null,
 vehicle_id text,
 title text,
 category text,
 recorded_date date,
 meters numeric,
 task_id text,
 cost numeric,
 currency text,
 provider text,
 notes text,
 attachment_ids text[],
 recurring text,
 revision bigint not null default 1 check(revision>0),
 mutation_id uuid not null,
 deleted boolean not null default false,
 updated_at timestamptz not null default now(),
 primary key(user_id,id),
 foreign key(user_id,vehicle_id) references public.vehicles(user_id,id)
);
alter table public.service_records enable row level security;
revoke all on public.service_records from anon, authenticated;
grant select on public.service_records to authenticated;
drop policy if exists own_rows on public.service_records;
create policy own_rows on public.service_records for select to authenticated using ((select auth.uid())=user_id);
insert into public.service_records
select (jsonb_populate_record(null::public.service_records,jsonb_build_object('id',item->>'id','user_id',to_jsonb(s.user_id),'revision',1,'mutation_id',to_jsonb(gen_random_uuid()),'deleted',false,'updated_at',to_jsonb(now()),'vehicle_id',item->'vehicleId','title',item->'title','category',item->'category','recorded_date',nullif(item->>'date','')::text,'meters',item->'meters','task_id',item->'taskId','cost',item->'cost','currency',item->'currency','provider',item->'provider','notes',item->'notes','attachment_ids',item->'attachments','recurring',item->'recurring'))).*
from public.garage_snapshots s cross join lateral jsonb_array_elements(coalesce(s.data->'history','[]'::jsonb)) item
where item->>'id' is not null
on conflict(user_id,id) do nothing;

create table if not exists public.fuel_entries (
 user_id uuid not null references auth.users(id) on delete cascade,
 id text not null,
 vehicle_id text,
 recorded_date date,
 meters numeric,
 original_value numeric,
 unit text,
 liters numeric,
 cost numeric,
 currency text,
 full_tank boolean,
 terrain text,
 sport boolean,
 station text,
 notes text,
 revision bigint not null default 1 check(revision>0),
 mutation_id uuid not null,
 deleted boolean not null default false,
 updated_at timestamptz not null default now(),
 primary key(user_id,id),
 foreign key(user_id,vehicle_id) references public.vehicles(user_id,id),
 check(liters > 0), check(meters >= 0), check(cost is null or cost >= 0)
);
alter table public.fuel_entries enable row level security;
revoke all on public.fuel_entries from anon, authenticated;
grant select on public.fuel_entries to authenticated;
drop policy if exists own_rows on public.fuel_entries;
create policy own_rows on public.fuel_entries for select to authenticated using ((select auth.uid())=user_id);
insert into public.fuel_entries
select (jsonb_populate_record(null::public.fuel_entries,jsonb_build_object('id',item->>'id','user_id',to_jsonb(s.user_id),'revision',1,'mutation_id',to_jsonb(gen_random_uuid()),'deleted',false,'updated_at',to_jsonb(now()),'vehicle_id',item->'vehicleId','recorded_date',nullif(item->>'date','')::text,'meters',item->'meters','original_value',item->'original','unit',item->'unit','liters',item->'liters','cost',item->'cost','currency',item->'currency','full_tank',item->'full','terrain',item->'terrain','sport',item->'sport','station',item->'station','notes',item->'notes'))).*
from public.garage_snapshots s cross join lateral jsonb_array_elements(coalesce(s.data->'fuel','[]'::jsonb)) item
where item->>'id' is not null
on conflict(user_id,id) do nothing;

create table if not exists public.tires (
 user_id uuid not null references auth.users(id) on delete cascade,
 id text not null,
 vehicle_id text,
 position text,
 psi numeric,
 checked_at timestamptz,
 tread_mm numeric,
 manufactured date,
 brand text,
 model text,
 size text,
 condition text,
 notes text,
 revision bigint not null default 1 check(revision>0),
 mutation_id uuid not null,
 deleted boolean not null default false,
 updated_at timestamptz not null default now(),
 primary key(user_id,id),
 foreign key(user_id,vehicle_id) references public.vehicles(user_id,id)
);
alter table public.tires enable row level security;
revoke all on public.tires from anon, authenticated;
grant select on public.tires to authenticated;
drop policy if exists own_rows on public.tires;
create policy own_rows on public.tires for select to authenticated using ((select auth.uid())=user_id);
insert into public.tires
select (jsonb_populate_record(null::public.tires,jsonb_build_object('id',item->>'position','user_id',to_jsonb(s.user_id),'revision',1,'mutation_id',to_jsonb(gen_random_uuid()),'deleted',false,'updated_at',to_jsonb(now()),'vehicle_id',s.data->'vehicle'->'id','position',item->'position','psi',item->'psi','checked_at',nullif(item->>'checked','')::text,'tread_mm',item->'tread','manufactured',nullif(item->>'manufactured','')::text,'brand',item->'brand','model',item->'model','size',item->'size','condition',item->'condition','notes',item->'notes'))).*
from public.garage_snapshots s cross join lateral jsonb_array_elements(coalesce(s.data->'tires','[]'::jsonb)) item
where item->>'position' is not null
on conflict(user_id,id) do nothing;

create table if not exists public.documents (
 user_id uuid not null references auth.users(id) on delete cascade,
 id text not null,
 vehicle_id text,
 name text,
 file_ref text,
 kind text,
 page_text text[],
 added_at timestamptz,
 revision bigint not null default 1 check(revision>0),
 mutation_id uuid not null,
 deleted boolean not null default false,
 updated_at timestamptz not null default now(),
 primary key(user_id,id),
 foreign key(user_id,vehicle_id) references public.vehicles(user_id,id)
);
alter table public.documents enable row level security;
revoke all on public.documents from anon, authenticated;
grant select on public.documents to authenticated;
drop policy if exists own_rows on public.documents;
create policy own_rows on public.documents for select to authenticated using ((select auth.uid())=user_id);
insert into public.documents
select (jsonb_populate_record(null::public.documents,jsonb_build_object('id',item->>'id','user_id',to_jsonb(s.user_id),'revision',1,'mutation_id',to_jsonb(gen_random_uuid()),'deleted',false,'updated_at',to_jsonb(now()),'vehicle_id',s.data->'vehicle'->'id','name',item->'name','file_ref',item->'data','kind',item->'kind','page_text',item->'pages','added_at',nullif(item->>'added','')::text))).*
from public.garage_snapshots s cross join lateral jsonb_array_elements(coalesce(s.data->'documents','[]'::jsonb)) item
where item->>'id' is not null
on conflict(user_id,id) do nothing;

create table if not exists public.reminders (
 user_id uuid not null references auth.users(id) on delete cascade,
 id text not null,
 vehicle_id text,
 task_id text,
 title text,
 due_date date,
 due_meters numeric,
 status text,
 explanation text,
 revision bigint not null default 1 check(revision>0),
 mutation_id uuid not null,
 deleted boolean not null default false,
 updated_at timestamptz not null default now(),
 primary key(user_id,id),
 foreign key(user_id,vehicle_id) references public.vehicles(user_id,id)
);
alter table public.reminders enable row level security;
revoke all on public.reminders from anon, authenticated;
grant select on public.reminders to authenticated;
drop policy if exists own_rows on public.reminders;
create policy own_rows on public.reminders for select to authenticated using ((select auth.uid())=user_id);
insert into public.reminders
select (jsonb_populate_record(null::public.reminders,jsonb_build_object('id',item->>'id','user_id',to_jsonb(s.user_id),'revision',1,'mutation_id',to_jsonb(gen_random_uuid()),'deleted',false,'updated_at',to_jsonb(now()),'vehicle_id',s.data->'vehicle'->'id','task_id',item->'taskId','title',item->'title','due_date',nullif(item->>'date','')::text,'due_meters',item->'meters','status',item->'status','explanation',item->'explanation'))).*
from public.garage_snapshots s cross join lateral jsonb_array_elements(coalesce(s.data->'reminders','[]'::jsonb)) item
where item->>'id' is not null
on conflict(user_id,id) do nothing;

create table if not exists public.custom_tasks (
 user_id uuid not null references auth.users(id) on delete cascade,
 id text not null,
 vehicle_id text,
 name text,
 category text,
 interval_miles numeric,
 interval_months numeric,
 interval_days numeric,
 official boolean,
 reason text,
 reference text,
 revision bigint not null default 1 check(revision>0),
 mutation_id uuid not null,
 deleted boolean not null default false,
 updated_at timestamptz not null default now(),
 primary key(user_id,id),
 foreign key(user_id,vehicle_id) references public.vehicles(user_id,id)
);
alter table public.custom_tasks enable row level security;
revoke all on public.custom_tasks from anon, authenticated;
grant select on public.custom_tasks to authenticated;
drop policy if exists own_rows on public.custom_tasks;
create policy own_rows on public.custom_tasks for select to authenticated using ((select auth.uid())=user_id);
insert into public.custom_tasks
select (jsonb_populate_record(null::public.custom_tasks,jsonb_build_object('id',item->>'id','user_id',to_jsonb(s.user_id),'revision',1,'mutation_id',to_jsonb(gen_random_uuid()),'deleted',false,'updated_at',to_jsonb(now()),'vehicle_id',s.data->'vehicle'->'id','name',item->'name','category',item->'category','interval_miles',item->'miles','interval_months',item->'months','interval_days',item->'days','official',item->'official','reason',item->'reason','reference',item->'reference'))).*
from public.garage_snapshots s cross join lateral jsonb_array_elements(coalesce(s.data->'customTasks','[]'::jsonb)) item
where item->>'id' is not null
on conflict(user_id,id) do nothing;

create table if not exists public.user_settings (
 user_id uuid not null references auth.users(id) on delete cascade,
 id text not null,
 theme text,
 onboarding_done boolean,
 notifications boolean,
 estimated_monthly_km numeric,
 assistant_endpoint text,
 revision bigint not null default 1 check(revision>0),
 mutation_id uuid not null,
 deleted boolean not null default false,
 updated_at timestamptz not null default now(),
 primary key(user_id,id)
);
alter table public.user_settings enable row level security;
revoke all on public.user_settings from anon, authenticated;
grant select on public.user_settings to authenticated;
drop policy if exists own_rows on public.user_settings;
create policy own_rows on public.user_settings for select to authenticated using ((select auth.uid())=user_id);
insert into public.user_settings
select (jsonb_populate_record(null::public.user_settings,jsonb_build_object('id','preferences','user_id',to_jsonb(s.user_id),'revision',1,'mutation_id',to_jsonb(gen_random_uuid()),'deleted',false,'updated_at',to_jsonb(now()),'theme',item->'theme','onboarding_done',item->'onboardingDone','notifications',item->'notifications','estimated_monthly_km',item->'estimatedMonthlyKm','assistant_endpoint',item->'assistantEndpoint'))).*
from public.garage_snapshots s cross join lateral jsonb_array_elements(jsonb_build_array(s.data->'settings')) item
where 'preferences' is not null
on conflict(user_id,id) do nothing;

create or replace function public.sync_garage_record(
 p_table text, p_record jsonb, p_expected_revision bigint, p_mutation_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 uid uuid := auth.uid(); previous jsonb; result jsonb; next_record jsonb; cols text; assignments text; record_id text := p_record->>'id';
begin
 if uid is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_table not in ('vehicles','odometer_readings','service_records','fuel_entries','tires','documents','reminders','custom_tasks','user_settings') then raise exception 'Unknown table' using errcode='22023'; end if;
 if record_id is null or p_mutation_id is null or p_expected_revision is null or p_expected_revision<0 then raise exception 'Invalid record metadata' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text || p_table || record_id,0));
 execute format('select to_jsonb(t) from public.%I t where user_id=$1 and id=$2 for update',p_table) into previous using uid,record_id;
 if previous->>'mutation_id'=p_mutation_id::text then return previous; end if;
 if coalesce((previous->>'revision')::bigint,0)<>p_expected_revision then raise exception 'Record changed on another device' using errcode='40001'; end if;
 next_record := coalesce(previous,'{}'::jsonb) || p_record || jsonb_build_object('user_id',uid,'id',record_id,'revision',p_expected_revision+1,'mutation_id',p_mutation_id,'updated_at',now(),'deleted',coalesce((p_record->>'deleted')::boolean,false));
 select string_agg(quote_ident(a.attname),',' order by a.attnum), string_agg(format('%I=excluded.%I',a.attname,a.attname),',' order by a.attnum) filter(where a.attname not in ('user_id','id'))
 into cols,assignments from pg_attribute a where a.attrelid=format('public.%I',p_table)::regclass and a.attnum>0 and not a.attisdropped;
 execute format('insert into public.%I as t (%s) select %s from jsonb_populate_record(null::public.%I,$1) on conflict(user_id,id) do update set %s returning to_jsonb(t)',p_table,cols,cols,p_table,assignments) into result using next_record;
 return result;
end; $$;
revoke all on function public.sync_garage_record(text,jsonb,bigint,uuid) from public,anon,authenticated;
grant execute on function public.sync_garage_record(text,jsonb,bigint,uuid) to authenticated;
-- Older app builds may read legacy backups, but cannot keep writing snapshots.
revoke execute on function public.save_garage_snapshot(bigint,integer,jsonb) from authenticated;
create or replace view public.ownership_expenses with(security_invoker=true) as
 select user_id,id,vehicle_id,recorded_date,cost,currency,category,'service'::text as source from public.service_records where not deleted and cost is not null
 union all select user_id,id,vehicle_id,recorded_date,cost,currency,'Fuel','fuel' from public.fuel_entries where not deleted and cost is not null;
grant select on public.ownership_expenses to authenticated;
commit;
