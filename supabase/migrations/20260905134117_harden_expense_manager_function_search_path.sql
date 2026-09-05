alter function public.expense_manager_set_updated_at() set search_path = public;
alter function public.expense_manager_validate_transaction() set search_path = public;
alter function public.expense_manager_validate_budget() set search_path = public;
alter function public.expense_manager_overview(date, date) set search_path = public;
