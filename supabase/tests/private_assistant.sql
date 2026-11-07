-- Local integration fixture from relational_sync.sql only. Not production SQL.
begin;
update public.garage_members set active=false where user_id='22222222-2222-2222-2222-222222222222';
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
do $$ begin
 if (select count(*) from public.garage_members)<>1 then raise exception 'Membership isolation failed'; end if;
 for i in 1..8 loop
   if not public.consume_garage_ai_quota() then raise exception 'Early quota denial'; end if;
 end loop;
 if public.consume_garage_ai_quota() then raise exception 'Quota did not limit requests'; end if;
 begin
   update public.garage_members set active=true;
   raise exception 'Client can grant membership';
 exception when insufficient_privilege then null; end;
 begin
   perform * from public.garage_ai_usage;
   raise exception 'Client can read quota internals';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
do $$ begin
 if public.consume_garage_ai_quota() then raise exception 'Inactive member allowed AI'; end if;
end $$;
set local role anon;
do $$ begin
 begin
   perform public.consume_garage_ai_quota();
   raise exception 'Anonymous AI quota request allowed';
 exception when insufficient_privilege then null; end;
end $$;
rollback;
