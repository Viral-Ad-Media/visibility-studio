-- Upgrade an existing Visibility Studio schema; do not apply to unrelated projects.
-- Existing vis_* definitions must be exported and reviewed before production rollout.
create table public.vis_platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.vis_platform_admins enable row level security;
revoke all on public.vis_platform_admins from public, anon, authenticated;
-- Preserve the existing operator owners, not their invited members.
insert into public.vis_platform_admins (user_id)
select distinct au.user_id from public.vis_account_users au
join public.vis_accounts a on a.id = au.account_id
where a.is_platform_admin and au.role = 'owner';

create table public.vis_team_invites (
  account_id bigint not null references public.vis_accounts(id) on delete cascade,
  email text not null,
  invited_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (account_id, email)
);
alter table public.vis_team_invites enable row level security;
revoke all on public.vis_team_invites from public, anon, authenticated;
-- Application service routes alone create/accept invitations after authorization.
revoke insert, update, delete on public.vis_account_users from anon, authenticated;

alter table public.vis_jobs add column reserved_usd numeric not null default 0 check (reserved_usd >= 0);
create index vis_jobs_account_status_idx on public.vis_jobs (account_id, status);
create index vis_businesses_account_id_idx on public.vis_businesses (account_id, id desc);
create index vis_audits_account_id_idx on public.vis_audits (account_id, id desc);
create index vis_campaigns_account_id_idx on public.vis_campaigns (account_id, id desc);

