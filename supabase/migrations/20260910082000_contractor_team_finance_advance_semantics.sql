-- Final locked contractor team finance semantics.
-- Existing payment rows remain intact. Applied/advance portions are derived from the
-- existing payable attribution and payment order; no second ledger is introduced.

with ordered as (
  select
    pm.id,
    pm.amount,
    py.payable_amount,
    coalesce(sum(pm.amount) over (
      partition by pm.payable_id
      order by pm.paid_at, pm.id
      rows between unbounded preceding and 1 preceding
    ),0) as prior_amount
  from public.contractor_team_worker_payments pm
  join public.contractor_team_worker_payables py on py.id=pm.payable_id
)
update public.contractor_team_worker_payments pm
set
  payable_applied_amount=least(o.amount,greatest(o.payable_amount-o.prior_amount,0)),
  advance_amount=greatest(o.amount-least(o.amount,greatest(o.payable_amount-o.prior_amount,0)),0)
from ordered o
where pm.id=o.id;

drop function if exists public.get_contractor_team_finance_summary(bigint,timestamptz,timestamptz);
create function public.get_contractor_team_finance_summary(p_team_number bigint,p_start timestamptz,p_end timestamptz)
returns table(payable numeric(24,4),paid numeric(24,4),advance_paid numeric(24,4),total_paid numeric(24,4),due numeric(24,4),paid_percent numeric(8,2))
language sql security definer stable set search_path=''
as $$
with scope as(select t.id team_id from public.contractor_teams t where t.team_number=p_team_number and t.leader_profile_id=(select auth.uid()) limit 1),
p as(select coalesce(sum(wp.payable_amount),0)::numeric(24,4) payable from public.contractor_team_worker_payables wp join scope s on s.team_id=wp.team_id where wp.created_at>=p_start and wp.created_at<p_end),
m as(select coalesce(sum(pm.payable_applied_amount),0)::numeric(24,4) paid,coalesce(sum(pm.advance_amount),0)::numeric(24,4) advance_paid,coalesce(sum(pm.amount),0)::numeric(24,4) total_paid from public.contractor_team_worker_payments pm join scope s on s.team_id=pm.team_id where pm.paid_at>=p_start and pm.paid_at<p_end)
select p.payable,m.paid,m.advance_paid,m.total_paid,greatest(p.payable-m.paid,0)::numeric(24,4),case when p.payable=0 then 0::numeric else round((least(m.paid,p.payable)/p.payable)*100,2) end from p,m;
$$;

drop function if exists public.get_contractor_team_finance_workers(bigint,timestamptz,timestamptz);
create function public.get_contractor_team_finance_workers(p_team_number bigint,p_start timestamptz,p_end timestamptz)
returns table(worker_profile_id uuid,work_id uuid,display_name text,username text,avatar_url text,payable numeric(24,4),paid numeric(24,4),advance_paid numeric(24,4),total_paid numeric(24,4),due numeric(24,4),paid_percent numeric(8,2))
language sql security definer stable set search_path=''
as $$
select wp.id,wp.work_id,pr.display_name,pr.username,pr.avatar_url,
coalesce((select sum(py.payable_amount) from public.contractor_team_worker_payables py where py.team_id=t.id and py.worker_profile_id=wp.id and py.created_at>=p_start and py.created_at<p_end),0)::numeric(24,4),
coalesce((select sum(pm.payable_applied_amount) from public.contractor_team_worker_payments pm where pm.team_id=t.id and pm.worker_profile_id=wp.id and pm.paid_at>=p_start and pm.paid_at<p_end),0)::numeric(24,4),
coalesce((select sum(pm.advance_amount) from public.contractor_team_worker_payments pm where pm.team_id=t.id and pm.worker_profile_id=wp.id and pm.paid_at>=p_start and pm.paid_at<p_end),0)::numeric(24,4),
coalesce((select sum(pm.amount) from public.contractor_team_worker_payments pm where pm.team_id=t.id and pm.worker_profile_id=wp.id and pm.paid_at>=p_start and pm.paid_at<p_end),0)::numeric(24,4),
greatest(coalesce((select sum(py.payable_amount) from public.contractor_team_worker_payables py where py.team_id=t.id and py.worker_profile_id=wp.id and py.created_at>=p_start and py.created_at<p_end),0)-coalesce((select sum(pm.payable_applied_amount) from public.contractor_team_worker_payments pm where pm.team_id=t.id and pm.worker_profile_id=wp.id and pm.paid_at>=p_start and pm.paid_at<p_end),0),0)::numeric(24,4),
case when coalesce((select sum(py.payable_amount) from public.contractor_team_worker_payables py where py.team_id=t.id and py.worker_profile_id=wp.id and py.created_at>=p_start and py.created_at<p_end),0)=0 then 0::numeric else round((least(coalesce((select sum(pm.payable_applied_amount) from public.contractor_team_worker_payments pm where pm.team_id=t.id and pm.worker_profile_id=wp.id and pm.paid_at>=p_start and pm.paid_at<p_end),0),coalesce((select sum(py.payable_amount) from public.contractor_team_worker_payables py where py.team_id=t.id and py.worker_profile_id=wp.id and py.created_at>=p_start and py.created_at<p_end),0))/nullif(coalesce((select sum(py.payable_amount) from public.contractor_team_worker_payables py where py.team_id=t.id and py.worker_profile_id=wp.id and py.created_at>=p_start and py.created_at<p_end),0),0))*100,2) end
from public.contractor_team_members m join public.contractor_teams t on t.id=m.team_id and t.team_number=p_team_number and t.leader_profile_id=(select auth.uid()) join public.worker_profiles wp on wp.profile_id=m.profile_id left join public.profiles pr on pr.id=wp.profile_id
group by wp.id,wp.work_id,pr.display_name,pr.username,pr.avatar_url,m.joined_at,t.id order by coalesce(pr.display_name,pr.username,''),m.joined_at;
$$;

