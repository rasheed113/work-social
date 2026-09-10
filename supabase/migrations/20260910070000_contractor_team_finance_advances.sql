-- Allow contractor payments to exceed the payable amount.
-- The payable portion settles the real work liability; the excess becomes a worker advance.

alter table public.contractor_team_worker_payments
  add column if not exists payable_applied_amount numeric(24,4);

alter table public.contractor_team_worker_payments
  add column if not exists advance_amount numeric(24,4) not null default 0;

update public.contractor_team_worker_payments
set payable_applied_amount = amount
where payable_applied_amount is null;

alter table public.contractor_team_worker_payments
  alter column payable_applied_amount set not null;

alter table public.contractor_team_worker_payments
  add constraint contractor_team_worker_payments_applied_nonnegative
  check (payable_applied_amount >= 0);

alter table public.contractor_team_worker_payments
  add constraint contractor_team_worker_payments_advance_nonnegative
  check (advance_amount >= 0);

create or replace function private.sync_contractor_team_worker_payment_to_finance_received()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.payable_applied_amount > 0 then
    insert into public.worker_finance_received(worker_profile_id, entry_type, amount, received_at)
    values (new.worker_profile_id, 'payment', new.payable_applied_amount, new.paid_at);
  end if;

  if new.advance_amount > 0 then
    insert into public.worker_finance_received(worker_profile_id, entry_type, amount, received_at)
    values (new.worker_profile_id, 'advance', new.advance_amount, new.paid_at);
  end if;

  return new;
end;
$$;

revoke all on function private.sync_contractor_team_worker_payment_to_finance_received() from public,anon,authenticated;

drop trigger if exists contractor_team_worker_payment_finance_received on public.contractor_team_worker_payments;
create trigger contractor_team_worker_payment_finance_received
after insert on public.contractor_team_worker_payments
for each row execute function private.sync_contractor_team_worker_payment_to_finance_received();

create or replace function public.record_contractor_team_worker_payment(
  p_team_number bigint,
  p_payable_id uuid,
  p_amount numeric,
  p_paid_at timestamptz default now(),
  p_note text default null
) returns uuid
language plpgsql
security definer
set search_path=''
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

  select coalesce(sum(pm.payable_applied_amount),0)::numeric(24,4)
    into v_paid
  from public.contractor_team_worker_payments pm
  where pm.payable_id = p_payable_id;

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
  )
  values(
    v_team_id,
    v_worker_profile_id,
    p_payable_id,
    p_amount,
    v_applied,
    v_advance,
    p_paid_at,
    nullif(btrim(p_note),''),
    (select auth.uid())
  )
  returning id into v_payment_id;

  return v_payment_id;
end;
$$;

revoke all on function public.record_contractor_team_worker_payment(bigint,uuid,numeric,timestamptz,text) from public,anon;
grant execute on function public.record_contractor_team_worker_payment(bigint,uuid,numeric,timestamptz,text) to authenticated;

create or replace function public.get_contractor_team_finance_summary(p_team_number bigint,p_start timestamptz,p_end timestamptz)
returns table(payable numeric(24,4),paid numeric(24,4),due numeric(24,4),paid_percent numeric(8,2))
language sql security definer stable set search_path=''
as $$
with scope as(
  select t.id team_id from public.contractor_teams t
  where t.team_number=p_team_number and t.leader_profile_id=(select auth.uid()) limit 1
),
p as(
  select coalesce(sum(wp.payable_amount),0)::numeric(24,4) payable
  from public.contractor_team_worker_payables wp join scope s on s.team_id=wp.team_id
  where wp.created_at>=p_start and wp.created_at<p_end
),
m as(
  select coalesce(sum(pm.amount),0)::numeric(24,4) paid
  from public.contractor_team_worker_payments pm join scope s on s.team_id=pm.team_id
  where pm.paid_at>=p_start and pm.paid_at<p_end
)
select p.payable,m.paid,greatest(p.payable-m.paid,0)::numeric(24,4),
case when p.payable=0 then 0::numeric else round((least(m.paid,p.payable)/p.payable)*100,2) end
from p,m;
$$;

