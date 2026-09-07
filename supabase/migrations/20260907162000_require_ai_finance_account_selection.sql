create or replace function public.require_ai_finance_account_selection()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  selected_account_name text;
  user_message text;
begin
  if new.tool_name = 'create_finance_transaction'
     and coalesce(new.arguments->>'type','') in ('expense','income')
     and nullif(trim(new.arguments->>'account_id'),'') is not null then
    select ea.name
      into selected_account_name
    from public.expense_accounts ea
    where ea.id = (new.arguments->>'account_id')::uuid
      and ea.user_id = new.user_id;

    if selected_account_name is null then
      raise exception using message = 'The selected Finance Manager account does not exist.';
    end if;

    select am.content
      into user_message
    from public.ai_messages am
    where am.conversation_id = new.conversation_id
      and am.user_id = new.user_id
      and am.role = 'user'
    order by am.created_at desc
    limit 1;

    if user_message is null
       or position(lower(selected_account_name) in lower(user_message)) = 0 then
      raise exception using
        message = 'Finance account selection is required. Ask the user which account was used before preparing the transaction.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists ai_pending_actions_require_finance_account on public.ai_pending_actions;
create trigger ai_pending_actions_require_finance_account
before insert or update on public.ai_pending_actions
for each row execute function public.require_ai_finance_account_selection();
