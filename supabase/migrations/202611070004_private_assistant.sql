begin;
-- Membership is granted by the administrator, never by the browser.
create table if not exists public.garage_members (
 user_id uuid primary key references auth.users(id) on delete cascade,
 active boolean not null default true
);
alter table public.garage_members enable row level security;
revoke all on public.garage_members from anon,authenticated;
grant select on public.garage_members to authenticated;
drop policy if exists read_own_membership on public.garage_members;
create policy read_own_membership on public.garage_members for select to authenticated using ((select auth.uid())=user_id);
-- Existing confirmed accounts are the initial members. New accounts require
-- an explicit administrator grant after creation in Authentication > Users.
insert into public.garage_members(user_id)
 select id from auth.users where email_confirmed_at is not null
 on conflict(user_id) do nothing;

create table if not exists public.garage_ai_usage (
 user_id uuid primary key references auth.users(id) on delete cascade,
 minute_start timestamptz not null,
 minute_requests integer not null,
 day_start timestamptz not null,
 day_requests integer not null
);
alter table public.garage_ai_usage enable row level security;
revoke all on public.garage_ai_usage from anon,authenticated;
create or replace function public.consume_garage_ai_quota() returns boolean
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); result public.garage_ai_usage;
begin
 if uid is null or not exists(select 1 from public.garage_members where user_id=uid and active) then return false; end if;
 insert into public.garage_ai_usage as usage(user_id,minute_start,minute_requests,day_start,day_requests)
 values(uid,date_trunc('minute',now()),1,date_trunc('day',now()),1)
 on conflict(user_id) do update set
   minute_start=date_trunc('minute',now()),
   minute_requests=case when usage.minute_start=date_trunc('minute',now()) then usage.minute_requests+1 else 1 end,
   day_start=date_trunc('day',now()),
   day_requests=case when usage.day_start=date_trunc('day',now()) then usage.day_requests+1 else 1 end
 returning * into result;
 return result.minute_requests<=8 and result.day_requests<=150;
end $$;
revoke all on function public.consume_garage_ai_quota() from public,anon,authenticated;
grant execute on function public.consume_garage_ai_quota() to authenticated;
commit;

-- After manually adding another user, run (replace the UUID):
-- insert into public.garage_members(user_id) values ('USER_UUID_HERE')
-- on conflict(user_id) do update set active=true;
