-- Phase 1 hardening: bind confirmation claims to an exact canonical argument fingerprint
-- and make target guards compare every AI-controlled field.

alter table public.ai_action_claims
  add column if not exists arguments_hash text;

update public.ai_action_claims
set arguments_hash = md5(arguments::text)
where arguments_hash is null;

alter table public.ai_action_claims
  alter column arguments_hash set not null;

create index if not exists ai_action_claims_arguments_hash_idx
  on public.ai_action_claims(user_id, tool_name, arguments_hash, consumed_at, failed_at);

create or replace function public.claim_ai_pending_action(p_action_id uuid)
returns table(action_id uuid, tool_name text, arguments jsonb)
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_action public.ai_pending_actions%rowtype;
  v_hash text;
begin
  if v_user is null then
    raise exception using message = 'Authentication is required.';
  end if;

  select * into v_action
  from public.ai_pending_actions
  where id = p_action_id and user_id = v_user
  for update;

  if not found then
    raise exception using message = 'The requested action no longer exists.';
  end if;

  if v_action.status <> 'pending' then
    raise exception using message = format('This action is already %s.', v_action.status);
  end if;

  if v_action.expires_at <= now() then
    update public.ai_pending_actions
      set status = 'expired'
    where id = v_action.id and user_id = v_user and status = 'pending';
    raise exception using message = 'The confirmation expired. Please ask Work Social AI again.';
  end if;

  v_hash := md5(v_action.arguments::text);

  insert into public.ai_action_claims(action_id, user_id, tool_name, arguments, arguments_hash)
  values(v_action.id, v_user, v_action.tool_name, v_action.arguments, v_hash);

  update public.ai_tool_calls
  set status = 'executing',
      confirmation_state = 'confirmed',
      confirmed_at = now(),
      execution_state = 'executing',
      executing_at = now()
  where pending_action_id = v_action.id
    and user_id = v_user;

  return query select v_action.id, v_action.tool_name, v_action.arguments;
exception when unique_violation then
  raise exception using message = 'This action has already been confirmed or is being executed.';
end; $$;

create or replace function public.ai_require_claim_for_work_entry()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_claim public.ai_action_claims%rowtype;
  v_pending boolean;
  v_uid uuid := (select auth.uid());
begin
  select exists(
    select 1
    from public.ai_pending_actions p
    join public.worker_profiles wp on wp.profile_id = p.user_id
    where p.user_id = v_uid
      and p.tool_name = 'create_work_entry'
      and p.status = 'pending'
      and wp.id = new.worker_profile_id
      and p.arguments->>'item_name' = new.item_name
      and coalesce(p.arguments->'size','null'::jsonb) = to_jsonb(new.size)
      and coalesce((p.arguments->>'quantity')::numeric,0) = new.quantity
      and coalesce((p.arguments->>'rate')::numeric,0) = new.rate
      and coalesce(p.arguments->>'special_note','') = coalesce(new.special_note,'')
      and coalesce(p.arguments->>'occurred_at_iso','') = coalesce(new.occurred_at::text,'')
  ) into v_pending;
  if not v_pending then return new; end if;

  select c.* into v_claim
  from public.ai_action_claims c
  join public.worker_profiles wp on wp.profile_id = c.user_id
  where c.user_id = v_uid
    and c.tool_name = 'create_work_entry'
    and c.consumed_at is null
    and c.failed_at is null
    and wp.id = new.worker_profile_id
    and c.arguments_hash = md5(jsonb_build_object(
      'worker_profile_id', new.worker_profile_id,
      'item_name', new.item_name,
      'size', new.size,
      'quantity', new.quantity,
      'rate', new.rate,
      'special_note', new.special_note,
      'occurred_at_iso', new.occurred_at::text,
      '__module', 'work',
      '__action_kind', 'create_work_entry'
    )::text)
  order by c.claimed_at desc
  limit 1;

  if not found then
    raise exception using message = 'AI write requires an explicit confirmation claim.';
  end if;

  update public.ai_action_claims set consumed_at = now()
  where action_id = v_claim.action_id and consumed_at is null;
  update public.ai_pending_actions set status = 'succeeded'
  where id = v_claim.action_id and user_id = v_uid and status = 'pending';
  update public.ai_tool_calls
  set status = 'verified', execution_state = 'succeeded', verification_state = 'verified',
      record_ids = jsonb_build_array(new.id), verification_result = to_jsonb(new),
      verified_at = now(), completed_at = now()
  where pending_action_id = v_claim.action_id and user_id = v_uid;
  return new;
end; $$;

create or replace function public.ai_require_claim_for_diary()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_claim public.ai_action_claims%rowtype;
  v_pending boolean;
  v_uid uuid := (select auth.uid());
