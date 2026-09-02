alter table public.worker_finance_transactions
  add column idempotency_key uuid not null default gen_random_uuid();

create unique index worker_finance_transactions_worker_idempotency_key_idx
  on public.worker_finance_transactions (worker_profile_id, idempotency_key);

drop function if exists public.create_worker_finance_transaction(text, numeric, timestamptz, text);

create or replace function public.create_worker_finance_transaction(
  p_transaction_type text,
  p_amount numeric,
  p_occurred_at timestamptz default now(),
  p_note text default null,
  p_idempotency_key uuid default gen_random_uuid()
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

  if p_idempotency_key is null then
    raise exception 'Finance idempotency key is required.' using errcode = '22023';
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
    note,
    idempotency_key
  )
  values (
    v_worker_profile_id,
    p_transaction_type,
    p_amount,
    p_occurred_at,
    nullif(btrim(p_note), ''),
    p_idempotency_key
  )
  on conflict (worker_profile_id, idempotency_key) do nothing
  returning * into v_row;

  if v_row.id is null then
    select *
      into v_row
    from public.worker_finance_transactions t
    where t.worker_profile_id = v_worker_profile_id
      and t.idempotency_key = p_idempotency_key;
  end if;

  return v_row;
end;
$$;

revoke all on function public.create_worker_finance_transaction(text, numeric, timestamptz, text, uuid) from public, anon;
grant execute on function public.create_worker_finance_transaction(text, numeric, timestamptz, text, uuid) to authenticated;
