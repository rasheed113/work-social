create or replace function public.get_contractor_overview_finance_intelligence()
returns table(
  receivable_payable numeric,
  receivable_received numeric,
  receivable_due numeric,
  receivable_coverage numeric,
  worker_payable numeric,
  worker_paid numeric,
  worker_applied numeric,
  worker_due numeric,
  worker_advance numeric,
  worker_coverage numeric,
  cash_in numeric,
  cash_out numeric,
  net_cash_flow numeric
)
language sql
stable
security definer
set search_path = ''
as $$
with owned_teams as (
  select t.id
  from public.contractor_teams t
  where t.leader_profile_id = (select auth.uid())
),
receivable_entries as (
  select coalesce(sum(e.total), 0)::numeric(24,4) as payable
  from public.contractor_work_entries e
  where e.profile_id = (select auth.uid())
    and (e.team_id is null or exists (select 1 from owned_teams ot where ot.id = e.team_id))
),
receivable_payments as (
  select coalesce(sum(p.amount), 0)::numeric(24,4) as received
  from public.contractor_finance_payments p
  where p.contractor_profile_id = (select auth.uid())
    and p.deleted_at is null
    and (p.team_id is null or exists (select 1 from owned_teams ot where ot.id = p.team_id))
),
worker_payables as (
  select coalesce(sum(wp.payable_amount), 0)::numeric(24,4) as payable
  from public.contractor_team_worker_payables wp
  join owned_teams ot on ot.id = wp.team_id
),
worker_payments as (
  select
    coalesce(sum(pm.amount), 0)::numeric(24,4) as paid,
    coalesce(sum(pm.payable_applied_amount), 0)::numeric(24,4) as applied,
    coalesce(sum(pm.advance_amount), 0)::numeric(24,4) as advance
  from public.contractor_team_worker_payments pm
  join owned_teams ot on ot.id = pm.team_id
  where pm.deleted_at is null
),
a as (
  select
    re.payable as receivable_payable,
    rp.received as receivable_received,
    wp.payable as worker_payable,
    wm.paid as worker_paid,
    wm.applied as worker_applied,
    wm.advance as worker_advance
  from receivable_entries re
  cross join receivable_payments rp
  cross join worker_payables wp
  cross join worker_payments wm
)
select
  receivable_payable,
  receivable_received,
  greatest(receivable_payable - receivable_received, 0)::numeric(24,4) as receivable_due,
  case when receivable_payable > 0 then least(receivable_received / receivable_payable, 1) * 100 else 0 end::numeric(8,2) as receivable_coverage,
  worker_payable,
  worker_paid,
  worker_applied,
  greatest(worker_payable - worker_applied, 0)::numeric(24,4) as worker_due,
  worker_advance,
  case when worker_payable > 0 then least(worker_applied / worker_payable, 1) * 100 else 0 end::numeric(8,2) as worker_coverage,
  receivable_received as cash_in,
  worker_paid as cash_out,
  (receivable_received - worker_paid)::numeric(24,4) as net_cash_flow
from a;
$$;

revoke all on function public.get_contractor_overview_finance_intelligence() from public;
revoke all on function public.get_contractor_overview_finance_intelligence() from anon;
grant execute on function public.get_contractor_overview_finance_intelligence() to authenticated;
