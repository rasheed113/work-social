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