-- Active account is a server-validated JWT claim. Direct PostgREST retains membership
-- isolation; this RESTRICTIVE policy can only narrow, never broaden existing policies.
do $$
declare t text;
begin
  for t in select table_name from information_schema.columns
    where table_schema = 'public' and column_name = 'account_id' and table_name like 'vis\_%' escape '\'
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy vis_active_account on public.%I as restrictive for all to authenticated using (
      nullif(auth.jwt()->>''vis_account_id'', '''') is null or account_id = (auth.jwt()->>''vis_account_id'')::bigint
    ) with check (nullif(auth.jwt()->>''vis_account_id'', '''') is null or account_id = (auth.jwt()->>''vis_account_id'')::bigint)', t);
  end loop;
end $$;
create policy vis_active_account on public.vis_accounts as restrictive for all to authenticated
  using (nullif(auth.jwt()->>'vis_account_id', '') is null or id = (auth.jwt()->>'vis_account_id')::bigint)
  with check (nullif(auth.jwt()->>'vis_account_id', '') is null or id = (auth.jwt()->>'vis_account_id')::bigint);

-- Build payloads from authorized targets, with access, credit reservations,
-- queue bounds and account-level serialization.
create function public.vis_enqueue_job_guarded(p_type text, p_target_id bigint)
returns bigint language plpgsql security definer set search_path = '' as $$
declare aid bigint; reservation numeric; available numeric; jid bigint; target bigint; body text;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if p_type = 'run_audit' then
    select account_id, target_count into aid, target from public.vis_audits where id = p_target_id;
    reservation := 1 + coalesce(target, 0);
  elsif p_type in ('build_redesign', 'create_booking_link') then
    select account_id into aid from public.vis_campaign_businesses where id = p_target_id;
    reservation := case when p_type = 'build_redesign' then 1 else 0.1 end;
  else raise exception 'invalid_job_type'; end if;
  if p_type='run_audit' and (target is null or target not between 1 and 50) then raise exception 'invalid_target_count'; end if;
  if aid is null or not exists (select 1 from public.vis_account_users where account_id=aid and user_id=auth.uid()) then
    raise exception 'unauthorized';
  end if;
  if nullif(auth.jwt()->>'vis_account_id','') is not null and aid <> (auth.jwt()->>'vis_account_id')::bigint then raise exception 'unauthorized'; end if;
  perform id from public.vis_accounts where id=aid for update;
  if not exists (select 1 from public.vis_accounts where id=aid and (access_granted or trial_ends_at > now())) then
    raise exception 'access_required';
  end if;
  if exists (select 1 from public.vis_jobs where account_id=aid and type=p_type and status in ('pending','running')
    and coalesce((payload::json->>'campaign_business_id')::bigint, (payload::json->>'audit_id')::bigint)=p_target_id) then
    raise exception 'already_queued';
  end if;
  if (select count(*) from public.vis_jobs where account_id=aid and status in ('pending','running')) >= 150 then
    raise exception 'queue_limit';
  end if;
  select coalesce(sum(delta_usd),0) into available from public.vis_credits_ledger where account_id=aid;
  available := available - (select coalesce(sum(reserved_usd),0) from public.vis_jobs where account_id=aid and status in ('pending','running'));
  if available < reservation then raise exception 'insufficient_available_credits'; end if;
  if p_type = 'run_audit' then
    body := json_build_object('audit_id',p_target_id)::text;
    update public.vis_audits set status='queued', error=null, updated_at=now()::text where id=p_target_id;
  else
    select json_build_object('campaign_business_id',cb.id,'campaign_id',cb.campaign_id,'business_id',cb.business_id,'audit_id',c.audit_id)::text
    into body from public.vis_campaign_businesses cb join public.vis_campaigns c on c.id=cb.campaign_id where cb.id=p_target_id;
    if p_type = 'build_redesign' then
      update public.vis_campaign_businesses set redesign_status='pending', redesign_error=null, updated_at=now()::text where id=p_target_id;
    else
      update public.vis_campaign_businesses set booking_status='pending', booking_error=null, updated_at=now()::text where id=p_target_id;
    end if;
  end if;
  insert into public.vis_jobs (account_id,type,payload,reserved_usd) values (aid,p_type,body,reservation) returning id into jid;
  return jid;
end $$;
revoke all on function public.vis_enqueue_job_guarded(text,bigint) from public, anon;
grant execute on function public.vis_enqueue_job_guarded(text,bigint) to authenticated;
revoke all on function public.vis_enqueue_job(text,bigint) from public, anon, authenticated;

-- Claim tokens are the monotonically incrementing attempts column. Six-minute
-- reclaim is longer than the 300-second function limit; late writers are fenced.
create function public.vis_claim_job_v2() returns setof public.vis_jobs
language plpgsql security definer set search_path = '' as $$
begin
  with expired as (
    update public.vis_jobs set status='error', result='Worker exceeded retry limit', reserved_usd=0, updated_at=now()::text
    where status='running' and updated_at::timestamptz < now()-interval '6 minutes' and attempts>=5
    returning type, payload
  ), audits as (
    update public.vis_audits a set status='error', error='Worker exceeded retry limit', updated_at=now()::text
    where a.status in ('queued','running') and exists (select 1 from expired j where j.type='run_audit'
      and (j.payload::json->>'audit_id')::bigint=a.id) returning a.id
  ), redesigns as (
    update public.vis_campaign_businesses cb set redesign_status='error', redesign_error='Worker exceeded retry limit', updated_at=now()::text
    where cb.redesign_status in ('pending','running') and exists (select 1 from expired j where j.type='build_redesign'
      and (j.payload::json->>'campaign_business_id')::bigint=cb.id) returning cb.id
  )
  update public.vis_campaign_businesses cb set booking_status='error', booking_error='Worker exceeded retry limit', updated_at=now()::text
    where cb.booking_status in ('pending','running') and exists (select 1 from expired j where j.type='create_booking_link'
      and (j.payload::json->>'campaign_business_id')::bigint=cb.id);
  return query update public.vis_jobs set status='running', attempts=attempts+1, updated_at=now()::text
    where id=(select id from public.vis_jobs where attempts<5 and
      (status='pending' or (status='running' and updated_at::timestamptz < now()-interval '6 minutes'))
      order by id for update skip locked limit 1) returning *;
end $$;
revoke all on function public.vis_claim_job_v2() from public, anon, authenticated;
revoke all on function public.vis_claim_job() from public, anon, authenticated;
-- Postgres worker connection owns execution, not public API clients.
revoke insert, update, delete, truncate on public.vis_jobs from anon, authenticated;
drop policy if exists vis_tenant_isolation on public.vis_jobs;
create policy vis_jobs_member_read on public.vis_jobs for select to authenticated using (
  exists (select 1 from public.vis_account_users au where au.account_id=vis_jobs.account_id and au.user_id=auth.uid())
);
revoke insert, update on public.vis_campaign_businesses from anon, authenticated;
grant insert (campaign_id, business_id) on public.vis_campaign_businesses to authenticated;
grant update (stage, updated_at) on public.vis_campaign_businesses to authenticated;

-- Billing and operator flags are never client writable, even through PostgREST.
revoke insert, update, delete on public.vis_accounts from anon, authenticated;
revoke insert, update, delete on public.vis_credits_ledger from anon, authenticated;
revoke insert, update, delete on public.vis_payments from anon, authenticated;
revoke insert, update, delete on public.vis_referrals from anon, authenticated;

-- Serialize legacy onboarding to keep the one-owned-account check atomic.
create function public.vis_create_account_guarded(account_name text, p_referral_code text default null)
returns bigint language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if length(trim(account_name)) not between 1 and 200 then raise exception 'invalid_account_name'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  return public.vis_create_account_with_owner(account_name,p_referral_code);
end $$;
revoke all on function public.vis_create_account_with_owner(text,text) from public,anon,authenticated;
revoke all on function public.vis_create_account_guarded(text,text) from public,anon;
grant execute on function public.vis_create_account_guarded(text,text) to authenticated;

-- Keep trial history independent of deletable memberships/accounts.
create table public.vis_trial_claims(user_id uuid primary key, account_id bigint unique not null, claimed_at timestamptz not null default now());
alter table public.vis_trial_claims enable row level security;
revoke all on public.vis_trial_claims from public,anon,authenticated;
insert into public.vis_trial_claims(user_id,account_id)
select distinct on (au.user_id) au.user_id,a.id from public.vis_accounts a
join public.vis_account_users au on au.account_id=a.id and au.role='owner'
where a.trial_ends_at is not null order by au.user_id,a.id on conflict do nothing;
create function public.vis_start_trial_for_account(aid bigint)
returns void language plpgsql security definer set search_path='' as $$
declare account public.vis_accounts; referral public.vis_referrals;
begin
  if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null)
    or not exists(select 1 from public.vis_account_users where account_id=aid and user_id=auth.uid() and role='owner') then raise exception 'unauthorized'; end if;
  if nullif(auth.jwt()->>'vis_account_id','') is not null and aid<>(auth.jwt()->>'vis_account_id')::bigint then raise exception 'unauthorized'; end if;
  select * into account from public.vis_accounts where id=aid for update;
  if account.access_granted or account.trial_ends_at is not null then return; end if;
  insert into public.vis_trial_claims(user_id,account_id) values(auth.uid(),aid);
  update public.vis_accounts set trial_ends_at=now()+interval '30 days',updated_at=now() where id=aid;
  insert into public.vis_credits_ledger(account_id,delta_usd,reason) values(aid,20,'trial_starter_credit');
  select * into referral from public.vis_referrals where referred_account_id=aid and status='pending' for update;
  if found and referral.referrer_account_id<>aid and not exists(
    select 1 from public.vis_account_users where account_id=referral.referrer_account_id and user_id=auth.uid()
  ) then
    insert into public.vis_credits_ledger(account_id,delta_usd,reason) values
      (referral.referrer_account_id,referral.reward_usd,'referral_reward:referrer:'||referral.id),
      (aid,referral.reward_usd,'referral_reward:referred:'||referral.id);
    update public.vis_referrals set status='rewarded',rewarded_at=now() where id=referral.id;
  end if;
end $$;
revoke all on function public.vis_start_trial() from public,anon,authenticated;
revoke all on function public.vis_start_trial_for_account(bigint) from public,anon;
grant execute on function public.vis_start_trial_for_account(bigint) to authenticated;

-- Research artifacts and audit execution status are worker-owned.
revoke insert, update on public.vis_businesses from anon,authenticated;
grant update (crm_status,updated_at) on public.vis_businesses to authenticated;
revoke insert, update on public.vis_audits from anon,authenticated;
grant insert (query,category,location,target_count,notes,account_id) on public.vis_audits to authenticated;
grant update (query,category,location,target_count,notes,updated_at) on public.vis_audits to authenticated;
alter table public.vis_audits add constraint vis_audits_target_bound check (target_count between 1 and 50);
create function public.vis_guard_queued_audit() returns trigger language plpgsql set search_path='' as $$
begin
  if current_user='authenticated' and old.status in ('queued','running') and
    (new.query,new.category,new.location,new.target_count,new.notes) is distinct from
    (old.query,old.category,old.location,old.target_count,old.notes) then raise exception 'audit_is_active'; end if;
  return new;
end $$;
create trigger vis_guard_queued_audit before update on public.vis_audits for each row execute function public.vis_guard_queued_audit();
