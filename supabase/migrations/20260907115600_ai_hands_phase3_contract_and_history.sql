-- Work Social AI Phase 3 — Hands 2.0 contract + durable history foundation.
-- This migration is additive and preserves the existing confirmation/mutation path.
-- It is intentionally NOT a deployment of the Edge Functions.

alter table public.ai_pending_actions
  drop constraint if exists ai_pending_actions_status_check;
alter table public.ai_pending_actions
  add constraint ai_pending_actions_status_check
  check (status = any (array[
    'pending'::text,'confirmed'::text,'executing'::text,'succeeded'::text,
    'failed'::text,'cancelled'::text,'expired'::text
  ]));

alter table public.ai_tool_calls
  add column if not exists pending_action_id uuid references public.ai_pending_actions(id) on delete set null,
  add column if not exists confirmation_state text,
  add column if not exists execution_state text,
  add column if not exists verification_state text,
  add column if not exists record_ids jsonb not null default '[]'::jsonb,
  add column if not exists verification_result jsonb,
  add column if not exists confirmed_at timestamptz,
  add column if not exists executing_at timestamptz,
  add column if not exists verified_at timestamptz;

alter table public.ai_tool_calls
  drop constraint if exists ai_tool_calls_status_check;
alter table public.ai_tool_calls
  add constraint ai_tool_calls_status_check
  check (status = any (array[
    'requested'::text,'prepared'::text,'awaiting_confirmation'::text,'confirmed'::text,
    'executing'::text,'succeeded'::text,'failed'::text,'cancelled'::text,
    'verified'::text,'executed'::text
  ]));

update public.ai_tool_calls
set verification_state = 'pending'
where verification_state is null or verification_state = 'not_checked';

alter table public.ai_tool_calls
  drop constraint if exists ai_tool_calls_verification_state_check;
alter table public.ai_tool_calls
  add constraint ai_tool_calls_verification_state_check
  check (verification_state = any (array['pending'::text,'verified'::text,'failed'::text]));

alter table public.ai_tool_calls
  drop constraint if exists ai_tool_calls_execution_state_check;
alter table public.ai_tool_calls
  add constraint ai_tool_calls_execution_state_check
  check (execution_state is null or execution_state = any (array['not_started'::text,'executing'::text,'succeeded'::text,'failed'::text]));

alter table public.ai_tool_calls
  drop constraint if exists ai_tool_calls_confirmation_state_check;
alter table public.ai_tool_calls
  add constraint ai_tool_calls_confirmation_state_check
  check (confirmation_state is null or confirmation_state = any (array['not_required'::text,'awaiting_confirmation'::text,'confirmed'::text,'cancelled'::text]));

create index if not exists ai_tool_calls_pending_action_idx
  on public.ai_tool_calls(user_id, pending_action_id, created_at desc);

create table if not exists public.ai_action_claims (
  action_id uuid primary key references public.ai_pending_actions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  tool_name text not null,
  arguments jsonb not null default '{}'::jsonb,
  claimed_at timestamptz not null default now(),
  consumed_at timestamptz,
  failed_at timestamptz,
  arguments_hash text not null
);

alter table public.ai_action_claims enable row level security;

drop policy if exists ai_action_claims_select_own on public.ai_action_claims;
create policy ai_action_claims_select_own on public.ai_action_claims
  for select to authenticated using ((select auth.uid()) = user_id);

grant select on public.ai_action_claims to authenticated;

create or replace function public.ai_link_pending_tool_call()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare v_pending uuid;
begin
  if new.status = 'awaiting_confirmation' then
    select p.id into v_pending
    from public.ai_pending_actions p
    where p.user_id = new.user_id
      and p.conversation_id = new.conversation_id
      and p.tool_name = new.tool_name
      and p.status = 'pending'
      and p.arguments @> new.arguments
    order by p.created_at desc
    limit 1;
    if v_pending is not null then
      update public.ai_tool_calls
      set pending_action_id = v_pending,
          confirmation_state = 'awaiting_confirmation',
          execution_state = 'not_started',
          verification_state = 'pending'
      where id = new.id;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.claim_ai_pending_action(p_action_id uuid)
returns table(action_id uuid, tool_name text, arguments jsonb)
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_action public.ai_pending_actions%rowtype;
begin
  if v_user is null then
    raise exception using message='Authentication is required.';
  end if;

  select * into v_action
  from public.ai_pending_actions
  where id = p_action_id and user_id = v_user
  for update;

  if not found then
    raise exception using message='The requested action no longer exists.';
  end if;
  if v_action.status <> 'pending' then
    raise exception using message=format('This action is already %s.', v_action.status);
  end if;
  if v_action.expires_at <= now() then
    update public.ai_pending_actions
    set status='expired'
    where id=v_action.id and user_id=v_user and status='pending';
    raise exception using message='The confirmation expired. Please ask Work Social AI again.';
  end if;

  insert into public.ai_action_claims(action_id,user_id,tool_name,arguments,arguments_hash)
  values(v_action.id,v_user,v_action.tool_name,v_action.arguments,md5(v_action.arguments::text));

  update public.ai_tool_calls
  set status='executing',
      confirmation_state='confirmed',
      confirmed_at=now(),
      execution_state='executing',
      executing_at=now()
  where pending_action_id=v_action.id and user_id=v_user;

  return query select v_action.id,v_action.tool_name,v_action.arguments;
