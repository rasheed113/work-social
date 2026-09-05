revoke execute on function public.expense_manager_overview(date, date) from anon;

create index if not exists expense_transactions_user_from_account_date_idx
  on public.expense_transactions (user_id, from_account_id, date desc);

create index if not exists expense_transactions_user_to_account_date_idx
  on public.expense_transactions (user_id, to_account_id, date desc);
