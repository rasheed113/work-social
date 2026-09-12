-- Bug #3: deleted payment history must not count against the live payable balance.
-- Rebuild active payment attribution first, then lock the same rule into the record RPC.

with ordered as (
  select
    pm.id,
    pm.amount,
    py.payable_amount,
    coalesce(sum(pm.amount) over (
      partition by pm.payable_id
      order by pm.paid_at, pm.id
      rows between unbounded preceding and 1 preceding
    ), 0) as prior_active_amount
  from public.contractor_team_worker_payments pm
  join public.contractor_team_worker_payables py on py.id = pm.payable_id
  where pm.deleted_at is null
)
update public.contractor_team_worker_payments pm
set
  payable_applied_amount = least(o.amount, greatest(o.payable_amount - o.prior_active_amount, 0)),
  advance_amount = greatest(o.amount - least(o.amount, greatest(o.payable_amount - o.prior_active_amount, 0)), 0)
from ordered o
where pm.id = o.id;

create or replace function public.record_contractor_team_worker_payment(
  p_team_number bigint,
  p_payable_id uuid,
  p_amount numeric,
  p_paid_at timestamptz default now(),
  p_note text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_id bigint;
  v_worker_profile_id uuid;
  v_payable numeric(24,4);
  v_paid numeric(24,4);
  v_remaining numeric(24,4);
  v_applied numeric(24,4);
  v_advance numeric(24,4);
  v_payment_id uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;

  select py.team_id, py.worker_profile_id, py.payable_amount
    into v_team_id, v_worker_profile_id, v_payable
  from public.contractor_team_worker_payables py
  join public.contractor_teams t on t.id = py.team_id
  where py.id = p_payable_id
    and t.team_number = p_team_number
    and t.leader_profile_id = (select auth.uid())
  for update;

  if v_team_id is null then
    raise exception 'Worker payable not found or access denied';
  end if;

  -- Only live payments consume the payable. Deleted payments are audit history.
  select coalesce(sum(pm.payable_applied_amount), 0)::numeric(24,4)
    into v_paid
  from public.contractor_team_worker_payments pm
  where pm.payable_id = p_payable_id
    and pm.deleted_at is null;

  v_remaining := greatest(v_payable - v_paid, 0);
  v_applied := least(p_amount, v_remaining);
  v_advance := p_amount - v_applied;

  insert into public.contractor_team_worker_payments(
    team_id,
    worker_profile_id,
    payable_id,
    amount,
    payable_applied_amount,
    advance_amount,
    paid_at,
    note,
    created_by
  ) values (
    v_team_id,
    v_worker_profile_id,
    p_payable_id,
    p_amount,
    v_applied,
    v_advance,
    p_paid_at,
    nullif(btrim(p_note), ''),
    (select auth.uid())
  ) returning id into v_payment_id;

  return v_payment_id;
end;
$$;

revoke all on function public.record_contractor_team_worker_payment(bigint,uuid,numeric,timestamptz,text) from public, anon;
grant execute on function public.record_contractor_team_worker_payment(bigint,uuid,numeric,timestamptz,text) to authenticated;
