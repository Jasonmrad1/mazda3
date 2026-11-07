-- Integration assertions for a local PostgreSQL test database after both
-- migrations and the legacy fixture (alice/test-fuel). Do not run in production.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
do $$
declare result jsonb; duplicate jsonb;
begin
 if (select count(*) from public.vehicles)<>1 then raise exception 'Legacy vehicle was not imported'; end if;
 if (select count(*) from public.fuel_entries)<>1 then raise exception 'Legacy fill-up was not imported'; end if;
 result:=public.sync_garage_record('fuel_entries','{"id":"test-fuel","notes":"updated"}',1,'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
 if (result->>'revision')::int<>2 then raise exception 'Wrong revision'; end if;
 duplicate:=public.sync_garage_record('fuel_entries','{"id":"test-fuel","notes":"updated"}',1,'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
 if duplicate<>result then raise exception 'Duplicate retry was not idempotent'; end if;
 begin
   perform public.sync_garage_record('fuel_entries','{"id":"test-fuel","notes":"stale"}',1,gen_random_uuid());
   raise exception 'Stale edit accepted';
 exception when serialization_failure then null; end;
 result:=public.sync_garage_record('fuel_entries','{"id":"test-fuel","deleted":true}',2,gen_random_uuid());
 if (result->>'deleted')::boolean is not true then raise exception 'Deletion was not saved'; end if;
 if (select count(*) from public.ownership_expenses)<>0 then raise exception 'Deleted expense still included'; end if;
 begin
   update public.vehicles set vin='unauthorized direct write';
   raise exception 'Direct write unexpectedly allowed';
 exception when insufficient_privilege then null; end;
 begin
   perform public.sync_garage_record('auth.users','{"id":"bad"}',0,gen_random_uuid());
   raise exception 'Arbitrary table accepted';
 exception when invalid_parameter_value then null; end;
end $$;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
do $$
declare result jsonb;
begin
 if (select count(*) from public.vehicles)<>0 then raise exception 'Another account can read Alice records'; end if;
 result:=public.sync_garage_record('vehicles','{"id":"bobs-car","user_id":"11111111-1111-1111-1111-111111111111","specs":{}}',0,gen_random_uuid());
 if result->>'user_id'<>'22222222-2222-2222-2222-222222222222' then raise exception 'Owner spoofing possible'; end if;
end $$;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
 begin
   perform * from public.vehicles;
   raise exception 'Anonymous reads allowed';
 exception when insufficient_privilege then null; end;
 begin
   perform public.sync_garage_record('vehicles','{"id":"bad"}',0,gen_random_uuid());
   raise exception 'Anonymous RPC allowed';
 exception when insufficient_privilege then null; end;
end $$;
rollback;
