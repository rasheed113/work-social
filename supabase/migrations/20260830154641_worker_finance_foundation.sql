create table public.worker_finance_transactions (
  id uuid primary key default gen_random_uuid(),
  worker_profile_id uuid not null references public.worker_profiles(id) on delete restrict,
  transaction_type text not null check (transaction_type in ('PAYMENT', 'ADVANCE')),
  amount numeric(24,4) not null check (amount > 0),
  occurred_at timestamptz not null default now(),
  note text null check (note is null or char_length(note) <= 2000),
  created_at timestamptz not null default now()
);

create index worker_finance_transactions_worker_occurred_idx
  on public.worker_finance_transactions (worker_profile_id, occurred_at desc, id desc);

alter table public.worker_finance_transactions enable row level security;

revoke all on table public.worker_finance_transactions from anon, authenticated;
grant select on table public.worker_finance_transactions to authenticated;

create policy "Workers can view own finance transactions"
  on public.worker_finance_transactions
  for select
  to authenticated
  using (
    worker_profile_id in (
      select wp.id
      from public.worker_profiles wp
      where wp.profile_id = (select auth.uid())
    )
  );

create or replace function public.create_worker_finance_transaction(
  p_transaction_type text,
  p_amount numeric,
  p_occurred_at timestamptz default now(),
  p_note text default null
)
returns public.worker_finance_transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_worker_profile_id uuid;
  v_row public.worker_finance_transactions;
begin
  if p_transaction_type not in ('PAYMENT', 'ADVANCE') then
    raise exception 'Invalid finance transaction type.' using errcode = '22023';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Finance amount must be greater than zero.' using errcode = '22023';
  end if;

  if p_note is not null and char_length(p_note) > 2000 then
    raise exception 'Finance note is too long.' using errcode = '22023';
  end if;

  if p_occurred_at > now() then
    raise exception 'Finance transaction time cannot be in the future.' using errcode = '22023';
  end if;

  select wp.id
    into v_worker_profile_id
  from public.worker_profiles wp
  where wp.profile_id = (select auth.uid());

  if v_worker_profile_id is null then
    raise exception 'Authenticated Worker profile is required.' using errcode = '42501';
  end if;

  insert into public.worker_finance_transactions (
    worker_profile_id,
    transaction_type,
    amount,
    occurred_at,
    note
  )
  values (
    v_worker_profile_id,
    p_transaction_type,
    p_amount,
    p_occurred_at,
    nullif(btrim(p_note), '')
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.create_worker_finance_transaction(text, numeric, timestamptz, text) from public, anon;
grant execute on function public.create_worker_finance_transaction(text, numeric, timestamptz, text) to authenticated;

create or replace function public.get_worker_finance_summary()
returns table (
  earnings numeric,
  payments numeric,
  advances numeric,
  current_balance numeric
)
language sql
security invoker
stable
set search_path = ''
as $$
  with earnings as (
    select coalesce(sum(e.total), 0)::numeric(24,4) as total
    from public.work_entries e
    where e.lifecycle_state = 'active'
      and e.worker_profile_id in (
        select wp.id
        from public.worker_profiles wp
        where wp.profile_id = (select auth.uid())
      )
      and not exists (
        select 1
        from public.work_entry_hidden_for hidden
        where hidden.work_entry_id = e.id
          and hidden.profile_id = (select auth.uid())
      )
  ),
  finance as (
    select
      coalesce(sum(t.amount) filter (where t.transaction_type = 'PAYMENT'), 0)::numeric(24,4) as payments,
      coalesce(sum(t.amount) filter (where t.transaction_type = 'ADVANCE'), 0)::numeric(24,4) as advances
    from public.worker_finance_transactions t
  )
  select
    e.total,
    f.payments,
    f.advances,
    (e.total - f.payments - f.advances)::numeric(24,4)
  from earnings e
  cross join finance f;
$$;

revoke all on function public.get_worker_finance_summary() from public, anon;
grant execute on function public.get_worker_finance_summary() to authenticated;

create or replace function public.get_worker_finance_history(
  p_cursor_occurred_at timestamptz default null,
  p_cursor_id uuid default null,
  p_cursor_kind text default null,
  p_limit integer default 5
)
returns table (
  id uuid,
  source_kind text,
  transaction_type text,
  occurred_at timestamptz,
  amount numeric,
  item_name text,
  size text[],
  quantity numeric,
  rate numeric,
  note text,
  has_more boolean
)
language sql
security invoker
stable
set search_path = ''
as $$
  with all_rows as (
    select
      e.id,
      'WORK_ENTRY'::text as source_kind,
      null::text as transaction_type,
      e.occurred_at,
      e.total::numeric(24,4) as amount,
      e.item_name,
      e.size,
      e.quantity,
      e.rate,
      e.special_note as note
    from public.work_entries e
    where e.lifecycle_state = 'active'
      and e.worker_profile_id in (
        select wp.id
        from public.worker_profiles wp
        where wp.profile_id = (select auth.uid())
      )
      and not exists (
        select 1
        from public.work_entry_hidden_for hidden
        where hidden.work_entry_id = e.id
          and hidden.profile_id = (select auth.uid())
      )

    union all

    select
      t.id,
      'FINANCE'::text as source_kind,
      t.transaction_type,
      t.occurred_at,
      (-t.amount)::numeric(24,4) as amount,
      null::text,
      null::text[],
      null::numeric,
      null::numeric,
      t.note
    from public.worker_finance_transactions t
  ),
  filtered as (
    select *
    from all_rows r
    where p_cursor_occurred_at is null
       or r.occurred_at < p_cursor_occurred_at
       or (
         r.occurred_at = p_cursor_occurred_at
         and (
           r.id < p_cursor_id
           or (r.id = p_cursor_id and r.source_kind < coalesce(p_cursor_kind, 'ZZZZZZ'))
         )
       )
  ),
  paged as (
    select *
    from filtered
    order by occurred_at desc, id desc, source_kind desc
    limit greatest(1, least(coalesce(p_limit, 5), 10)) + 1
  ),
  marked as (
    select
      p.*,
      count(*) over () > greatest(1, least(coalesce(p_limit, 5), 10)) as more
    from paged p
  )
  select
    id,
    source_kind,
    transaction_type,
    occurred_at,
    amount,
    item_name,
    size,
    quantity,
    rate,
    note,
    more as has_more
  from marked
  order by occurred_at desc, id desc, source_kind desc
  limit greatest(1, least(coalesce(p_limit, 5), 10));
$$;

revoke all on function public.get_worker_finance_history(timestamptz, uuid, text, integer) from public, anon;
grant execute on function public.get_worker_finance_history(timestamptz, uuid, text, integer) to authenticated;
