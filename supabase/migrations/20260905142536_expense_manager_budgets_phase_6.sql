alter table public.expense_budgets
  add constraint expense_budgets_unique_category_period unique (user_id, category_id, start_date, end_date),
  add constraint expense_budgets_monthly_period_dates check (
    start_date = date_trunc('month', start_date)::date
    and end_date = (date_trunc('month', start_date) + interval '1 month - 1 day')::date
  );

create or replace function public.expense_manager_validate_budget()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  category_type text;
  category_archived boolean;
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

  return new;
end;
$$;

create or replace function public.expense_manager_budget_progress()
returns table (
  id uuid,
  category_id uuid,
  category_name text,
  category_icon text,
  category_color text,
  category_archived boolean,
  budget_amount numeric,
  period text,
  start_date date,
  end_date date,
  spent numeric
)
language sql
security invoker
stable
set search_path = public
as $$
  select
    b.id,
    b.category_id,
    c.name as category_name,
    c.icon as category_icon,
    c.color as category_color,
    c.is_archived as category_archived,
    b.amount as budget_amount,
    b.period,
    b.start_date,
    b.end_date,
    coalesce(sum(t.amount), 0)::numeric as spent
  from public.expense_budgets b
  join public.expense_categories c
    on c.id = b.category_id
   and c.user_id = b.user_id
  left join public.expense_transactions t
    on t.user_id = b.user_id
   and t.category_id = b.category_id
   and t.type = 'expense'
   and t.date between b.start_date and b.end_date
  where b.user_id = (select auth.uid())
  group by
    b.id,
    b.category_id,
    c.name,
    c.icon,
    c.color,
    c.is_archived,
    b.amount,
    b.period,
    b.start_date,
    b.end_date
  order by b.start_date desc, c.name asc;
$$;

grant execute on function public.expense_manager_budget_progress() to authenticated;
