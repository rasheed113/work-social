create or replace function public.expense_manager_reports(period_start date, period_end date)
returns jsonb
language sql
security invoker
stable
set search_path = public
as $$
with params as (
  select period_start as start_date, period_end as end_date, (period_start - interval '1 month')::date as previous_start,
         (period_start - interval '1 day')::date as previous_end
),
period_summary as (
  select a.currency,
         coalesce(sum(case when t.type = 'income' then t.amount else 0 end), 0)::numeric as income,
         coalesce(sum(case when t.type = 'expense' then t.amount else 0 end), 0)::numeric as expenses,
         count(t.id)::bigint as transaction_count
  from public.expense_accounts a
  left join public.expense_transactions t on t.user_id = a.user_id and t.account_id = a.id
    and t.date between (select start_date from params) and (select end_date from params)
    and t.type in ('income','expense')
  where a.user_id = (select auth.uid())
  group by a.currency
),
category_breakdown as (
  select c.id, c.name, c.icon, c.color, a.currency,
         sum(t.amount)::numeric as amount, count(*)::bigint as transaction_count
  from public.expense_transactions t
  join public.expense_categories c on c.id = t.category_id and c.user_id = t.user_id
  join public.expense_accounts a on a.id = t.account_id and a.user_id = t.user_id
  where t.user_id = (select auth.uid()) and t.type = 'expense'
    and t.date between (select start_date from params) and (select end_date from params)
  group by c.id, c.name, c.icon, c.color, a.currency
),
daily_spending as (
  select d.day::date as date, a.currency,
         coalesce(sum(t.amount),0)::numeric as amount, count(t.id)::bigint as transaction_count
  from generate_series((select start_date from params), (select end_date from params), interval '1 day') d(day)
  cross join (select distinct currency from public.expense_accounts where user_id = (select auth.uid())) a
  left join public.expense_accounts acc on acc.user_id = (select auth.uid()) and acc.currency = a.currency
  left join public.expense_transactions t on t.user_id = (select auth.uid()) and t.account_id = acc.id
    and t.type = 'expense' and t.date = d.day::date
  group by d.day, a.currency
),
monthly_trend as (
  select m.month_start::date as month_start, a.currency,
         coalesce(sum(case when t.type = 'income' then t.amount else 0 end),0)::numeric as income,
         coalesce(sum(case when t.type = 'expense' then t.amount else 0 end),0)::numeric as expenses,
         count(t.id)::bigint as transaction_count
  from generate_series((select start_date from params) - interval '5 months', (select start_date from params), interval '1 month') m(month_start)
  cross join (select distinct currency from public.expense_accounts where user_id = (select auth.uid())) a
  left join public.expense_accounts acc on acc.user_id = (select auth.uid()) and acc.currency = a.currency
  left join public.expense_transactions t on t.user_id = (select auth.uid()) and t.account_id = acc.id
    and t.type in ('income','expense') and t.date >= m.month_start::date
    and t.date < (m.month_start + interval '1 month')::date
  group by m.month_start, a.currency
),
current_categories as (
  select c.id, c.name, c.icon, c.color, a.currency, sum(t.amount)::numeric as current_amount
  from public.expense_transactions t
  join public.expense_categories c on c.id = t.category_id and c.user_id = t.user_id
  join public.expense_accounts a on a.id = t.account_id and a.user_id = t.user_id
  where t.user_id = (select auth.uid()) and t.type = 'expense'
    and t.date between (select start_date from params) and (select end_date from params)
  group by c.id, c.name, c.icon, c.color, a.currency
),
previous_categories as (
  select c.id, a.currency, sum(t.amount)::numeric as previous_amount
  from public.expense_transactions t
  join public.expense_categories c on c.id = t.category_id and c.user_id = t.user_id
  join public.expense_accounts a on a.id = t.account_id and a.user_id = t.user_id
  where t.user_id = (select auth.uid()) and t.type = 'expense'
    and t.date between (select previous_start from params) and (select previous_end from params)
  group by c.id, a.currency
),
category_trends as (
  select coalesce(cc.id, pc.id) as id, coalesce(cc.name, c.name) as name,
         coalesce(cc.icon, c.icon) as icon, coalesce(cc.color, c.color) as color,
         coalesce(cc.currency, pc.currency) as currency,
         coalesce(cc.current_amount,0)::numeric as current_amount,
         coalesce(pc.previous_amount,0)::numeric as previous_amount
  from current_categories cc
  full join previous_categories pc on pc.id = cc.id and pc.currency = cc.currency
  left join public.expense_categories c on c.id = coalesce(cc.id, pc.id) and c.user_id = (select auth.uid())
),
account_activity as (
  select a.id, a.name, a.type, a.currency, a.icon, a.color,
         coalesce(sum(case when t.type = 'income' and t.account_id = a.id then t.amount else 0 end),0)::numeric as money_in,
         coalesce(sum(case when t.type = 'expense' and t.account_id = a.id then t.amount else 0 end),0)::numeric as money_out,
         coalesce(sum(case when t.type = 'transfer' and t.to_account_id = a.id then t.amount else 0 end),0)::numeric as transfer_in,
         coalesce(sum(case when t.type = 'transfer' and t.from_account_id = a.id then t.amount else 0 end),0)::numeric as transfer_out
  from public.expense_accounts a
  left join public.expense_transactions t on t.user_id = a.user_id
    and (t.account_id = a.id or t.from_account_id = a.id or t.to_account_id = a.id)
    and t.date between (select start_date from params) and (select end_date from params)
  where a.user_id = (select auth.uid())
  group by a.id, a.name, a.type, a.currency, a.icon, a.color
)
select jsonb_build_object(
  'period_start', (select start_date from params),
  'period_end', (select end_date from params),
  'summary', coalesce((select jsonb_agg(to_jsonb(x) order by x.currency) from period_summary x), '[]'::jsonb),
  'category_breakdown', coalesce((select jsonb_agg(to_jsonb(x) order by x.amount desc, x.name asc) from category_breakdown x), '[]'::jsonb),
  'daily_spending', coalesce((select jsonb_agg(to_jsonb(x) order by x.date, x.currency) from daily_spending x), '[]'::jsonb),
  'monthly_trend', coalesce((select jsonb_agg(to_jsonb(x) order by x.month_start, x.currency) from monthly_trend x), '[]'::jsonb),
  'category_trends', coalesce((select jsonb_agg(to_jsonb(x) order by greatest(x.current_amount, x.previous_amount) desc, x.name asc) from category_trends x), '[]'::jsonb),
  'account_activity', coalesce((select jsonb_agg(to_jsonb(x) order by x.name asc) from account_activity x), '[]'::jsonb)
);
$$;

grant execute on function public.expense_manager_reports(date, date) to authenticated;
