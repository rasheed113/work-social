create table if not exists public.ai_action_claims (
  action_id uuid primary key references public.ai_pending_actions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  tool_name text not null,
  arguments jsonb not null default '{}'::jsonb,
  claimed_at timestamptz not null default now(),
  consumed_at timestamptz,
  failed_at timestamptz
);
alter table public.ai_action_claims enable row level security;
create policy ai_action_claims_select_own on public.ai_action_claims for select to authenticated using ((select auth.uid()) = user_id);
grant select on public.ai_action_claims to authenticated;

create or replace function public.claim_ai_pending_action(p_action_id uuid)
returns table(action_id uuid, tool_name text, arguments jsonb)
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := (select auth.uid()); v_action public.ai_pending_actions%rowtype;
begin
  if v_user is null then raise exception using message = 'Authentication is required.'; end if;
  select * into v_action from public.ai_pending_actions where id=p_action_id and user_id=v_user for update;
  if not found then raise exception using message = 'The requested action no longer exists.'; end if;
  if v_action.status <> 'pending' then raise exception using message = format('This action is already %s.',v_action.status); end if;
  if v_action.expires_at <= now() then
    update public.ai_pending_actions set status='expired' where id=v_action.id and user_id=v_user and status='pending';
    raise exception using message='The confirmation expired. Please ask Work Social AI again.';
  end if;
  insert into public.ai_action_claims(action_id,user_id,tool_name,arguments) values(v_action.id,v_user,v_action.tool_name,v_action.arguments);
  update public.ai_tool_calls set status='confirmed',confirmation_state='confirmed',confirmed_at=now(),execution_state='not_started' where pending_action_id=v_action.id and user_id=v_user;
  return query select v_action.id,v_action.tool_name,v_action.arguments;
exception when unique_violation then
  raise exception using message='This action has already been confirmed or is being executed.';
end; $$;
revoke execute on function public.claim_ai_pending_action(uuid) from public,anon;
grant execute on function public.claim_ai_pending_action(uuid) to authenticated;

create or replace function public.ai_link_pending_tool_call()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_pending uuid;
begin
  if new.status='awaiting_confirmation' then
    select p.id into v_pending from public.ai_pending_actions p where p.user_id=new.user_id and p.conversation_id=new.conversation_id and p.tool_name=new.tool_name and p.status='pending' and p.arguments @> new.arguments order by p.created_at desc limit 1;
    if v_pending is not null then update public.ai_tool_calls set pending_action_id=v_pending,confirmation_state='awaiting_confirmation',execution_state='not_started',verification_state='not_checked' where id=new.id; end if;
  end if;
  return new;
end; $$;
revoke execute on function public.ai_link_pending_tool_call() from public,anon,authenticated;
drop trigger if exists ai_tool_calls_link_pending on public.ai_tool_calls;
create trigger ai_tool_calls_link_pending after insert on public.ai_tool_calls for each row execute function public.ai_link_pending_tool_call();

create or replace function public.ai_sync_pending_action_history()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status='cancelled' then
    update public.ai_tool_calls set status='cancelled',confirmation_state='cancelled',completed_at=coalesce(completed_at,now()) where pending_action_id=new.id and user_id=new.user_id;
  elsif new.status='expired' then
    update public.ai_tool_calls set status='cancelled',confirmation_state='cancelled',error_message='Confirmation expired.',completed_at=coalesce(completed_at,now()) where pending_action_id=new.id and user_id=new.user_id;
  end if;
  return new;
end; $$;
revoke execute on function public.ai_sync_pending_action_history() from public,anon,authenticated;
drop trigger if exists ai_pending_actions_sync_history on public.ai_pending_actions;
create trigger ai_pending_actions_sync_history after update of status on public.ai_pending_actions for each row execute function public.ai_sync_pending_action_history();