create or replace function public.get_contractor_team_finance_workers(p_team_number bigint,p_start timestamptz,p_end timestamptz)
returns table(worker_profile_id uuid,work_id uuid,display_name text,username text,avatar_url text,payable numeric(24,4),paid numeric(24,4),due numeric(24,4))
language sql security definer stable set search_path=''
as $$
select wp.id,wp.work_id,pr.display_name,pr.username,pr.avatar_url,
coalesce((select sum(py.payable_amount) from public.contractor_team_worker_payables py where py.team_id=t.id and py.worker_profile_id=wp.id and py.created_at>=p_start and py.created_at<p_end),0)::numeric(24,4),
coalesce((select sum(pm.amount) from public.contractor_team_worker_payments pm where pm.team_id=t.id and pm.worker_profile_id=wp.id and pm.paid_at>=p_start and pm.paid_at<p_end),0)::numeric(24,4),
greatest((coalesce((select sum(py.payable_amount) from public.contractor_team_worker_payables py where py.team_id=t.id and py.worker_profile_id=wp.id and py.created_at>=p_start and py.created_at<p_end),0)-coalesce((select sum(pm.payable_applied_amount) from public.contractor_team_worker_payments pm where pm.team_id=t.id and pm.worker_profile_id=wp.id and pm.paid_at>=p_start and pm.paid_at<p_end),0)),0)::numeric(24,4)
from public.contractor_team_members m
join public.contractor_teams t on t.id=m.team_id and t.team_number=p_team_number and t.leader_profile_id=(select auth.uid())
join public.worker_profiles wp on wp.profile_id=m.profile_id
left join public.profiles pr on pr.id=wp.profile_id
group by wp.id,wp.work_id,pr.display_name,pr.username,pr.avatar_url,m.joined_at,t.id
order by coalesce(pr.display_name,pr.username,''),m.joined_at;
$$;

create or replace function public.get_contractor_team_worker_finance(p_team_number bigint,p_worker_profile_id uuid,p_start timestamptz,p_end timestamptz)
returns table(payable numeric(24,4),paid numeric(24,4),due numeric(24,4),paid_percent numeric(8,2))
language sql security definer stable set search_path=''
as $$
with scope as(
  select t.id team_id from public.contractor_teams t
  where t.team_number=p_team_number and t.leader_profile_id=(select auth.uid()) limit 1
),
p as(
  select coalesce(sum(x.payable_amount),0)::numeric(24,4) payable
  from public.contractor_team_worker_payables x join scope s on s.team_id=x.team_id
  where x.worker_profile_id=p_worker_profile_id and x.created_at>=p_start and x.created_at<p_end
),
m as(
  select coalesce(sum(x.amount),0)::numeric(24,4) paid
  from public.contractor_team_worker_payments x join scope s on s.team_id=x.team_id
  where x.worker_profile_id=p_worker_profile_id and x.paid_at>=p_start and x.paid_at<p_end
),
a as(
  select coalesce(sum(x.payable_applied_amount),0)::numeric(24,4) applied
  from public.contractor_team_worker_payments x join scope s on s.team_id=x.team_id
  where x.worker_profile_id=p_worker_profile_id and x.paid_at>=p_start and x.paid_at<p_end
)
select p.payable,m.paid,greatest(p.payable-a.applied,0)::numeric(24,4),
case when p.payable=0 then 0::numeric else round((least(a.applied,p.payable)/p.payable)*100,2) end
from p,m,a;
$$;

create or replace function public.get_contractor_team_worker_payables(p_team_number bigint,p_worker_profile_id uuid)
returns table(id uuid,payable_amount numeric(24,4),quantity numeric(18,4),worker_rate numeric(24,4),created_at timestamptz,work_entry_id uuid,remaining numeric(24,4))
language sql security definer stable set search_path=''
as $$
select py.id,py.payable_amount,py.quantity,py.worker_rate,py.created_at,py.work_entry_id,
greatest((py.payable_amount-coalesce((select sum(pm.payable_applied_amount) from public.contractor_team_worker_payments pm where pm.payable_id=py.id),0)),0)::numeric(24,4)
from public.contractor_team_worker_payables py
join public.contractor_teams t on t.id=py.team_id
where t.team_number=p_team_number and t.leader_profile_id=(select auth.uid()) and py.worker_profile_id=p_worker_profile_id
order by py.created_at desc;
$$;

revoke all on function public.get_contractor_team_finance_summary(bigint,timestamptz,timestamptz) from public,anon;
grant execute on function public.get_contractor_team_finance_summary(bigint,timestamptz,timestamptz) to authenticated;
revoke all on function public.get_contractor_team_finance_workers(bigint,timestamptz,timestamptz) from public,anon;
grant execute on function public.get_contractor_team_finance_workers(bigint,timestamptz,timestamptz) to authenticated;
revoke all on function public.get_contractor_team_worker_finance(bigint,uuid,timestamptz,timestamptz) from public,anon;
grant execute on function public.get_contractor_team_worker_finance(bigint,uuid,timestamptz,timestamptz) to authenticated;
revoke all on function public.get_contractor_team_worker_payables(bigint,uuid) from public,anon;
grant execute on function public.get_contractor_team_worker_payables(bigint,uuid) to authenticated;
