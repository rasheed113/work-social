create or replace function public.get_contractor_team_worker_finance(p_team_number bigint,p_worker_profile_id uuid,p_start timestamptz,p_end timestamptz)
returns table(payable numeric(24,4),paid numeric(24,4),due numeric(24,4),paid_percent numeric(8,2))
language sql security definer stable set search_path=''
as $$
  with scope as (select t.id team_id from public.contractor_teams t where t.team_number=p_team_number and t.leader_profile_id=(select auth.uid()) limit 1),
  p as (select coalesce(sum(x.payable_amount),0)::numeric(24,4) payable from public.contractor_team_worker_payables x join scope s on s.team_id=x.team_id where x.worker_profile_id=p_worker_profile_id and x.created_at>=p_start and x.created_at<p_end),
  m as (select coalesce(sum(x.amount),0)::numeric(24,4) paid from public.contractor_team_worker_payments x join scope s on s.team_id=x.team_id where x.worker_profile_id=p_worker_profile_id and x.paid_at>=p_start and x.paid_at<p_end)
  select p.payable,m.paid,(p.payable-m.paid)::numeric(24,4),case when p.payable=0 then 0::numeric else round((m.paid/p.payable)*100,2) end from p,m;
$$;
revoke all on function public.get_contractor_team_worker_finance(bigint,uuid,timestamptz,timestamptz) from public,anon;
grant execute on function public.get_contractor_team_worker_finance(bigint,uuid,timestamptz,timestamptz) to authenticated;

create or replace function public.get_contractor_team_worker_payables(p_team_number bigint,p_worker_profile_id uuid)
returns table(id uuid,payable_amount numeric(24,4),quantity numeric(18,4),worker_rate numeric(24,4),created_at timestamptz,work_entry_id uuid,remaining numeric(24,4))
language sql security definer stable set search_path=''
as $$
  select py.id,py.payable_amount,py.quantity,py.worker_rate,py.created_at,py.work_entry_id,
    (py.payable_amount-coalesce((select sum(pm.amount) from public.contractor_team_worker_payments pm where pm.payable_id=py.id),0))::numeric(24,4)
  from public.contractor_team_worker_payables py join public.contractor_teams t on t.id=py.team_id
  where t.team_number=p_team_number and t.leader_profile_id=(select auth.uid()) and py.worker_profile_id=p_worker_profile_id
  order by py.created_at desc;
$$;
revoke all on function public.get_contractor_team_worker_payables(bigint,uuid) from public,anon;
grant execute on function public.get_contractor_team_worker_payables(bigint,uuid) to authenticated;