create or replace function public.ai_require_claim_for_work_entry()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_claim public.ai_action_claims%rowtype; v_pending boolean; v_uid uuid := (select auth.uid());
begin
  select exists(select 1 from public.ai_pending_actions p join public.worker_profiles wp on wp.profile_id=p.user_id where p.user_id=v_uid and p.tool_name='create_work_entry' and p.status='pending' and wp.id=new.worker_profile_id and p.arguments->>'item_name'=new.item_name and coalesce((p.arguments->>'quantity')::numeric,0)=new.quantity and coalesce((p.arguments->>'rate')::numeric,0)=new.rate) into v_pending;
  if not v_pending then return new; end if;
  select c.* into v_claim from public.ai_action_claims c join public.worker_profiles wp on wp.profile_id=c.user_id where c.user_id=v_uid and c.tool_name='create_work_entry' and c.consumed_at is null and c.failed_at is null and wp.id=new.worker_profile_id and c.arguments->>'item_name'=new.item_name and coalesce((c.arguments->>'quantity')::numeric,0)=new.quantity and coalesce((c.arguments->>'rate')::numeric,0)=new.rate order by c.claimed_at desc limit 1;
  if not found then raise exception using message='AI write requires an explicit confirmation claim.'; end if;
  update public.ai_action_claims set consumed_at=now() where action_id=v_claim.action_id and consumed_at is null;
  update public.ai_pending_actions set status='succeeded' where id=v_claim.action_id and user_id=v_uid and status='pending';
  update public.ai_tool_calls set status='verified',execution_state='succeeded',verification_state='verified',record_ids=jsonb_build_array(new.id),verification_result=to_jsonb(new),verified_at=now(),completed_at=now() where pending_action_id=v_claim.action_id and user_id=v_uid;
  return new;
end; $$;
revoke execute on function public.ai_require_claim_for_work_entry() from public,anon,authenticated;
drop trigger if exists ai_work_entry_confirmation_guard on public.work_entries;
create trigger ai_work_entry_confirmation_guard after insert on public.work_entries for each row execute function public.ai_require_claim_for_work_entry();

create or replace function public.ai_require_claim_for_diary()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_claim public.ai_action_claims%rowtype; v_pending boolean; v_uid uuid := (select auth.uid());
begin
  select exists(select 1 from public.ai_pending_actions p join public.worker_profiles wp on wp.profile_id=p.user_id where p.user_id=v_uid and p.tool_name='create_diary_entry' and p.status='pending' and wp.id=new.worker_profile_id and p.arguments->>'content'=new.content and coalesce(p.arguments->>'entry_type','note')=new.entry_type) into v_pending;
  if not v_pending then return new; end if;
  select c.* into v_claim from public.ai_action_claims c join public.worker_profiles wp on wp.profile_id=c.user_id where c.user_id=v_uid and c.tool_name='create_diary_entry' and c.consumed_at is null and c.failed_at is null and wp.id=new.worker_profile_id and c.arguments->>'content'=new.content and coalesce(c.arguments->>'entry_type','note')=new.entry_type order by c.claimed_at desc limit 1;
  if not found then raise exception using message='AI write requires an explicit confirmation claim.'; end if;
  update public.ai_action_claims set consumed_at=now() where action_id=v_claim.action_id and consumed_at is null;
  update public.ai_pending_actions set status='succeeded' where id=v_claim.action_id and user_id=v_uid and status='pending';
  update public.ai_tool_calls set status='verified',execution_state='succeeded',verification_state='verified',record_ids=jsonb_build_array(new.id),verification_result=to_jsonb(new),verified_at=now(),completed_at=now() where pending_action_id=v_claim.action_id and user_id=v_uid;
  return new;
end; $$;
revoke execute on function public.ai_require_claim_for_diary() from public,anon,authenticated;
drop trigger if exists ai_diary_confirmation_guard on public.worker_diary_entries;
create trigger ai_diary_confirmation_guard after insert on public.worker_diary_entries for each row execute function public.ai_require_claim_for_diary();

