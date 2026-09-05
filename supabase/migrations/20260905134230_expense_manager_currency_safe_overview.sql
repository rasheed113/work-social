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
period_currency_totals as (
  select a.currency,
    coalesce(sum(case when t.type = 'income' then t.amount else 0 end), 0) as income,
    coalesce(sum(case when t.type = 'expense' then t.amount else 0 end), 0) as expenses,
    count(t.id) as transaction_count
  from public.expense_accounts a
  left join public.expense_transactions t on t.user_id = a.user_id and t.account_id = a.id and t.date between period_start and period_end
  where a.user_id = (select auth.uid())
  group by a.currency
),
category_totals as (
  select c.id, c.name, c.icon, c.color, a.currency, sum(t.amount) as amount, count(*) as transaction_count
  from public.expense_transactions t
  join public.expense_categories c on c.id = t.category_id and c.user_id = t.user_id
  join public.expense_accounts a on a.id = t.account_id and a.user_id = t.user_id
  where t.user_id = (select auth.uid()) and t.type = 'expense' and t.date between period_start and period_end
  group by c.id, c.name, c.icon, c.color, a.currency
  order by amount desc, c.name asc
  limit 8
),
recent_transactions as (
  select t.id, t.type, t.amount, t.date, t.note, c.name as category_name, c.icon as category_icon, a.currency,
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
account_json as (select coalesce(jsonb_agg(to_jsonb(x) order by x.balance desc), '[]'::jsonb) as value from (select * from account_balances order by balance desc limit 6) x),
period_currency_json as (select coalesce(jsonb_agg(to_jsonb(x) order by x.currency), '[]'::jsonb) as value from period_currency_totals x),
category_json as (select coalesce(jsonb_agg(to_jsonb(x) order by x.amount desc), '[]'::jsonb) as value from category_totals x),
transaction_json as (select coalesce(jsonb_agg(to_jsonb(x) order by x.date desc), '[]'::jsonb) as value from recent_transactions x),
budget_json as (select coalesce(jsonb_agg(to_jsonb(x) order by x.end_date asc), '[]'::jsonb) as value from budget_progress x),
currency_totals as (select currency, round(sum(balance), 2) as balance from account_balances group by currency),
currency_json as (select coalesce(jsonb_agg(to_jsonb(x) order by x.currency), '[]'::jsonb) as value from currency_totals x),
period_summary as (select coalesce(sum(income),0) as income, coalesce(sum(expenses),0) as expenses, coalesce(sum(transaction_count),0) as transaction_count from period_currency_totals)
select jsonb_build_object(
  'period_start', period_start,
  'period_end', period_end,
  'income', (select income from period_summary),
  'expenses', (select expenses from period_summary),
  'transaction_count', (select transaction_count from period_summary),
  'net', (select income - expenses from period_summary),
  'account_count', (select count(*) from account_balances),
  'currencies', (select value from currency_json),
  'period_currencies', (select value from period_currency_json),
  'accounts', (select value from account_json),
  'top_categories', (select value from category_json),
  'recent_transactions', (select value from transaction_json),
  'budgets', (select value from budget_json),
  'has_financial_records', ((select count(*) from account_balances) > 0 or (select transaction_count from period_summary) > 0)
);
$$;

grant execute on function public.expense_manager_overview(date, date) to authenticated;
