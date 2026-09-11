-- Stage 2 Finance Phase 2: make the selected contractor team id the authoritative
-- Finance context while preserving the existing accounting RPCs and semantics.
-- Each wrapper validates ownership against the real team id, then delegates to
-- the already-authoritative team-number finance implementation.

create or replace function public.get_contractor_team_finance_context(p_team_id bigint)
returns table(team_id bigint, team_number bigint, team_name text)
language sql
security definer
stable
set search_path=''
as $$
  select t.id, t.team_number, t.name
  from public.contractor_teams t
  where t.id = p_team_id
    and t.leader_profile_id = (select auth.uid())
  limit 1;
$$;
revoke all on function public.get_contractor_team_finance_context(bigint) from public,anon;
grant execute on function public.get_contractor_team_finance_context(bigint) to authenticated;

create or replace function public.get_contractor_team_finance_summary_by_team_id(p_team_id bigint,p_start timestamptz,p_end timestamptz)
returns table(payable numeric(24,4),paid numeric(24,4),advance_paid numeric(24,4),total_paid numeric(24,4),due numeric(24,4),paid_percent numeric(8,2))
language sql security definer stable set search_path=''
as $$
  select x.payable,x.paid,x.advance_paid,x.total_paid,x.due,x.paid_percent
  from public.get_contractor_team_finance_context(p_team_id) c
  cross join lateral public.get_contractor_team_finance_summary(c.team_number,p_start,p_end) x;
$$;
revoke all on function public.get_contractor_team_finance_summary_by_team_id(bigint,timestamptz,timestamptz) from public,anon;
grant execute on function public.get_contractor_team_finance_summary_by_team_id(bigint,timestamptz,timestamptz) to authenticated;

create or replace function public.get_contractor_team_finance_workers_by_team_id(p_team_id bigint,p_start timestamptz,p_end timestamptz)
returns table(worker_profile_id uuid,work_id uuid,display_name text,username text,avatar_url text,payable numeric(24,4),paid numeric(24,4),advance_paid numeric(24,4),total_paid numeric(24,4),due numeric(24,4),paid_percent numeric(8,2))
language sql security definer stable set search_path=''
as $$
  select x.worker_profile_id,x.work_id,x.display_name,x.username,x.avatar_url,x.payable,x.paid,x.advance_paid,x.total_paid,x.due,x.paid_percent
  from public.get_contractor_team_finance_context(p_team_id) c
  cross join lateral public.get_contractor_team_finance_workers(c.team_number,p_start,p_end) x;
$$;
revoke all on function public.get_contractor_team_finance_workers_by_team_id(bigint,timestamptz,timestamptz) from public,anon;
grant execute on function public.get_contractor_team_finance_workers_by_team_id(bigint,timestamptz,timestamptz) to authenticated;

create or replace function public.get_contractor_team_worker_finance_by_team_id(p_team_id bigint,p_worker_profile_id uuid,p_start timestamptz,p_end timestamptz)
returns table(payable numeric(24,4),paid numeric(24,4),advance_paid numeric(24,4),total_paid numeric(24,4),due numeric(24,4),paid_percent numeric(8,2))
language sql security definer stable set search_path=''
as $$
  select x.payable,x.paid,x.advance_paid,x.total_paid,x.due,x.paid_percent
  from public.get_contractor_team_finance_context(p_team_id) c
  cross join lateral public.get_contractor_team_worker_finance(c.team_number,p_worker_profile_id,p_start,p_end) x;
$$;
revoke all on function public.get_contractor_team_worker_finance_by_team_id(bigint,uuid,timestamptz,timestamptz) from public,anon;
grant execute on function public.get_contractor_team_worker_finance_by_team_id(bigint,uuid,timestamptz,timestamptz) to authenticated;

create or replace function public.get_contractor_team_worker_payables_by_team_id(p_team_id bigint,p_worker_profile_id uuid)
returns table(id uuid,payable_amount numeric(24,4),quantity numeric(18,4),worker_rate numeric(24,4),created_at timestamptz,work_entry_id uuid,remaining numeric(24,4))
language sql security definer stable set search_path=''
as $$
  select x.id,x.payable_amount,x.quantity,x.worker_rate,x.created_at,x.work_entry_id,x.remaining
  from public.get_contractor_team_finance_context(p_team_id) c
  cross join lateral public.get_contractor_team_worker_payables(c.team_number,p_worker_profile_id) x;
$$;
revoke all on function public.get_contractor_team_worker_payables_by_team_id(bigint,uuid) from public,anon;
grant execute on function public.get_contractor_team_worker_payables_by_team_id(bigint,uuid) to authenticated;