drop function if exists public.get_contractor_team_worker_finance(bigint,uuid,timestamptz,timestamptz);
create function public.get_contractor_team_worker_finance(p_team_number bigint,p_worker_profile_id uuid,p_start timestamptz,p_end timestamptz)
returns table(payable numeric(24,4),paid numeric(24,4),advance_paid numeric(24,4),total_paid numeric(24,4),due numeric(24,4),paid_percent numeric(8,2))
language sql security definer stable set search_path=''
as $$
with scope as(select t.id team_id from public.contractor_teams t where t.team_number=p_team_number and t.leader_profile_id=(select auth.uid()) limit 1),p as(select coalesce(sum(x.payable_amount),0)::numeric(24,4) payable from public.contractor_team_worker_payables x join scope s on s.team_id=x.team_id where x.worker_profile_id=p_worker_profile_id and x.created_at>=p_start and x.created_at<p_end),m as(select coalesce(sum(x.payable_applied_amount),0)::numeric(24,4) paid,coalesce(sum(x.advance_amount),0)::numeric(24,4) advance_paid,coalesce(sum(x.amount),0)::numeric(24,4) total_paid from public.contractor_team_worker_payments x join scope s on s.team_id=x.team_id where x.worker_profile_id=p_worker_profile_id and x.paid_at>=p_start and x.paid_at<p_end)
select p.payable,m.paid,m.advance_paid,m.total_paid,greatest(p.payable-m.paid,0)::numeric(24,4),case when p.payable=0 then 0::numeric else round((least(m.paid,p.payable)/p.payable)*100,2) end from p,m;
$$;

drop function if exists public.get_contractor_team_worker_payment_history(bigint,uuid,timestamptz,timestamptz);
create function public.get_contractor_team_worker_payment_history(p_team_number bigint,p_worker_profile_id uuid,p_start timestamptz,p_end timestamptz)
returns table(id uuid,amount numeric(24,4),payable_applied_amount numeric(24,4),advance_amount numeric(24,4),paid_at timestamptz,note text,payable_id uuid,payable_amount numeric(24,4),created_at timestamptz)
language sql security definer stable set search_path=''
as $$
select pm.id,pm.amount,pm.payable_applied_amount,pm.advance_amount,pm.paid_at,pm.note,pm.payable_id,py.payable_amount,pm.created_at from public.contractor_team_worker_payments pm join public.contractor_team_worker_payables py on py.id=pm.payable_id join public.contractor_teams t on t.id=pm.team_id where t.team_number=p_team_number and t.leader_profile_id=(select auth.uid()) and pm.worker_profile_id=p_worker_profile_id and pm.paid_at>=p_start and pm.paid_at<p_end order by pm.paid_at desc,pm.id desc;
$$;

revoke all on function public.get_contractor_team_finance_summary(bigint,timestamptz,timestamptz) from public,anon;
grant execute on function public.get_contractor_team_finance_summary(bigint,timestamptz,timestamptz) to authenticated;
revoke all on function public.get_contractor_team_finance_workers(bigint,timestamptz,timestamptz) from public,anon;
grant execute on function public.get_contractor_team_finance_workers(bigint,timestamptz,timestamptz) to authenticated;
revoke all on function public.get_contractor_team_worker_finance(bigint,uuid,timestamptz,timestamptz) from public,anon;
grant execute on function public.get_contractor_team_worker_finance(bigint,uuid,timestamptz,timestamptz) to authenticated;
revoke all on function public.get_contractor_team_worker_payment_history(bigint,uuid,timestamptz,timestamptz) from public,anon;
grant execute on function public.get_contractor_team_worker_payment_history(bigint,uuid,timestamptz,timestamptz) to authenticated;
