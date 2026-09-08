-- Contractor Account setup foundation only.
-- This extends the existing authenticated Social identity without creating a second user identity.
create table if not exists public.contractor_accounts (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  is_commission_based boolean not null,
  work_types text[] not null default '{}'::text[],
  works_with text[] not null default '{}'::text[],
  business_name text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contractor_accounts_work_types_allowed check (
    work_types <@ array['Manufacturing / Production','Stitching / Garments','Packaging','Construction','Services','Other']::text[]
    and cardinality(work_types) > 0
  ),
  constraint contractor_accounts_works_with_allowed check (
    works_with <@ array['Workers','Teams']::text[]
    and cardinality(works_with) > 0
  ),
  constraint contractor_accounts_business_name_length check (
    business_name is null or char_length(btrim(business_name)) between 1 and 160
  )
);

create or replace function public.touch_contractor_account_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.touch_contractor_account_updated_at() from public, anon, authenticated;

drop trigger if exists trg_contractor_accounts_updated_at on public.contractor_accounts;
create trigger trg_contractor_accounts_updated_at
before update on public.contractor_accounts
for each row execute function public.touch_contractor_account_updated_at();

alter table public.contractor_accounts enable row level security;
grant select, insert, update on public.contractor_accounts to authenticated;

drop policy if exists contractor_accounts_select_own on public.contractor_accounts;
create policy contractor_accounts_select_own
on public.contractor_accounts
for select
to authenticated
using ((select auth.uid()) = profile_id);

drop policy if exists contractor_accounts_insert_own on public.contractor_accounts;
create policy contractor_accounts_insert_own
on public.contractor_accounts
for insert
to authenticated
with check ((select auth.uid()) = profile_id);

drop policy if exists contractor_accounts_update_own on public.contractor_accounts;
create policy contractor_accounts_update_own
on public.contractor_accounts
for update
to authenticated
using ((select auth.uid()) = profile_id)
with check ((select auth.uid()) = profile_id);
