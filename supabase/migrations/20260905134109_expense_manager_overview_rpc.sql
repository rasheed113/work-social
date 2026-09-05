create or replace function public.expense_manager_validate_budget()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  category_type text;
begin
  select c.type into category_type from public.expense_categories c where c.id = new.category_id and c.user_id = new.user_id;
  if category_type is distinct from 'expense' then
    raise exception 'Budget category must be an expense category' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger expense_budgets_validate before insert or update on public.expense_budgets for each row execute function public.expense_manager_validate_budget();

create or replace function public.expense_manager_overview(period_start date, period_end date)
returns jsonb
language sql
security invoker
stable
set search_path = public
as $$
with account_balances as (
  select a.id, a.name, a.type, a.currency, a.icon, a.color,
    a.opening_balance
      + coalesce(sum(case when t.type = 'income' then t.amount when t.type = 'expense' then -t.amount else 0 end), 0)
      + coalesce(sum(case when t.type = 'transfer' and t.to_account_id = a.id then t.amount when t.type = 'transfer' and t.from_account_id = a.id then -t.amount else 0 end), 0) as balance
  from public.expense_accounts a
  left join public.expense_transactions t on t.user_id = a.user_id and (t.account_id = a.id or t.from_account_id = a.id or t.to_account_id = a.id)
  where a.user_id = (select auth.uid())
  group by a.id, a.name, a.type, a.currency, a.icon, a.color, a.opening_balance
),
period_totals as (
  select coalesce(sum(case when type = 'income' then amount else 0 end), 0) as income,
    coalesce(sum(case when type = 'expense' then amount else 0 end), 0) as expenses,
    count(*) as transaction_count
  from public.expense_transactions
  where user_id = (select auth.uid()) and date between period_start and period_end
),
category_totals as (
  select c.id, c.name, c.icon, c.color, sum(t.amount) as amount, count(*) as transaction_count
  from public.expense_transactions t
  join public.expense_categories c on c.id = t.category_id and c.user_id = t.user_id
  where t.user_id = (select auth.uid()) and t.type = 'expense' and t.date between period_start and period_end
  group by c.id, c.name, c.icon, c.color
  order by amount desc, c.name asc
  limit 6
),
recent_transactions as (
  select t.id, t.type, t.amount, t.date, t.note, c.name as category_name, c.icon as category_icon,
    case when t.type = 'transfer' then coalesce(fa.name, 'Account') || ' → ' || coalesce(ta.name, 'Account') else a.name end as display_account
  from public.expense_transactions t
  left join public.expense_categories c on c.id = t.category_id and c.user_id = t.user_id
  left join public.expense_accounts a on a.id = t.account_id and a.user_id = t.user_id
  left join public.expense_accounts fa on fa.id = t.from_account_id and fa.user_id = t.user_id
  left join public.expense_accounts ta on ta.id = t.to_account_id and ta.user_id = t.user_id
  where t.user_id = (select auth.uid()) and t.date between period_start and period_end
  order by t.date desc, t.created_at desc
  limit 8
),
budget_progress as (
  select b.id, b.category_id, c.name as category_name, b.amount as budget_amount, b.start_date, b.end_date, coalesce(sum(t.amount), 0) as spent
  from public.expense_budgets b
  join public.expense_categories c on c.id = b.category_id and c.user_id = b.user_id
  left join public.expense_transactions t on t.user_id = b.user_id and t.category_id = b.category_id and t.type = 'expense' and t.date between b.start_date and b.end_date
  where b.user_id = (select auth.uid()) and b.start_date <= period_end and b.end_date >= period_start
  group by b.id, b.category_id, c.name, b.amount, b.start_date, b.end_date
  order by b.end_date asc, c.name asc
  limit 6
),
currency_totals as (select currency, round(sum(balance), 2) as balance from account_balances group by currency),
account_json as (select coalesce(jsonb_agg(to_jsonb(x) order by x.balance desc), '[]'::jsonb) as value from (select * from account_balances order by balance desc limit 6) x),
category_json as (select coalesce(jsonb_agg(to_jsonb(x) order by x.amount desc), '[]'::jsonb) as value from category_totals x),
transaction_json as (select coalesce(jsonb_agg(to_jsonb(x) order by x.date desc), '[]'::jsonb) as value from recent_transactions x),
budget_json as (select coalesce(jsonb_agg(to_jsonb(x) order by x.end_date asc), '[]'::jsonb) as value from budget_progress x),
currency_json as (select coalesce(jsonb_agg(to_jsonb(x) order by x.currency), '[]'::jsonb) as value from currency_totals x)
select jsonb_build_object(
  'period_start', period_start,
  'period_end', period_end,
  'income', (select income from period_totals),
  'expenses', (select expenses from period_totals),
  'transaction_count', (select transaction_count from period_totals),
  'net', (select income - expenses from period_totals),
  'account_count', (select count(*) from account_balances),
  'currencies', (select value from currency_json),
  'accounts', (select value from account_json),
  'top_categories', (select value from category_json),
  'recent_transactions', (select value from transaction_json),
  'budgets', (select value from budget_json),
  'has_financial_records', ((select count(*) from account_balances) > 0 or (select transaction_count from period_totals) > 0)
);
$$;

grant execute on function public.expense_manager_overview(date, date) to authenticated;