exception when unique_violation then
  raise exception using message='This action has already been confirmed or is being executed.';
end;
$$;

create or replace function public.ai_sync_pending_action_history()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if new.status = 'cancelled' then
    update public.ai_tool_calls
    set status='cancelled', confirmation_state='cancelled', completed_at=coalesce(completed_at,now())
    where pending_action_id=new.id and user_id=new.user_id;
  elsif new.status = 'expired' then
    update public.ai_tool_calls
    set status='cancelled', confirmation_state='cancelled', error_message='Confirmation expired.', completed_at=coalesce(completed_at,now())
    where pending_action_id=new.id and user_id=new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists ai_tool_calls_link_pending on public.ai_tool_calls;
create trigger ai_tool_calls_link_pending
after insert on public.ai_tool_calls
for each row execute function public.ai_link_pending_tool_call();

drop trigger if exists ai_pending_actions_sync_history on public.ai_pending_actions;
create trigger ai_pending_actions_sync_history
after update of status on public.ai_pending_actions
for each row execute function public.ai_sync_pending_action_history();

create table if not exists public.ai_action_history (
  action_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  action_type text not null,
  module text not null,
  operation text not null,
  status text not null check (status in ('pending','confirmed','executing','succeeded','failed','cancelled','expired')),
  affected_record_ids jsonb not null default '[]'::jsonb,
  previous_state jsonb,
  new_state jsonb,
  verification_state text not null check (verification_state in ('pending','verified','failed')),
  verification_result jsonb,
  created_at timestamptz not null default now(),
  executed_at timestamptz,
  reversible boolean not null default false,
  reverted_at timestamptz,
  parent_action_id uuid references public.ai_action_history(action_id) on delete set null
);

create index if not exists ai_action_history_user_created_idx
  on public.ai_action_history(user_id, created_at desc);
create index if not exists ai_action_history_user_status_idx
  on public.ai_action_history(user_id, status, created_at desc);
create index if not exists ai_action_history_parent_idx
  on public.ai_action_history(parent_action_id);

alter table public.ai_action_history enable row level security;
drop policy if exists ai_action_history_select_own on public.ai_action_history;
drop policy if exists ai_action_history_insert_own on public.ai_action_history;
drop policy if exists ai_action_history_update_own on public.ai_action_history;
create policy ai_action_history_select_own on public.ai_action_history
  for select to authenticated using ((select auth.uid()) = user_id);
-- No client INSERT/UPDATE grant: history is authoritative server-side evidence.
grant select on public.ai_action_history to authenticated;

create or replace function public.ai_record_action_history()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_action_type text;
  v_module text;
  v_operation text;
begin
  if new.pending_action_id is null then
    return new;
  end if;

  v_action_type := coalesce(new.arguments->>'__action_kind', 'create');
  v_operation := v_action_type;
  v_module := coalesce(new.arguments->>'__module',
    case new.tool_name
      when 'create_work_entry' then 'work'
      when 'create_diary_entry' then 'diary'
      when 'create_work_finance_received' then 'work_finance'
      when 'create_finance_transaction' then 'finance'
      else 'unknown'
    end
  );

  if new.verification_state = 'verified'
     and exists (select 1 from public.ai_pending_actions p where p.id=new.pending_action_id and p.user_id=new.user_id and p.status='succeeded') then
    insert into public.ai_action_history(
      action_id,user_id,action_type,module,operation,status,affected_record_ids,
      previous_state,new_state,verification_state,verification_result,executed_at,reversible
    ) values (
      new.pending_action_id,new.user_id,v_action_type,v_module,v_operation,'succeeded',
      coalesce(new.record_ids,'[]'::jsonb),null,new.verification_result,'verified',
      new.verification_result,coalesce(new.verified_at,new.completed_at,now()),false
    )
    on conflict (action_id) do update set
      status=excluded.status,
      affected_record_ids=excluded.affected_record_ids,
      new_state=excluded.new_state,
      verification_state=excluded.verification_state,
      verification_result=excluded.verification_result,
      executed_at=excluded.executed_at,
      reversible=excluded.reversible;
  elsif new.execution_state = 'failed' then
    insert into public.ai_action_history(
      action_id,user_id,action_type,module,operation,status,affected_record_ids,
      previous_state,new_state,verification_state,verification_result,executed_at,reversible
    ) values (
      new.pending_action_id,new.user_id,v_action_type,v_module,v_operation,'failed',
      coalesce(new.record_ids,'[]'::jsonb),null,null,'failed',
      jsonb_build_object('error',new.error_message),coalesce(new.completed_at,now()),false
    )
    on conflict (action_id) do update set
      status='failed',verification_state='failed',verification_result=excluded.verification_result,
      executed_at=excluded.executed_at,reversible=false;
  end if;
  return new;
end;
$$;

drop trigger if exists ai_tool_calls_record_action_history on public.ai_tool_calls;
create trigger ai_tool_calls_record_action_history
after insert or update of execution_state,verification_state,status on public.ai_tool_calls
for each row execute function public.ai_record_action_history();