create or replace function public.ai_require_claim_for_work_finance()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_claim public.ai_action_claims%rowtype; v_pending boolean; v_uid uuid := (select auth.uid());
begin
  select exists(select 1 from public.ai_pending_actions p join public.worker_profiles wp on wp.profile_id=p.user_id where p.user_id=v_uid and p.tool_name='create_work_finance_received' and p.status='pending' and wp.id=new.worker_profile_id and p.arguments->>'entry_type'=new.entry_type and coalesce((p.arguments->>'amount')::numeric,0)=new.amount) into v_pending;
  if not v_pending then return new; end if;
  select c.* into v_claim from public.ai_action_claims c join public.worker_profiles wp on wp.profile_id=c.user_id where c.user_id=v_uid and c.tool_name='create_work_finance_received' and c.consumed_at is null and c.failed_at is null and wp.id=new.worker_profile_id and c.arguments->>'entry_type'=new.entry_type and coalesce((c.arguments->>'amount')::numeric,0)=new.amount order by c.claimed_at desc limit 1;
  if not found then raise exception using message='AI write requires an explicit confirmation claim.'; end if;
  update public.ai_action_claims set consumed_at=now() where action_id=v_claim.action_id and consumed_at is null;
  update public.ai_pending_actions set status='succeeded' where id=v_claim.action_id and user_id=v_uid and status='pending';
  update public.ai_tool_calls set status='verified',execution_state='succeeded',verification_state='verified',record_ids=jsonb_build_array(new.id),verification_result=to_jsonb(new),verified_at=now(),completed_at=now() where pending_action_id=v_claim.action_id and user_id=v_uid;
  return new;
end; $$;
revoke execute on function public.ai_require_claim_for_work_finance() from public,anon,authenticated;
drop trigger if exists ai_work_finance_confirmation_guard on public.worker_finance_received;
create trigger ai_work_finance_confirmation_guard after insert on public.worker_finance_received for each row execute function public.ai_require_claim_for_work_finance();

create or replace function public.ai_require_claim_for_finance_transaction()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_claim public.ai_action_claims%rowtype; v_pending boolean; v_uid uuid := (select auth.uid());
begin
  select exists(select 1 from public.ai_pending_actions p where p.user_id=v_uid and p.tool_name='create_finance_transaction' and p.status='pending' and p.arguments->>'type'=new.type and coalesce((p.arguments->>'amount')::numeric,0)=new.amount and coalesce(p.arguments->>'account_id','')=coalesce(new.account_id::text,'') and coalesce(p.arguments->>'category_id','')=coalesce(new.category_id::text,'') and coalesce(p.arguments->>'from_account_id','')=coalesce(new.from_account_id::text,'') and coalesce(p.arguments->>'to_account_id','')=coalesce(new.to_account_id::text,'') and p.arguments->>'date'=new.date::text) into v_pending;
  if not v_pending then return new; end if;
  select c.* into v_claim from public.ai_action_claims c where c.user_id=v_uid and c.tool_name='create_finance_transaction' and c.consumed_at is null and c.failed_at is null and c.arguments->>'type'=new.type and coalesce((c.arguments->>'amount')::numeric,0)=new.amount and coalesce(c.arguments->>'account_id','')=coalesce(new.account_id::text,'') and coalesce(c.arguments->>'category_id','')=coalesce(new.category_id::text,'') and coalesce(c.arguments->>'from_account_id','')=coalesce(new.from_account_id::text,'') and coalesce(c.arguments->>'to_account_id','')=coalesce(new.to_account_id::text,'') and c.arguments->>'date'=new.date::text order by c.claimed_at desc limit 1;
  if not found then raise exception using message='AI write requires an explicit confirmation claim.'; end if;
  update public.ai_action_claims set consumed_at=now() where action_id=v_claim.action_id and consumed_at is null;
  update public.ai_pending_actions set status='succeeded' where id=v_claim.action_id and user_id=v_uid and status='pending';
  update public.ai_tool_calls set status='verified',execution_state='succeeded',verification_state='verified',record_ids=jsonb_build_array(new.id),verification_result=to_jsonb(new),verified_at=now(),completed_at=now() where pending_action_id=v_claim.action_id and user_id=v_uid;
  return new;
end; $$;
revoke execute on function public.ai_require_claim_for_finance_transaction() from public,anon,authenticated;
drop trigger if exists ai_finance_transaction_confirmation_guard on public.expense_transactions;
create trigger ai_finance_transaction_confirmation_guard after insert on public.expense_transactions for each row execute function public.ai_require_claim_for_finance_transaction();
