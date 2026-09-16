-- Run once in the Supabase SQL editor. Auth email confirmation must be enabled.
create extension if not exists pgcrypto;
create table public.accounts (
 id uuid primary key references auth.users(id) on delete cascade,
 email text not null, display_name text not null default '', role text not null default 'member' check(role in ('owner','member')),
 tier text not null default 'basic' check(tier in ('basic','pro','executive')),
 allowance_units integer not null default 100 check(allowance_units>=0), topup_units integer not null default 0 check(topup_units>=0),
 credit_anchor timestamptz not null default now(), reset_at timestamptz not null default now()+interval '7 days',
 paid_until timestamptz, trial_used boolean not null default false, billing_status text not null default 'free',
 customer_id text unique, subscription_id text unique, last_paid_start timestamptz,
 cancel_at_period_end boolean not null default false, workspace_id uuid references public.accounts(id),
 settings jsonb not null default '{}', created_at timestamptz not null default now()
);
create unique index single_owner on accounts(role) where role='owner';
create table public.projects(id uuid primary key default gen_random_uuid(),owner_id uuid not null references accounts(id),name text not null,description text not null default '', files jsonb not null default '{}',version integer not null default 1,archived boolean not null default false,vercel_id text,deployment_url text,updated_at timestamptz not null default now(),created_at timestamptz not null default now());
create table public.revisions(id uuid primary key default gen_random_uuid(),project_id uuid not null references projects(id) on delete cascade,version integer not null,files jsonb not null,created_at timestamptz not null default now(),unique(project_id,version));
create table public.runs(id uuid primary key,owner_id uuid not null references accounts(id),actor_id uuid not null references accounts(id),project_id uuid not null references projects(id),agent text not null check(agent in ('claude','gpt','vercel')),prompt text not null,status text not null default 'queued',source_files jsonb not null,base_version integer not null,reserved_units integer not null check(reserved_units>0),reserved_allowance integer not null,reserved_topup integer not null,credit_period timestamptz not null,charged_units integer not null default 0,output text not null default '',proposals jsonb not null default '{}',trace jsonb not null default '[]',cancel_requested boolean not null default false,created_at timestamptz not null default now(),started_at timestamptz,finished_at timestamptz);
create table public.credit_ledger(id uuid primary key default gen_random_uuid(),owner_id uuid not null references accounts(id),amount_units integer not null,kind text not null,description text not null,run_id uuid references runs(id),created_at timestamptz not null default now());
create table public.integrations(owner_id uuid primary key references accounts(id),vercel_token text not null,team_id text,updated_at timestamptz not null default now());
create table public.webhook_events(id text primary key,provider text not null,event_type text not null,status text not null default 'received',payload jsonb not null,created_at timestamptz not null default now(),processed_at timestamptz,error text);
create table public.payment_receipts(id text primary key,owner_id uuid not null references accounts(id),kind text not null,created_at timestamptz not null default now());
create table public.audit_log(id uuid primary key default gen_random_uuid(),actor_id uuid references accounts(id),action text not null,detail jsonb not null default '{}',created_at timestamptz not null default now());
create table public.deployments(id text primary key,owner_id uuid not null references accounts(id),project_id uuid not null references projects(id),url text,status text not null,target text not null default 'preview',created_at timestamptz not null default now());
create index runs_queue on runs(status,created_at);create index projects_owner on projects(owner_id);create index ledger_owner on credit_ledger(owner_id,created_at desc);
-- Service-mediated authorization. No browser can read or mutate tables directly.
do $$ declare t text;begin foreach t in array array['accounts','projects','revisions','runs','credit_ledger','integrations','webhook_events','payment_receipts','audit_log','deployments'] loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon, authenticated',t);end loop;end $$;

