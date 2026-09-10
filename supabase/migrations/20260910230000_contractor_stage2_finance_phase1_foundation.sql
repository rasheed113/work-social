-- Contractor Stage 2 Finance: Company -> Contractor accounting foundation.
-- This is intentionally separate from Team Finance (Contractor -> Worker).

create table public.contractor_finance_payments (
  id uuid primary key default gen_random_uuid(),
  contractor_profile_id uuid not null references public.profiles(id) on delete cascade,
  team_id bigint null references public.contractor_teams(id) on delete set null,
  amount numeric(24,4) not null check (amount > 0),
  paid_at timestamptz not null default now(),
  note text null check (note is null or char_length(note) <= 2000),
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index contractor_finance_payments_owner_paid_idx
  on public.contractor_finance_payments(contractor_profile_id, paid_at desc, id desc)
  where deleted_at is null;

create index contractor_finance_payments_team_paid_idx
  on public.contractor_finance_payments(team_id, paid_at desc, id desc)
  where deleted_at is null and team_id is not null;

alter table public.contractor_finance_payments enable row level security;

revoke all on table public.contractor_finance_payments from anon, authenticated;
grant select, insert, update on table public.contractor_finance_payments to authenticated;

create policy contractor_finance_payments_select_own
on public.contractor_finance_payments
for select to authenticated
using ((select auth.uid()) = contractor_profile_id);

create policy contractor_finance_payments_insert_own
on public.contractor_finance_payments
for insert to authenticated
with check (
  (select auth.uid()) = contractor_profile_id
  and (select auth.uid()) = created_by
  and (
    team_id is null
    or exists (
      select 1
      from public.contractor_teams t
      where t.id = contractor_finance_payments.team_id
        and t.leader_profile_id = (select auth.uid())
    )
  )
);

create policy contractor_finance_payments_update_own
on public.contractor_finance_payments
for update to authenticated
using ((select auth.uid()) = contractor_profile_id)
with check (
  (select auth.uid()) = contractor_profile_id
  and (
    team_id is null
    or exists (
      select 1
      from public.contractor_teams t
      where t.id = contractor_finance_payments.team_id
        and t.leader_profile_id = (select auth.uid())
    )
  )
);

-- Payments are audit-safe soft records. Hard DELETE is deliberately not granted.
-- A future correction flow must void the original event and create the replacement event.
revoke delete on public.contractor_finance_payments from authenticated;

create or replace function public.record_contractor_stage2_payment(
  p_amount numeric,
  p_paid_at timestamptz default now(),
  p_note text default null,
  p_team_id bigint default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;
  if p_note is not null and char_length(p_note) > 2000 then
    raise exception 'Payment note is too long';
  end if;

  if p_team_id is not null and not exists (
    select 1
    from public.contractor_teams t
    where t.id = p_team_id
      and t.leader_profile_id = v_uid
  ) then
    raise exception 'Team not found or access denied';
  end if;

  insert into public.contractor_finance_payments(
    contractor_profile_id, team_id, amount, paid_at, note, created_by
  ) values (
    v_uid, p_team_id, p_amount, coalesce(p_paid_at, now()), nullif(btrim(p_note), ''), v_uid
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.record_contractor_stage2_payment(numeric,timestamptz,text,bigint) from public, anon;
grant execute on function public.record_contractor_stage2_payment(numeric,timestamptz,text,bigint) to authenticated;

create or replace function public.void_contractor_stage2_payment(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  update public.contractor_finance_payments
  set deleted_at = coalesce(deleted_at, now())
  where id = p_payment_id
    and contractor_profile_id = v_uid
    and deleted_at is null;

  if not found then
    raise exception 'Payment not found or already voided';
  end if;
end;
$$;

revoke all on function public.void_contractor_stage2_payment(uuid) from public, anon;
grant execute on function public.void_contractor_stage2_payment(uuid) to authenticated;

-- One server-side accounting contract for Phase 2.
-- p_team_id = null means all contractor-owned teams plus unassigned entries/payments.
-- A concrete team scope never absorbs historical rows whose team_id is null.
create or replace function public.get_contractor_stage2_finance_summary(p_team_id bigint default null)
returns table(
  total_payable numeric(24,4),
  total_commission numeric(24,4),
  total_received numeric(24,4),
  paid_against_payable numeric(24,4),
  due numeric(24,4),
  advance_paid numeric(24,4),
  payment_coverage numeric(8,2)
)
language sql
security definer
stable
set search_path = ''
as $$
with owner_scope as (
  select (select auth.uid()) as contractor_profile_id
),
entry_scope as (
  select e.id, e.total, e.pieces, e.commission_per_piece
  from public.contractor_work_entries e
  cross join owner_scope o
  where e.profile_id = o.contractor_profile_id
    and (p_team_id is null or e.team_id = p_team_id)
    and (
      p_team_id is null
      or exists (
        select 1 from public.contractor_teams t
        where t.id = e.team_id
          and t.leader_profile_id = o.contractor_profile_id
      )
    )
),
payment_scope as (
  select p.amount
  from public.contractor_finance_payments p
  cross join owner_scope o
  where p.contractor_profile_id = o.contractor_profile_id
    and p.deleted_at is null
    and (p_team_id is null or p.team_id = p_team_id)
    and (
      p_team_id is null
      or exists (
        select 1 from public.contractor_teams t
        where t.id = p.team_id
          and t.leader_profile_id = o.contractor_profile_id
      )
    )
),
agg as (
  select
    coalesce((select sum(total) from entry_scope),0)::numeric(24,4) as payable,
    coalesce((select sum(pieces * commission_per_piece) from entry_scope),0)::numeric(24,4) as commission,
    coalesce((select sum(amount) from payment_scope),0)::numeric(24,4) as received
)
select
  payable,
  commission,
  received,
  least(received, payable)::numeric(24,4),
  greatest(payable - received, 0)::numeric(24,4),
  greatest(received - payable, 0)::numeric(24,4),
  case when payable > 0 then least(received / payable, 1) * 100 else 0 end::numeric(8,2)
from agg;
$$;

revoke all on function public.get_contractor_stage2_finance_summary(bigint) from public, anon;
grant execute on function public.get_contractor_stage2_finance_summary(bigint) to authenticated;

create or replace function public.get_contractor_stage2_finance_entries(p_team_id bigint default null)
returns table(
  id uuid,
  team_id bigint,
  team_number bigint,
  team_name text,
  item_name text,
  pieces numeric(18,4),
  rate_per_piece numeric(18,4),
  commission_type text,
  commission_value numeric(18,4),
  commission_mode text,
  commission_per_piece numeric(18,4),
  actual_rate_per_piece numeric(18,4),
  total numeric(24,4),
  occurred_at timestamptz
)
language sql
security definer
stable
set search_path = ''
as $$
select e.id, e.team_id, t.team_number, t.name, e.item_name, e.pieces,
       e.rate_per_piece, e.commission_type, e.commission_value, e.commission_mode,
       e.commission_per_piece, e.actual_rate_per_piece, e.total, e.occurred_at
from public.contractor_work_entries e
left join public.contractor_teams t on t.id=e.team_id
where e.profile_id=(select auth.uid())
  and (p_team_id is null or e.team_id=p_team_id)
  and (p_team_id is null or t.leader_profile_id=(select auth.uid()))
order by e.occurred_at desc, e.id desc;
$$;

revoke all on function public.get_contractor_stage2_finance_entries(bigint) from public, anon;
grant execute on function public.get_contractor_stage2_finance_entries(bigint) to authenticated;

create or replace function public.get_contractor_stage2_finance_payments(p_team_id bigint default null)
returns table(
  id uuid,
  team_id bigint,
  team_number bigint,
  team_name text,
  amount numeric(24,4),
  paid_at timestamptz,
  note text,
  created_by uuid,
  created_at timestamptz
)
language sql
security definer
stable
set search_path = ''
as $$
select p.id, p.team_id, t.team_number, t.name, p.amount, p.paid_at,
       p.note, p.created_by, p.created_at
from public.contractor_finance_payments p
left join public.contractor_teams t on t.id=p.team_id
where p.contractor_profile_id=(select auth.uid())
  and p.deleted_at is null
  and (p_team_id is null or p.team_id=p_team_id)
  and (p_team_id is null or t.leader_profile_id=(select auth.uid()))
order by p.paid_at desc, p.id desc;
$$;

revoke all on function public.get_contractor_stage2_finance_payments(bigint) from public, anon;
grant execute on function public.get_contractor_stage2_finance_payments(bigint) to authenticated;
