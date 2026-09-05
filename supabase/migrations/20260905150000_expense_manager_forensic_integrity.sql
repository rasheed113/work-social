create or replace function public.expense_manager_validate_transaction()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  category_type text;
  category_archived boolean;
  source_currency text;
  destination_currency text;
begin
  if new.type in ('expense','income') then
    if new.account_id is null or new.from_account_id is not null or new.to_account_id is not null or new.category_id is null then
      raise exception 'Invalid % transaction shape', new.type using errcode = '23514';
    end if;

    select c.type, c.is_archived
      into category_type, category_archived
      from public.expense_categories c
     where c.id = new.category_id
       and c.user_id = new.user_id;

    if category_type is null or category_type <> new.type then
      raise exception 'Transaction category type does not match transaction type' using errcode = '23514';
    end if;

    if coalesce(category_archived, false) and (tg_op = 'INSERT' or old.category_id is distinct from new.category_id) then
      raise exception 'Archived categories cannot receive new transactions' using errcode = '23514';
    end if;

    select a.currency
      into source_currency
      from public.expense_accounts a
     where a.id = new.account_id
       and a.user_id = new.user_id;

    if source_currency is null then
      raise exception 'Transaction account must be a user-owned account' using errcode = '23514';
    end if;

    if new.type = 'expense' and exists (
      select 1
        from public.expense_budgets b
        join public.expense_transactions t
          on t.user_id = b.user_id
         and t.category_id = b.category_id
         and t.type = 'expense'
         and t.id <> new.id
         and t.date between b.start_date and b.end_date
        join public.expense_accounts a
          on a.id = t.account_id
         and a.user_id = t.user_id
       where b.user_id = new.user_id
         and b.category_id = new.category_id
         and new.date between b.start_date and b.end_date
         and a.currency <> source_currency
    ) then
      raise exception 'Budgeted categories cannot mix currencies without conversion' using errcode = '23514';
    end if;
  else
    if new.account_id is not null or new.category_id is not null or new.from_account_id is null or new.to_account_id is null or new.from_account_id = new.to_account_id then
      raise exception 'Invalid transfer transaction shape' using errcode = '23514';
    end if;

    select currency
      into source_currency
      from public.expense_accounts
     where id = new.from_account_id
       and user_id = new.user_id;

    select currency
      into destination_currency
      from public.expense_accounts
     where id = new.to_account_id
       and user_id = new.user_id;

    if source_currency is null or destination_currency is null then
      raise exception 'Transfer accounts must be user-owned accounts' using errcode = '23514';
    end if;

    if source_currency <> destination_currency then
      raise exception 'Transfers between different currencies require an explicit conversion flow' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.expense_manager_validate_category()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  transaction_count bigint;
begin
  if tg_op = 'UPDATE' and new.type is distinct from old.type then
    select count(*)
      into transaction_count
      from public.expense_transactions t
     where t.user_id = new.user_id
       and t.category_id = new.id;

    if transaction_count > 0 then
      raise exception 'A category used by transactions cannot change type' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists expense_categories_validate_type on public.expense_categories;
create trigger expense_categories_validate_type
before update on public.expense_categories
for each row execute function public.expense_manager_validate_category();

create or replace function public.expense_manager_validate_budget()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  category_type text;
  category_archived boolean;
  category_currency_count integer;
begin
  select c.type, c.is_archived
    into category_type, category_archived
    from public.expense_categories c
   where c.id = new.category_id
     and c.user_id = new.user_id;

  if category_type is distinct from 'expense' then
    raise exception 'Budget category must be an expense category' using errcode = '23514';
  end if;

  if coalesce(category_archived, false) then
    raise exception 'Archived categories cannot receive new budgets' using errcode = '23514';
  end if;

  select count(distinct a.currency)
    into category_currency_count
    from public.expense_transactions t
    join public.expense_accounts a
      on a.id = t.account_id
     and a.user_id = t.user_id
   where t.user_id = new.user_id
     and t.category_id = new.category_id
     and t.type = 'expense';

  if category_currency_count > 1 then
    raise exception 'A budget cannot be created for a category whose spending already mixes currencies' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke execute on function public.expense_manager_validate_transaction() from public, anon, authenticated;
revoke execute on function public.expense_manager_validate_budget() from public, anon, authenticated;
revoke execute on function public.expense_manager_validate_category() from public, anon, authenticated;
revoke execute on function public.expense_manager_set_updated_at() from public, anon, authenticated;
