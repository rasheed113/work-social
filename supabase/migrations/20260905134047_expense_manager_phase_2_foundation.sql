create table public.expense_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  type text not null default 'cash' check (type in ('cash','bank','wallet','savings','credit_card','other')),
  opening_balance numeric(14,2) not null default 0,
  currency text not null default 'PKR' check (currency ~ '^[A-Z]{3}$'),
  icon text,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id)
);

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  type text not null check (type in ('expense','income')),
  icon text,
  color text,
  is_default boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  unique (user_id, type, name)
);

create table public.expense_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('expense','income','transfer')),
  amount numeric(14,2) not null check (amount > 0),
  account_id uuid,
  category_id uuid,
  from_account_id uuid,
  to_account_id uuid,
  date date not null default current_date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, account_id) references public.expense_accounts(user_id, id),
  foreign key (user_id, category_id) references public.expense_categories(user_id, id),
  foreign key (user_id, from_account_id) references public.expense_accounts(user_id, id),
  foreign key (user_id, to_account_id) references public.expense_accounts(user_id, id)
);

create table public.expense_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null,
  amount numeric(14,2) not null check (amount > 0),
  period text not null default 'monthly' check (period = 'monthly'),
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, category_id) references public.expense_categories(user_id, id),
  check (end_date >= start_date)
);

create index expense_accounts_user_id_idx on public.expense_accounts(user_id);
create index expense_categories_user_id_idx on public.expense_categories(user_id);
create index expense_transactions_user_date_idx on public.expense_transactions(user_id, date desc);
create index expense_transactions_user_type_date_idx on public.expense_transactions(user_id, type, date desc);
create index expense_transactions_user_category_date_idx on public.expense_transactions(user_id, category_id, date desc);
create index expense_transactions_user_account_date_idx on public.expense_transactions(user_id, account_id, date desc);
create index expense_budgets_user_period_idx on public.expense_budgets(user_id, start_date, end_date);

create or replace function public.expense_manager_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger expense_accounts_set_updated_at before update on public.expense_accounts for each row execute function public.expense_manager_set_updated_at();
create trigger expense_categories_set_updated_at before update on public.expense_categories for each row execute function public.expense_manager_set_updated_at();
create trigger expense_transactions_set_updated_at before update on public.expense_transactions for each row execute function public.expense_manager_set_updated_at();
create trigger expense_budgets_set_updated_at before update on public.expense_budgets for each row execute function public.expense_manager_set_updated_at();

create or replace function public.expense_manager_validate_transaction()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  category_type text;
begin
  if new.type in ('expense','income') then
    if new.account_id is null or new.from_account_id is not null or new.to_account_id is not null or new.category_id is null then
      raise exception 'Invalid % transaction shape', new.type using errcode = '23514';
    end if;
    select c.type into category_type from public.expense_categories c where c.id = new.category_id and c.user_id = new.user_id;
    if category_type is null or category_type <> new.type then
      raise exception 'Transaction category type does not match transaction type' using errcode = '23514';
    end if;
  else
    if new.account_id is not null or new.category_id is not null or new.from_account_id is null or new.to_account_id is null or new.from_account_id = new.to_account_id then
      raise exception 'Invalid transfer transaction shape' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger expense_transactions_validate before insert or update on public.expense_transactions for each row execute function public.expense_manager_validate_transaction();

alter table public.expense_accounts enable row level security;
alter table public.expense_categories enable row level security;
alter table public.expense_transactions enable row level security;
alter table public.expense_budgets enable row level security;

revoke all on table public.expense_accounts from anon;
revoke all on table public.expense_categories from anon;
revoke all on table public.expense_transactions from anon;
revoke all on table public.expense_budgets from anon;

grant select, insert, update, delete on table public.expense_accounts to authenticated;
grant select, insert, update, delete on table public.expense_categories to authenticated;
grant select, insert, update, delete on table public.expense_transactions to authenticated;
grant select, insert, update, delete on table public.expense_budgets to authenticated;

create policy "expense accounts owner select" on public.expense_accounts for select to authenticated using ((select auth.uid()) = user_id);
create policy "expense accounts owner insert" on public.expense_accounts for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "expense accounts owner update" on public.expense_accounts for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "expense accounts owner delete" on public.expense_accounts for delete to authenticated using ((select auth.uid()) = user_id);

create policy "expense categories owner select" on public.expense_categories for select to authenticated using ((select auth.uid()) = user_id);
create policy "expense categories owner insert" on public.expense_categories for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "expense categories owner update" on public.expense_categories for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "expense categories owner delete" on public.expense_categories for delete to authenticated using ((select auth.uid()) = user_id);

create policy "expense transactions owner select" on public.expense_transactions for select to authenticated using ((select auth.uid()) = user_id);
create policy "expense transactions owner insert" on public.expense_transactions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "expense transactions owner update" on public.expense_transactions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "expense transactions owner delete" on public.expense_transactions for delete to authenticated using ((select auth.uid()) = user_id);

create policy "expense budgets owner select" on public.expense_budgets for select to authenticated using ((select auth.uid()) = user_id);
create policy "expense budgets owner insert" on public.expense_budgets for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "expense budgets owner update" on public.expense_budgets for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "expense budgets owner delete" on public.expense_budgets for delete to authenticated using ((select auth.uid()) = user_id);