create or replace function public.get_contractor_team_worker_payment_history_by_team_id(p_team_id bigint,p_worker_profile_id uuid,p_start timestamptz,p_end timestamptz)
returns table(id uuid,amount numeric(24,4),payable_applied_amount numeric(24,4),advance_amount numeric(24,4),paid_at timestamptz,note text,payable_id uuid,payable_amount numeric(24,4),created_at timestamptz)
language sql security definer stable set search_path=''
as $$
  select x.id,x.amount,x.payable_applied_amount,x.advance_amount,x.paid_at,x.note,x.payable_id,x.payable_amount,x.created_at
  from public.get_contractor_team_finance_context(p_team_id) c
  cross join lateral public.get_contractor_team_worker_payment_history(c.team_number,p_worker_profile_id,p_start,p_end) x;
$$;
revoke all on function public.get_contractor_team_worker_payment_history_by_team_id(bigint,uuid,timestamptz,timestamptz) from public,anon;
grant execute on function public.get_contractor_team_worker_payment_history_by_team_id(bigint,uuid,timestamptz,timestamptz) to authenticated;

create or replace function public.get_contractor_team_worker_work_history_by_team_id(p_team_id bigint,p_worker_profile_id uuid,p_start timestamptz,p_end timestamptz)
returns table(id uuid,item_name text,size text[],quantity numeric,rate numeric,total numeric,special_note text,occurred_at timestamptz,updated_at timestamptz,lifecycle_state text)
language sql security definer stable set search_path=''
as $$
  select x.id,x.item_name,x.size,x.quantity,x.rate,x.total,x.special_note,x.occurred_at,x.updated_at,x.lifecycle_state
  from public.get_contractor_team_finance_context(p_team_id) c
  cross join lateral public.get_contractor_team_worker_work_history(c.team_number,p_worker_profile_id,p_start,p_end) x;
$$;
revoke all on function public.get_contractor_team_worker_work_history_by_team_id(bigint,uuid,timestamptz,timestamptz) from public,anon;
grant execute on function public.get_contractor_team_worker_work_history_by_team_id(bigint,uuid,timestamptz,timestamptz) to authenticated;

create or replace function public.record_contractor_team_worker_payment_by_team_id(p_team_id bigint,p_payable_id uuid,p_amount numeric,p_paid_at timestamptz default now(),p_note text default null)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_team_number bigint; v_id uuid;
begin
  select c.team_number into v_team_number from public.get_contractor_team_finance_context(p_team_id) c;
  if v_team_number is null then raise exception 'Team not found or access denied'; end if;
  select public.record_contractor_team_worker_payment(v_team_number,p_payable_id,p_amount,p_paid_at,p_note) into v_id;
  return v_id;
end;
$$;
revoke all on function public.record_contractor_team_worker_payment_by_team_id(bigint,uuid,numeric,timestamptz,text) from public,anon;
grant execute on function public.record_contractor_team_worker_payment_by_team_id(bigint,uuid,numeric,timestamptz,text) to authenticated;

create or replace function public.edit_contractor_team_worker_payment_by_team_id(p_team_id bigint,p_payment_id uuid,p_amount numeric,p_note text default null)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_team_number bigint; v_id uuid;
begin
  select c.team_number into v_team_number from public.get_contractor_team_finance_context(p_team_id) c;
  if v_team_number is null then raise exception 'Team not found or access denied'; end if;
  select public.edit_contractor_team_worker_payment(v_team_number,p_payment_id,p_amount,p_note) into v_id;
  return v_id;
end;
$$;
revoke all on function public.edit_contractor_team_worker_payment_by_team_id(bigint,uuid,numeric,text) from public,anon;
grant execute on function public.edit_contractor_team_worker_payment_by_team_id(bigint,uuid,numeric,text) to authenticated;

create or replace function public.delete_contractor_team_worker_payment_by_team_id(p_team_id bigint,p_payment_id uuid)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_team_number bigint; v_id uuid;
begin
  select c.team_number into v_team_number from public.get_contractor_team_finance_context(p_team_id) c;
  if v_team_number is null then raise exception 'Team not found or access denied'; end if;
  select public.delete_contractor_team_worker_payment(v_team_number,p_payment_id) into v_id;
  return v_id;
end;
$$;
revoke all on function public.delete_contractor_team_worker_payment_by_team_id(bigint,uuid) from public,anon;
grant execute on function public.delete_contractor_team_worker_payment_by_team_id(bigint,uuid) to authenticated;
