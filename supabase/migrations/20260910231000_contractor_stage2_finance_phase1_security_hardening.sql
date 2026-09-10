-- Phase 1 security hardening: these RPCs do not need elevated privileges.
-- Keep them SECURITY INVOKER so the caller's RLS remains authoritative.

create or replace function public.record_contractor_stage2_payment(
  p_amount numeric,
  p_paid_at timestamptz default now(),
  p_note text default null,
  p_team_id bigint default null
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Payment amount must be greater than zero'; end if;
  if p_note is not null and char_length(p_note) > 2000 then raise exception 'Payment note is too long'; end if;
  if p_team_id is not null and not exists (
    select 1 from public.contractor_teams t
    where t.id = p_team_id and t.leader_profile_id = v_uid
  ) then raise exception 'Team not found or access denied'; end if;

  insert into public.contractor_finance_payments(
    contractor_profile_id, team_id, amount, paid_at, note, created_by
  ) values (
    v_uid, p_team_id, p_amount, coalesce(p_paid_at, now()), nullif(btrim(p_note), ''), v_uid
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.void_contractor_stage2_payment(p_payment_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  update public.contractor_finance_payments
  set deleted_at = coalesce(deleted_at, now())
  where id = p_payment_id
    and contractor_profile_id = (select auth.uid())
    and deleted_at is null;
  if not found then raise exception 'Payment not found or already voided'; end if;
end;
$$;

create or replace function public.get_contractor_stage2_finance_summary(p_team_id bigint default null)
returns table(total_payable numeric(24,4),total_commission numeric(24,4),total_received numeric(24,4),paid_against_payable numeric(24,4),due numeric(24,4),advance_paid numeric(24,4),payment_coverage numeric(8,2))
language sql
security invoker
stable
set search_path = ''
as $$
with entry_scope as (
  select e.total,e.pieces,e.commission_per_piece
  from public.contractor_work_entries e
  where e.profile_id=(select auth.uid())
    and (p_team_id is null or e.team_id=p_team_id)
    and (p_team_id is null or exists(select 1 from public.contractor_teams t where t.id=e.team_id and t.leader_profile_id=(select auth.uid())))
),
payment_scope as (
  select p.amount
  from public.contractor_finance_payments p
  where p.contractor_profile_id=(select auth.uid())
    and p.deleted_at is null
    and (p_team_id is null or p.team_id=p_team_id)
    and (p_team_id is null or exists(select 1 from public.contractor_teams t where t.id=p.team_id and t.leader_profile_id=(select auth.uid())))
),
agg as (
  select coalesce((select sum(total) from entry_scope),0)::numeric(24,4) payable,
         coalesce((select sum(pieces*commission_per_piece) from entry_scope),0)::numeric(24,4) commission,
         coalesce((select sum(amount) from payment_scope),0)::numeric(24,4) received
)
select payable,commission,received,least(received,payable)::numeric(24,4),greatest(payable-received,0)::numeric(24,4),greatest(received-payable,0)::numeric(24,4),case when payable>0 then least(received/payable,1)*100 else 0 end::numeric(8,2)
from agg;
$$;

create or replace function public.get_contractor_stage2_finance_entries(p_team_id bigint default null)
returns table(id uuid,team_id bigint,team_number bigint,team_name text,item_name text,pieces numeric(18,4),rate_per_piece numeric(18,4),commission_type text,commission_value numeric(18,4),commission_mode text,commission_per_piece numeric(18,4),actual_rate_per_piece numeric(18,4),total numeric(24,4),occurred_at timestamptz)
language sql
security invoker
stable
set search_path = ''
as $$
select e.id,e.team_id,t.team_number,t.name,e.item_name,e.pieces,e.rate_per_piece,e.commission_type,e.commission_value,e.commission_mode,e.commission_per_piece,e.actual_rate_per_piece,e.total,e.occurred_at
from public.contractor_work_entries e
left join public.contractor_teams t on t.id=e.team_id
where e.profile_id=(select auth.uid())
  and (p_team_id is null or e.team_id=p_team_id)
  and (p_team_id is null or t.leader_profile_id=(select auth.uid()))
order by e.occurred_at desc,e.id desc;
$$;

create or replace function public.get_contractor_stage2_finance_payments(p_team_id bigint default null)
returns table(id uuid,team_id bigint,team_number bigint,team_name text,amount numeric(24,4),paid_at timestamptz,note text,created_by uuid,created_at timestamptz)
language sql
security invoker
stable
set search_path = ''
as $$
select p.id,p.team_id,t.team_number,t.name,p.amount,p.paid_at,p.note,p.created_by,p.created_at
from public.contractor_finance_payments p
left join public.contractor_teams t on t.id=p.team_id
where p.contractor_profile_id=(select auth.uid())
  and p.deleted_at is null
  and (p_team_id is null or p.team_id=p_team_id)
  and (p_team_id is null or t.leader_profile_id=(select auth.uid()))
order by p.paid_at desc,p.id desc;
$$;

revoke all on function public.record_contractor_stage2_payment(numeric,timestamptz,text,bigint) from public,anon;
grant execute on function public.record_contractor_stage2_payment(numeric,timestamptz,text,bigint) to authenticated;
revoke all on function public.void_contractor_stage2_payment(uuid) from public,anon;
grant execute on function public.void_contractor_stage2_payment(uuid) to authenticated;
revoke all on function public.get_contractor_stage2_finance_summary(bigint) from public,anon;
grant execute on function public.get_contractor_stage2_finance_summary(bigint) to authenticated;
revoke all on function public.get_contractor_stage2_finance_entries(bigint) from public,anon;
grant execute on function public.get_contractor_stage2_finance_entries(bigint) to authenticated;
revoke all on function public.get_contractor_stage2_finance_payments(bigint) from public,anon;
grant execute on function public.get_contractor_stage2_finance_payments(bigint) to authenticated;
