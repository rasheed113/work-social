-- Hands 2.0 Work Entry execution support.
-- This migration is additive and fixes the concrete Phase 3 history gap:
-- authoritative before/after state is recorded by the server executor, while
-- the existing trigger remains a compatibility fallback for other modules.

create or replace function public.record_ai_action_history(p_history jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_action uuid := nullif(p_history->>'action_id','')::uuid;
  v_history_user uuid := nullif(p_history->>'user_id','')::uuid;
begin
  if v_user is null then
    raise exception using message='Authentication is required.';
  end if;
  if v_history_user is null or v_history_user <> v_user then
    raise exception using message='Action history user does not match the authenticated user.';
  end if;
  if v_action is null then
    raise exception using message='Action history action_id is required.';
  end if;
  if coalesce(p_history->>'verification_state','') <> 'verified' then
    raise exception using message='Only verified action history may be recorded.';
  end if;
  if coalesce(p_history->>'status','') <> 'succeeded' then
    raise exception using message='Only succeeded action history may be recorded.';
  end if;

  insert into public.ai_action_history (
    action_id,
    user_id,
    action_type,
    module,
    operation,
    status,
    affected_record_ids,
    previous_state,
    new_state,
    verification_state,
    verification_result,
    executed_at,
    reversible
  ) values (
    v_action,
    v_user,
    coalesce(p_history->>'action_type',''),
    coalesce(p_history->>'module',''),
    coalesce(p_history->>'operation',''),
    'succeeded',
    coalesce(p_history->'affected_record_ids','[]'::jsonb),
    p_history->'previous_state',
    p_history->'new_state',
    'verified',
    p_history->'verification_result',
    coalesce(nullif(p_history->>'executed_at','')::timestamptz, now()),
    coalesce((p_history->>'reversible')::boolean, false)
  )
  on conflict (action_id) do nothing;
end;
$$;

revoke all on function public.record_ai_action_history(jsonb) from public, anon;
grant execute on function public.record_ai_action_history(jsonb) to authenticated;

create or replace function public.mark_ai_action_reverted(p_action_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_updated integer;
begin
  if v_user is null then
    raise exception using message='Authentication is required.';
  end if;

  update public.ai_action_history
  set reverted_at = now()
  where action_id = p_action_id
    and user_id = v_user
    and reversible = true
    and reverted_at is null
    and status = 'succeeded';

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke all on function public.mark_ai_action_reverted(uuid) from public, anon;
grant execute on function public.mark_ai_action_reverted(uuid) to authenticated;

-- The executor writes the authoritative success row before marking the tool call
-- verified. Preserve that complete row instead of allowing the legacy fallback
-- trigger to overwrite previous/new state with incomplete values.
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
     and exists (
       select 1
       from public.ai_pending_actions p
       where p.id = new.pending_action_id
         and p.user_id = new.user_id
         and p.status = 'succeeded'
     ) then
    insert into public.ai_action_history (
      action_id,user_id,action_type,module,operation,status,affected_record_ids,
      previous_state,new_state,verification_state,verification_result,executed_at,reversible
    ) values (
      new.pending_action_id,new.user_id,v_action_type,v_module,v_operation,'succeeded',
      coalesce(new.record_ids,'[]'::jsonb),null,new.verification_result,'verified',
      new.verification_result,coalesce(new.verified_at,new.completed_at,now()),false
    )
    on conflict (action_id) do nothing;
  elsif new.execution_state = 'failed' then
    insert into public.ai_action_history (
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
