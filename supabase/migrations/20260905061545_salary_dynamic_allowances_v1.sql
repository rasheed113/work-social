create table if not exists public.salary_allowances (
  id uuid primary key default gen_random_uuid(),
  worker_profile_id uuid not null references public.worker_profiles(id) on delete cascade,
  allowance_type text not null,
  amount numeric(12,2) not null check (amount >= 0),
  frequency text not null default 'monthly' check (frequency in ('monthly','other')),
  eligibility_rule text not null default 'always' check (eligibility_rule in ('always','present_only','after_absences','after_unpaid_leaves','custom')),
  loss_after_count integer null check (loss_after_count is null or loss_after_count > 0),
  rule_note text null,
  effective_from date not null default current_date,
  effective_to date null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint salary_allowances_dates_check check (effective_to is null or effective_to >= effective_from),
  constraint salary_allowances_rule_count_check check (
    (eligibility_rule in ('after_absences','after_unpaid_leaves') and loss_after_count is not null)
    or (eligibility_rule not in ('after_absences','after_unpaid_leaves'))
  )
);

create index if not exists idx_salary_allowances_worker_effective
  on public.salary_allowances(worker_profile_id, effective_from desc);

alter table public.salary_allowances enable row level security;

drop policy if exists "Workers can view own salary allowances" on public.salary_allowances;
drop policy if exists "Workers can create own salary allowances" on public.salary_allowances;
drop policy if exists "Workers can update own salary allowances" on public.salary_allowances;
drop policy if exists "Workers can delete own salary allowances" on public.salary_allowances;

create policy "Workers can view own salary allowances"
  on public.salary_allowances for select to authenticated
  using (worker_profile_id = public.current_worker_profile_id());

create policy "Workers can create own salary allowances"
  on public.salary_allowances for insert to authenticated
  with check (worker_profile_id = public.current_worker_profile_id());

create policy "Workers can update own salary allowances"
  on public.salary_allowances for update to authenticated
  using (worker_profile_id = public.current_worker_profile_id())
  with check (worker_profile_id = public.current_worker_profile_id());

create policy "Workers can delete own salary allowances"
  on public.salary_allowances for delete to authenticated
  using (worker_profile_id = public.current_worker_profile_id());

grant select, insert, update, delete on public.salary_allowances to authenticated;

create or replace function public.set_salary_allowances_updated_at()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists salary_allowances_set_updated_at on public.salary_allowances;
create trigger salary_allowances_set_updated_at
before update on public.salary_allowances
for each row execute function public.set_salary_allowances_updated_at();
