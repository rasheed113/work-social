alter table public.expense_categories
  add column if not exists default_key text;

create unique index if not exists expense_categories_default_key_uidx
  on public.expense_categories(user_id, type, default_key)
  where default_key is not null;

create table if not exists public.expense_subcategories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null,
  name text not null check (btrim(name) <> ''),
  icon text,
  color text,
  is_default boolean not null default false,
  is_archived boolean not null default false,
  default_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, category_id) references public.expense_categories(user_id, id)
);

create unique index if not exists expense_subcategories_user_category_name_uidx
  on public.expense_subcategories(user_id, category_id, name);
create unique index if not exists expense_subcategories_default_key_uidx
  on public.expense_subcategories(user_id, category_id, default_key)
  where default_key is not null;
create index if not exists expense_subcategories_user_category_idx
  on public.expense_subcategories(user_id, category_id, is_archived, name);

alter table public.expense_transactions
  add column if not exists subcategory_id uuid;

alter table public.expense_budgets
  add column if not exists subcategory_id uuid;

alter table public.expense_transactions
  drop constraint if exists expense_transactions_user_id_subcategory_id_fkey;
alter table public.expense_transactions
  add constraint expense_transactions_user_id_subcategory_id_fkey
  foreign key (user_id, subcategory_id)
  references public.expense_subcategories(user_id, id);

alter table public.expense_budgets
  drop constraint if exists expense_budgets_user_id_subcategory_id_fkey;
alter table public.expense_budgets
  add constraint expense_budgets_user_id_subcategory_id_fkey
  foreign key (user_id, subcategory_id)
  references public.expense_subcategories(user_id, id);

create index if not exists expense_transactions_user_subcategory_date_idx
  on public.expense_transactions(user_id, subcategory_id, date desc);
create index if not exists expense_budgets_user_subcategory_idx
  on public.expense_budgets(user_id, subcategory_id);

create trigger expense_subcategories_set_updated_at
before update on public.expense_subcategories
for each row execute function public.expense_manager_set_updated_at();

alter table public.expense_subcategories enable row level security;
revoke all on table public.expense_subcategories from anon;
grant select, insert, update, delete on table public.expense_subcategories to authenticated;
create policy "expense subcategories owner select" on public.expense_subcategories
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "expense subcategories owner insert" on public.expense_subcategories
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "expense subcategories owner update" on public.expense_subcategories
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "expense subcategories owner delete" on public.expense_subcategories
  for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function public.validate_expense_subcategory_parent()
returns trigger language plpgsql set search_path = public as $$
declare parent_type text; parent_archived boolean;
begin
  select type, is_archived into parent_type, parent_archived
  from public.expense_categories
  where id = new.category_id and user_id = new.user_id;
  if parent_type is null then
    raise exception 'Subcategory parent category does not exist' using errcode = '23503';
  end if;
  if parent_archived then
    raise exception 'Subcategory parent category is archived' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger expense_subcategories_validate_parent
before insert or update on public.expense_subcategories
for each row execute function public.validate_expense_subcategory_parent();

create or replace function public.validate_expense_transaction_subcategory()
returns trigger language plpgsql set search_path = public as $$
declare parent_category uuid; parent_type text; sub_archived boolean;
begin
  if new.subcategory_id is not null then
    select s.category_id, s.is_archived, c.type
      into parent_category, sub_archived, parent_type
      from public.expense_subcategories s
      join public.expense_categories c on c.id = s.category_id and c.user_id = s.user_id
     where s.id = new.subcategory_id and s.user_id = new.user_id;
    if parent_category is null or sub_archived then
      raise exception 'Invalid or archived transaction subcategory' using errcode = '23514';
    end if;
    if new.category_id is distinct from parent_category then
      raise exception 'Transaction subcategory does not belong to selected category' using errcode = '23514';
    end if;
    if new.type in ('expense','income') and parent_type <> new.type then
      raise exception 'Transaction subcategory type does not match transaction type' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger expense_transactions_validate_subcategory
before insert or update on public.expense_transactions
for each row execute function public.validate_expense_transaction_subcategory();

create or replace function public.validate_expense_budget_subcategory()
returns trigger language plpgsql set search_path = public as $$
declare parent_category uuid; parent_type text; sub_archived boolean;
begin
  if new.subcategory_id is not null then
    select s.category_id, s.is_archived, c.type
      into parent_category, sub_archived, parent_type
      from public.expense_subcategories s
      join public.expense_categories c on c.id = s.category_id and c.user_id = s.user_id
     where s.id = new.subcategory_id and s.user_id = new.user_id;
    if parent_category is null or sub_archived or parent_category is distinct from new.category_id or parent_type <> 'expense' then
      raise exception 'Invalid budget subcategory' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger expense_budgets_validate_subcategory
before insert or update on public.expense_budgets
for each row execute function public.validate_expense_budget_subcategory();
