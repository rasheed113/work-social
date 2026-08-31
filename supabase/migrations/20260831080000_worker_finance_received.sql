create table public.worker_finance_received (
  id uuid primary key default gen_random_uuid(),
  worker_profile_id uuid not null references public.worker_profiles(id) on delete restrict,
  entry_type text not null check (entry_type in ('payment', 'advance')),
  amount numeric(24,4) not null check (amount > 0),
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index worker_finance_received_worker_received_idx
  on public.worker_finance_received (worker_profile_id, received_at desc, id desc);

alter table public.worker_finance_received enable row level security;

revoke all on table public.worker_finance_received from anon, authenticated;
grant select, insert on table public.worker_finance_received to authenticated;

create policy "Workers can view own finance received"
  on public.worker_finance_received
  for select
  to authenticated
  using (
    worker_profile_id in (
      select wp.id from public.worker_profiles wp
      where wp.profile_id = (select auth.uid())
    )
  );

create policy "Workers can create own finance received"
  on public.worker_finance_received
  for insert
  to authenticated
  with check (
    worker_profile_id in (
      select wp.id from public.worker_profiles wp
      where wp.profile_id = (select auth.uid())
    )
    and entry_type in ('payment', 'advance')
    and amount > 0
  );