create function public.ensure_account(p_user uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare u auth.users; a accounts; n int; next_reset timestamptz; grant_units int;
begin
 select * into u from auth.users where id=p_user;
 if u.id is null or u.email_confirmed_at is null then raise exception 'Not authorised';end if;
 insert into accounts(id,email,display_name,role,tier,allowance_units,reset_at)
 values(u.id,u.email,coalesce(u.raw_user_meta_data->>'display_name',''),case when lower(u.email)='trooperhaps@gmail.com' then 'owner' else 'member' end,case when lower(u.email)='trooperhaps@gmail.com' then 'executive' else 'basic' end,case when lower(u.email)='trooperhaps@gmail.com' then 10500 else 100 end,case when lower(u.email)='trooperhaps@gmail.com' then now()+interval '1 month' else now()+interval '7 days' end)
 on conflict(id) do nothing;
 if found then insert into credit_ledger(owner_id,amount_units,kind,description)select id,allowance_units,'allowance','Initial account allowance'from accounts where id=p_user;end if;
 select * into a from accounts where id=p_user for update;
 -- Ownership binds to the verified UUID; changing profile metadata cannot confer it.
 if a.role<>'owner' and a.tier<>'basic' and (a.paid_until is null or a.paid_until<=now()) then
  a.tier:='basic';a.credit_anchor:=now();a.reset_at:=now();a.billing_status:='expired';
  update projects set archived=true where owner_id=a.id and not archived and id not in(select id from projects where owner_id=a.id and not archived order by updated_at desc limit 1);
 end if;
 if a.reset_at<=now() then
  if a.allowance_units>0 then insert into credit_ledger(owner_id,amount_units,kind,description) values(a.id,-a.allowance_units,'expiry','Unused allowance expired');end if;
  if a.tier='basic' then
   n:=greatest(0,floor(extract(epoch from(now()-a.credit_anchor))/604800)::int);next_reset:=a.credit_anchor+((n+1)*interval '7 days');grant_units:=100;
  else
   n:=greatest(0,(extract(year from now())::int-extract(year from a.credit_anchor)::int)*12+extract(month from now())::int-extract(month from a.credit_anchor)::int);
   if a.credit_anchor+make_interval(months=>n)>now() then n:=greatest(0,n-1);end if;
   next_reset:=a.credit_anchor+make_interval(months=>n+1);grant_units:=case when a.tier='pro' then 5500 else 10500 end;
  end if;
  a.allowance_units:=grant_units;a.reset_at:=next_reset;
  insert into credit_ledger(owner_id,amount_units,kind,description) values(a.id,grant_units,'allowance','New allowance; unused credits do not roll over');
 end if;
 update accounts set email=u.email,tier=a.tier,billing_status=a.billing_status,credit_anchor=a.credit_anchor,reset_at=a.reset_at,allowance_units=a.allowance_units where id=a.id returning * into a;
 return to_jsonb(a);
end $$;

create function public.create_project(p_user uuid,p_name text,p_description text,p_files jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare a accounts;p projects;cap int;
begin
 perform ensure_account(p_user);select * into a from accounts where id=p_user for update;
 if a.workspace_id is not null then raise exception 'Not authorised';end if;
 cap:=case a.tier when 'basic' then 1 when 'pro' then 10 else 50 end;
 if (select count(*) from projects where owner_id=p_user and not archived)>=cap then raise exception 'App limit reached';end if;
 insert into projects(owner_id,name,description,files) values(p_user,p_name,p_description,p_files) returning * into p;
 insert into revisions(project_id,version,files)values(p.id,1,p.files);return to_jsonb(p);
end $$;

create function public.save_project(p_user uuid,p_id uuid,p_version int,p_files jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare p projects;w uuid;
begin
 select coalesce(workspace_id,id) into w from accounts where id=p_user;
 select * into p from projects where id=p_id and owner_id=w for update;
 if p.id is null then raise exception 'Not authorised';end if;
 if p.archived then raise exception 'Not authorised';end if;
 if p.version<>p_version then raise exception 'Version conflict';end if;
 update projects set files=p_files,version=version+1,updated_at=now() where id=p_id returning * into p;
 insert into revisions(project_id,version,files) values(p.id,p.version,p.files);return to_jsonb(p);
end $$;

create function public.reserve_run(p_user uuid,p_id uuid,p_project uuid,p_agent text,p_prompt text,p_units int) returns jsonb language plpgsql security definer set search_path=public as $$
declare a accounts;p projects;r runs;w uuid;ra int;cap int;
begin
 select coalesce(workspace_id,id) into w from accounts where id=p_user;
 perform ensure_account(w);select * into a from accounts where id=w for update;
 select * into r from runs where id=p_id;
 if r.id is not null then if r.actor_id<>p_user then raise exception 'Not authorised';end if;return to_jsonb(r);end if;
 select * into p from projects where id=p_project and owner_id=w and not archived;
 if p.id is null then raise exception 'Not authorised';end if;
 cap:=case a.tier when 'basic' then 1 when 'pro' then 2 else 5 end;
 if (select count(*) from runs where owner_id=w and status in ('queued','running'))>=cap then raise exception 'Concurrent task limit reached';end if;
 if p_units<1 or p_units>10000 or a.allowance_units+a.topup_units<p_units then raise exception 'Insufficient credits';end if;
 ra:=least(a.allowance_units,p_units);
 update accounts set allowance_units=allowance_units-ra,topup_units=topup_units-(p_units-ra)where id=w;
 insert into runs(id,owner_id,actor_id,project_id,agent,prompt,source_files,base_version,reserved_units,reserved_allowance,reserved_topup,credit_period)
 values(p_id,w,p_user,p.id,p_agent,p_prompt,p.files,p.version,p_units,ra,p_units-ra,a.reset_at)returning * into r;
 insert into credit_ledger(owner_id,amount_units,kind,description,run_id)values(w,-p_units,'reservation','Task spending cap reserved',p_id);return to_jsonb(r);
end $$;
create function public.claim_run(p_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare r runs;
begin update runs set status='running',started_at=now() where id=p_id and status='queued' returning * into r;return case when r.id is null then null else to_jsonb(r) end;end $$;
create function public.finish_run(p_id uuid,p_status text,p_units int,p_output text,p_proposals jsonb,p_trace jsonb)returns void language plpgsql security definer set search_path=public as $$
declare r runs;a accounts;charge_a int;charge_t int;refund_a int;refund_t int;
begin
 select * into r from runs where id=p_id;if r.id is null then return;end if;
 select * into a from accounts where id=r.owner_id for update;
 select * into r from runs where id=p_id for update;
 if r.status not in ('queued','running') then return;end if;
 if p_units<0 or p_units>r.reserved_units or p_status not in ('completed','failed','cancelled','budget_exhausted') then raise exception 'Invalid settlement';end if;
 charge_a:=least(r.reserved_allowance,p_units);charge_t:=p_units-charge_a;
 refund_a:=case when a.reset_at=r.credit_period and a.reset_at>now() then r.reserved_allowance-charge_a else 0 end;
 refund_t:=r.reserved_topup-charge_t;
 update accounts set allowance_units=allowance_units+refund_a,topup_units=topup_units+refund_t where id=a.id;
 update runs set status=p_status,charged_units=p_units,output=p_output,proposals=p_proposals,trace=p_trace,finished_at=now()where id=p_id;
 insert into credit_ledger(owner_id,amount_units,kind,description,run_id)values(a.id,refund_a+refund_t,'settlement',case when p_status='failed' then 'Task failed; available reservation returned' else 'Unused reservation returned; task cost '||(p_units/10.0)||' credits' end,p_id);
end $$;

create function public.apply_payment(p_receipt text,p_user uuid,p_kind text,p_tier text,p_start timestamptz,p_end timestamptz,p_units int,p_subscription text) returns boolean language plpgsql security definer set search_path=public as $$
declare a accounts;grant_units int;
begin
 select * into a from accounts where id=p_user for update;if a.id is null then raise exception 'Account unavailable';end if;
 if exists(select 1 from payment_receipts where id=p_receipt)then return false;end if;
 if p_kind='topup' then
  if p_units not in(1000,3000,10000)then raise exception 'Invalid topup';end if;
  update accounts set topup_units=topup_units+p_units where id=p_user;
  insert into credit_ledger(owner_id,amount_units,kind,description)values(p_user,p_units,'payment','Purchased credits; no expiry');
 else
  if p_kind='trial' then
   if a.trial_used or a.tier<>'basic' then raise exception 'Trial already used';end if;
   grant_units:=1000;
   update accounts set tier='pro',trial_used=true,billing_status='trialing',credit_anchor=p_start,reset_at=p_end,paid_until=p_end,allowance_units=grant_units,subscription_id=p_subscription where id=p_user;
  else
   if p_tier not in ('pro','executive')then raise exception 'Invalid tier';end if;
   if a.last_paid_start is not null and p_start<=a.last_paid_start then
    insert into payment_receipts(id,owner_id,kind)values(p_receipt,p_user,p_kind);return false;
   end if;
   grant_units:=case p_tier when 'pro' then 5500 else 10500 end;
   update accounts set tier=p_tier,billing_status='active',credit_anchor=p_start,reset_at=p_start+interval '1 month',paid_until=p_end,allowance_units=grant_units,subscription_id=p_subscription,last_paid_start=p_start,cancel_at_period_end=false where id=p_user;
  end if;
  if a.allowance_units>0 then insert into credit_ledger(owner_id,amount_units,kind,description)values(p_user,-a.allowance_units,'expiry','Previous allowance replaced by new billing period');end if;
  insert into credit_ledger(owner_id,amount_units,kind,description)values(p_user,grant_units,'payment',case p_kind when 'trial' then 'Seven-day Pro trial allowance' else 'Paid membership allowance' end);
 end if;
 insert into payment_receipts(id,owner_id,kind)values(p_receipt,p_user,p_kind);return true;
end $$;

create function public.adjust_credits(p_actor uuid,p_user uuid,p_units int,p_reason text)returns void language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from accounts where id=p_actor and role='owner')then raise exception 'Not authorised';end if;
 if abs(p_units)>1000000 or length(p_reason)<5 then raise exception 'Invalid adjustment';end if;
 update accounts set topup_units=topup_units+p_units where id=p_user and topup_units+p_units>=0;
 if not found then raise exception 'Insufficient credits';end if;
 insert into credit_ledger(owner_id,amount_units,kind,description)values(p_user,p_units,'adjustment',p_reason);
 insert into audit_log(actor_id,action,detail)values(p_actor,'credits.adjust',jsonb_build_object('user',p_user,'units',p_units,'reason',p_reason));
end $$;

create function public.add_member(p_user uuid,p_email text)returns void language plpgsql security definer set search_path=public as $$
declare a accounts;m accounts;
begin
 perform ensure_account(p_user);select * into a from accounts where id=p_user for update;
 if a.tier<>'executive' or a.workspace_id is not null then raise exception 'Not authorised';end if;
 if(select count(*)from accounts where workspace_id=p_user)>=4 then raise exception 'Member limit reached';end if;
 select * into m from accounts where lower(email)=lower(p_email)for update;
 if m.id is null or m.id=p_user or m.role='owner' or m.tier<>'basic' or m.workspace_id is not null then raise exception 'Account unavailable';end if;
 -- Invitation acceptance is required; membership cannot be forced by the inviter.
 update accounts set settings=jsonb_set(settings,'{invited_by}',to_jsonb(p_user::text))where id=m.id;
 insert into audit_log(actor_id,action,detail)values(p_user,'workspace.invite',jsonb_build_object('member',m.id));
end $$;
create function public.accept_workspace(p_user uuid)returns void language plpgsql security definer set search_path=public as $$
declare a accounts;w accounts;wid uuid;
begin
 select (settings->>'invited_by')::uuid into wid from accounts where id=p_user;
 if wid is null then raise exception 'Account unavailable';end if;
 perform ensure_account(wid);select * into w from accounts where id=wid for update;
 select * into a from accounts where id=p_user for update;
 if w.tier<>'executive' or a.role='owner' or a.tier<>'basic' or a.workspace_id is not null then raise exception 'Not authorised';end if;
 if(select count(*)from accounts where workspace_id=wid)>=4 then raise exception 'Member limit reached';end if;
 update accounts set workspace_id=wid,settings=settings-'invited_by'where id=p_user;
end $$;
-- Functions are callable only by trusted server code with service_role credentials.
do $$ declare f record;begin for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('ensure_account','create_project','save_project','reserve_run','claim_run','finish_run','apply_payment','adjust_credits','add_member','accept_workspace')loop execute format('revoke all on function %s from public, anon, authenticated',f.sig);execute format('grant execute on function %s to service_role',f.sig);end loop;end $$;

create table public.automations(id uuid primary key default gen_random_uuid(),owner_id uuid not null references accounts(id),actor_id uuid not null references accounts(id),project_id uuid not null references projects(id),name text not null,agent text not null check(agent in ('gpt','claude','vercel')),prompt text not null,cap_units integer not null check(cap_units between 1 and 10000),cadence text not null check(cadence in ('daily','weekly')),enabled boolean not null default true,next_run timestamptz not null,last_result text,created_at timestamptz not null default now());
alter table public.automations enable row level security;revoke all on public.automations from anon,authenticated;
create function public.create_automation(p_user uuid,p_project uuid,p_name text,p_agent text,p_prompt text,p_units int,p_cadence text)returns jsonb language plpgsql security definer set search_path=public as $$
declare a accounts;r automations;cap int;
begin
 perform ensure_account(p_user);select * into a from accounts where id=p_user for update;
 if a.tier='basic' or a.workspace_id is not null then raise exception 'Not authorised';end if;
 if not exists(select 1 from projects where id=p_project and owner_id=p_user and not archived)then raise exception 'Not authorised';end if;
 cap:=case a.tier when 'pro' then 10 else 50 end;
 if(select count(*)from automations where owner_id=p_user and enabled)>=cap then raise exception 'App limit reached';end if;
 insert into automations(owner_id,actor_id,project_id,name,agent,prompt,cap_units,cadence,next_run)values(p_user,p_user,p_project,p_name,p_agent,p_prompt,p_units,p_cadence,now()+case p_cadence when 'daily' then interval '1 day' else interval '7 days' end)returning * into r;return to_jsonb(r);
end $$;
revoke all on function public.create_automation(uuid,uuid,text,text,text,int,text)from public,anon,authenticated;
grant execute on function public.create_automation(uuid,uuid,text,text,text,int,text)to service_role;

create function public.archive_project(p_user uuid,p_id uuid,p_archived boolean)returns void language plpgsql security definer set search_path=public as $$
declare a accounts;cap int;
begin
 perform ensure_account(p_user);select * into a from accounts where id=p_user for update;
 if a.workspace_id is not null then raise exception 'Not authorised';end if;
 if not exists(select 1 from projects where id=p_id and owner_id=p_user)then raise exception 'Not authorised';end if;
 cap:=case a.tier when 'basic' then 1 when 'pro' then 10 else 50 end;
 if not p_archived and (select count(*)from projects where owner_id=p_user and not archived and id<>p_id)>=cap then raise exception 'App limit reached';end if;
 update projects set archived=p_archived where id=p_id;
end $$;
revoke all on function public.archive_project(uuid,uuid,boolean)from public,anon,authenticated;
grant execute on function public.archive_project(uuid,uuid,boolean)to service_role;

create table public.checkout_locks(owner_id uuid primary key references accounts(id),lease uuid not null,expires_at timestamptz not null);
alter table public.checkout_locks enable row level security;revoke all on public.checkout_locks from anon,authenticated;
create function public.claim_checkout(p_user uuid,p_lease uuid)returns void language plpgsql security definer set search_path=public as $$
begin
 insert into checkout_locks(owner_id,lease,expires_at) values(p_user,p_lease,now()+interval '2 minutes') on conflict(owner_id)do update set lease=excluded.lease,expires_at=excluded.expires_at where checkout_locks.expires_at<now();
 if not found then raise exception 'Checkout already in progress';end if;
end $$;
create function public.release_checkout(p_user uuid,p_lease uuid)returns void language plpgsql security definer set search_path=public as $$
begin delete from checkout_locks where owner_id=p_user and lease=p_lease;end $$;
revoke all on function public.claim_checkout(uuid,uuid),public.release_checkout(uuid,uuid)from public,anon,authenticated;
grant execute on function public.claim_checkout(uuid,uuid),public.release_checkout(uuid,uuid)to service_role;

-- Explicit grants avoid reliance on project-specific default privilege settings.
do $$ declare t text;begin foreach t in array array['accounts','projects','revisions','runs','credit_ledger','integrations','webhook_events','payment_receipts','audit_log','deployments','automations','checkout_locks']loop execute format('grant all on public.%I to service_role',t);end loop;end $$;