begin
  select exists(
    select 1 from public.ai_pending_actions p
    join public.worker_profiles wp on wp.profile_id = p.user_id
    where p.user_id = v_uid and p.tool_name = 'create_diary_entry' and p.status = 'pending'
      and wp.id = new.worker_profile_id
      and coalesce(p.arguments->>'entry_type','note') = new.entry_type
      and coalesce(p.arguments->>'title','') = coalesce(new.title,'')
      and p.arguments->>'content' = new.content
      and coalesce(p.arguments->>'date_iso','') = coalesce(new.event_start_at::text,'')
  ) into v_pending;
  if not v_pending then return new; end if;

  select c.* into v_claim
  from public.ai_action_claims c
  join public.worker_profiles wp on wp.profile_id = c.user_id
  where c.user_id = v_uid and c.tool_name = 'create_diary_entry'
    and c.consumed_at is null and c.failed_at is null and wp.id = new.worker_profile_id
    and c.arguments_hash = md5(jsonb_build_object(
      'worker_profile_id', new.worker_profile_id,
      'entry_type', new.entry_type,
      'title', new.title,
      'content', new.content,
      'date_iso', case when new.entry_type = 'event' then new.event_start_at::text else '' end,
      '__module', 'personal_diary',
      '__action_kind', 'create_diary_entry'
    )::text)
  order by c.claimed_at desc limit 1;

  if not found then raise exception using message = 'AI write requires an explicit confirmation claim.'; end if;
  update public.ai_action_claims set consumed_at = now() where action_id = v_claim.action_id and consumed_at is null;
  update public.ai_pending_actions set status = 'succeeded' where id = v_claim.action_id and user_id = v_uid and status = 'pending';
  update public.ai_tool_calls set status = 'verified', execution_state = 'succeeded', verification_state = 'verified',
    record_ids = jsonb_build_array(new.id), verification_result = to_jsonb(new), verified_at = now(), completed_at = now()
  where pending_action_id = v_claim.action_id and user_id = v_uid;
  return new;
end; $$;

create or replace function public.ai_require_claim_for_work_finance()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_claim public.ai_action_claims%rowtype;
  v_pending boolean;
  v_uid uuid := (select auth.uid());
begin
  select exists(
    select 1 from public.ai_pending_actions p
    join public.worker_profiles wp on wp.profile_id = p.user_id
    where p.user_id = v_uid and p.tool_name = 'create_work_finance_received' and p.status = 'pending'
      and wp.id = new.worker_profile_id
      and p.arguments->>'entry_type' = new.entry_type
      and coalesce((p.arguments->>'amount')::numeric,0) = new.amount
      and coalesce(p.arguments->>'received_at_iso','') = coalesce(new.received_at::text,'')
  ) into v_pending;
  if not v_pending then return new; end if;

  select c.* into v_claim
  from public.ai_action_claims c
  join public.worker_profiles wp on wp.profile_id = c.user_id
  where c.user_id = v_uid and c.tool_name = 'create_work_finance_received'
    and c.consumed_at is null and c.failed_at is null and wp.id = new.worker_profile_id
    and c.arguments_hash = md5(jsonb_build_object(
      'worker_profile_id', new.worker_profile_id,
      'entry_type', new.entry_type,
      'amount', new.amount,
      'received_at_iso', new.received_at::text,
      '__module', 'work_finance',
      '__action_kind', 'create_received'
    )::text)
  order by c.claimed_at desc limit 1;

  if not found then raise exception using message = 'AI write requires an explicit confirmation claim.'; end if;
  update public.ai_action_claims set consumed_at = now() where action_id = v_claim.action_id and consumed_at is null;
  update public.ai_pending_actions set status = 'succeeded' where id = v_claim.action_id and user_id = v_uid and status = 'pending';
  update public.ai_tool_calls set status = 'verified', execution_state = 'succeeded', verification_state = 'verified',
    record_ids = jsonb_build_array(new.id), verification_result = to_jsonb(new), verified_at = now(), completed_at = now()
  where pending_action_id = v_claim.action_id and user_id = v_uid;
  return new;
end; $$;

create or replace function public.ai_require_claim_for_finance_transaction()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_claim public.ai_action_claims%rowtype;
  v_pending boolean;
  v_uid uuid := (select auth.uid());
begin
  select exists(
    select 1 from public.ai_pending_actions p
    where p.user_id = v_uid and p.tool_name = 'create_finance_transaction' and p.status = 'pending'
      and p.arguments->>'type' = new.type
      and coalesce((p.arguments->>'amount')::numeric,0) = new.amount
      and coalesce(p.arguments->>'account_id','') = coalesce(new.account_id::text,'')
      and coalesce(p.arguments->>'category_id','') = coalesce(new.category_id::text,'')
      and coalesce(p.arguments->>'subcategory_id','') = coalesce(new.subcategory_id::text,'')
      and coalesce(p.arguments->>'from_account_id','') = coalesce(new.from_account_id::text,'')
      and coalesce(p.arguments->>'to_account_id','') = coalesce(new.to_account_id::text,'')
      and p.arguments->>'date' = new.date::text
      and coalesce(p.arguments->>'note','') = coalesce(new.note,'')
  ) into v_pending;
  if not v_pending then return new; end if;

  select c.* into v_claim
  from public.ai_action_claims c
  where c.user_id = v_uid and c.tool_name = 'create_finance_transaction'
    and c.consumed_at is null and c.failed_at is null
    and c.arguments_hash = md5(jsonb_build_object(
      'user_id', v_uid,
      'type', new.type,
      'amount', new.amount,
      'account_id', new.account_id,
      'category_id', new.category_id,
      'from_account_id', new.from_account_id,
      'to_account_id', new.to_account_id,
      'date', new.date::text,
      'note', new.note,
      '__module', 'finance_manager',
      '__action_kind', 'create_transaction'
    )::text)
  order by c.claimed_at desc limit 1;

  if not found then raise exception using message = 'AI write requires an explicit confirmation claim.'; end if;
  update public.ai_action_claims set consumed_at = now() where action_id = v_claim.action_id and consumed_at is null;
  update public.ai_pending_actions set status = 'succeeded' where id = v_claim.action_id and user_id = v_uid and status = 'pending';
  update public.ai_tool_calls set status = 'verified', execution_state = 'succeeded', verification_state = 'verified',
    record_ids = jsonb_build_array(new.id), verification_result = to_jsonb(new), verified_at = now(), completed_at = now()
  where pending_action_id = v_claim.action_id and user_id = v_uid;
  return new;
end; $$;
