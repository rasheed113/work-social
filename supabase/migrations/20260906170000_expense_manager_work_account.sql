-- Keep Work Finance received cash in a dedicated Finance Manager account.
-- Work remains authoritative for the received-event lifecycle.

create or replace function private.sync_worker_finance_received_to_expense_income()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_account_id uuid;
  v_category_id uuid;
  v_note text;
  v_date date;
begin
  select wp.profile_id into v_user_id
    from public.worker_profiles wp
   where wp.id = new.worker_profile_id;

  if v_user_id is null then
    raise exception 'Cannot sync Work received amount: owner profile is unavailable';
  end if;

  if new.deleted_at is not null then
    delete from public.expense_transactions
     where source_type = 'work_finance_received'
       and source_id = new.id
       and user_id = v_user_id;
    return new;
  end if;

  select ea.id into v_account_id
    from public.expense_accounts ea
   where ea.user_id = v_user_id
     and lower(btrim(ea.name)) = 'work'
   order by ea.created_at asc, ea.id asc
   limit 1;

  if v_account_id is null then
    insert into public.expense_accounts (user_id, name, type, opening_balance, currency, icon, color)
    values (v_user_id, 'Work', 'cash', 0, 'PKR', '💼', '#2563eb')
    returning id into v_account_id;
  end if;

  select ec.id into v_category_id
    from public.expense_categories ec
   where ec.user_id = v_user_id
     and ec.type = 'income'
     and ec.name = 'Other Income'
     and ec.is_archived = false
   order by ec.created_at asc, ec.id asc
   limit 1;

  if v_category_id is null then
    insert into public.expense_categories (user_id, name, type, icon, is_default, is_archived)
    values (v_user_id, 'Other Income', 'income', '✨', true, false)
    on conflict (user_id, type, name) do update
      set is_archived = false
    returning id into v_category_id;
  end if;

  v_note := case new.entry_type
    when 'payment' then 'Work • Payment Received'
    when 'advance' then 'Work • Advance Received'
    else 'Work • Received'
  end;
  v_date := (new.received_at at time zone 'UTC')::date;

  if exists (
    select 1 from public.expense_transactions et
     where et.source_type = 'work_finance_received'
       and et.source_id = new.id
  ) then
    update public.expense_transactions
       set type = 'income',
           amount = new.amount,
           account_id = v_account_id,
           category_id = v_category_id,
           from_account_id = null,
           to_account_id = null,
           date = v_date,
           note = v_note
     where source_type = 'work_finance_received'
       and source_id = new.id
       and user_id = v_user_id;
  else
    insert into public.expense_transactions (
      user_id, type, amount, account_id, category_id,
      from_account_id, to_account_id, date, note, source_type, source_id
    )
    values (
      v_user_id, 'income', new.amount, v_account_id, v_category_id,
      null, null, v_date, v_note, 'work_finance_received', new.id
    );
  end if;

  return new;
end;
$$;

drop trigger if exists worker_finance_received_sync_expense_income
  on public.worker_finance_received;

create trigger worker_finance_received_sync_expense_income
after insert or update of entry_type, amount, received_at, deleted_at
on public.worker_finance_received
for each row
execute function private.sync_worker_finance_received_to_expense_income();

-- Create one dedicated Work account for every worker profile that does not have one.
do $$
declare
  r record;
begin
  for r in select wp.profile_id as user_id from public.worker_profiles wp loop
    if not exists (
      select 1 from public.expense_accounts ea
       where ea.user_id = r.user_id
         and lower(btrim(ea.name)) = 'work'
    ) then
      insert into public.expense_accounts (user_id, name, type, opening_balance, currency, icon, color)
      values (r.user_id, 'Work', 'cash', 0, 'PKR', '💼', '#2563eb');
    end if;
  end loop;
end;
$$;

-- Move all existing Work-sourced Finance income into the dedicated Work account.
update public.expense_transactions et
   set account_id = (
     select ea.id
       from public.expense_accounts ea
      where ea.user_id = et.user_id
        and lower(btrim(ea.name)) = 'work'
      order by ea.created_at asc, ea.id asc
      limit 1
   )
 where et.source_type = 'work_finance_received'
   and exists (
     select 1
       from public.expense_accounts ea
      where ea.user_id = et.user_id
        and lower(btrim(ea.name)) = 'work'
   );
