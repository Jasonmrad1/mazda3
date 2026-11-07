-- Apply AFTER migration 002. Check every legacy record before removing backups.
begin;
do $$
declare
 mapping record;
 missing bigint;
 source_rows text;
 source_id text;
begin
 if to_regclass('public.garage_snapshots') is null then return; end if;
 lock table public.garage_snapshots in access exclusive mode;
 for mapping in select * from (values
   ('vehicles','vehicle','object'),
   ('odometer_readings','readings','array'),
   ('service_records','history','array'),
   ('fuel_entries','fuel','array'),
   ('tires','tires','tires'),
   ('documents','documents','array'),
   ('reminders','reminders','array'),
   ('custom_tasks','customTasks','array'),
   ('user_settings','settings','settings')
 ) as mappings(table_name,source_name,kind)
 loop
   if to_regclass(format('public.%I',mapping.table_name)) is null then
     raise exception 'Migration 002 is incomplete: table % is missing. Backups kept.',mapping.table_name;
   end if;
   source_rows := case when mapping.kind in ('object','settings')
     then format('jsonb_build_array(s.data->%L)',mapping.source_name)
     else format('coalesce(s.data->%L,''[]''::jsonb)',mapping.source_name) end;
   source_id := case mapping.kind when 'tires' then 'item->>''position'''
     when 'settings' then '''preferences''' else 'item->>''id''' end;
   execute format(
     'select count(*) from public.garage_snapshots s cross join lateral jsonb_array_elements(%s) item where not exists (select 1 from public.%I r where r.user_id=s.user_id and r.id=%s)',
     source_rows,mapping.table_name,source_id
   ) into missing;
   if missing>0 then
     raise exception '% legacy records are missing from %. Backups kept; finish migration 002 first.',missing,mapping.table_name;
   end if;
 end loop;
end $$;
drop function if exists public.save_garage_snapshot(bigint,integer,jsonb);
drop table if exists public.garage_snapshots;
commit;
