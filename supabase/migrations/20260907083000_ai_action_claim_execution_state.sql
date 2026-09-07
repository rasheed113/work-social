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
  update public.ai_tool_calls set status='executing',confirmation_state='confirmed',confirmed_at=now(),execution_state='executing',executing_at=now() where pending_action_id=v_action.id and user_id=v_user;
  return query select v_action.id,v_action.tool_name,v_action.arguments;
exception when unique_violation then
  raise exception using message='This action has already been confirmed or is being executed.';
end; $$;
