create or replace function public.normalize_expense_transaction_shape()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.type in ('expense','income') then
    new.from_account_id := null;
    new.to_account_id := null;
  elsif new.type = 'transfer' then
    new.account_id := null;
    new.category_id := null;
    new.subcategory_id := null;
  end if;
  return new;
end;
$$;

drop trigger if exists expense_transactions_normalize_shape on public.expense_transactions;
create trigger expense_transactions_normalize_shape
before insert or update on public.expense_transactions
for each row execute function public.normalize_expense_transaction_shape();
