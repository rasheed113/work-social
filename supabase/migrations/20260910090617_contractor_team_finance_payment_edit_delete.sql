-- Team Finance payment correction: premium edit/delete with locked allocation semantics.
-- This migration is applied to the Work Social Supabase project as version 20260910090617.

alter table public.contractor_team_worker_payments add column if not exists deleted_at timestamptz;
alter table public.worker_finance_received add column if not exists source_payment_id uuid;
create index if not exists contractor_team_worker_payments_active_payable_idx on public.contractor_team_worker_payments(payable_id,paid_at,id) where deleted_at is null;
create index if not exists worker_finance_received_source_payment_idx on public.worker_finance_received(source_payment_id,entry_type) where source_payment_id is not null;

with candidates as (
 select pm.id payment_id,r.id received_id,row_number() over(partition by pm.id,r.entry_type order by r.created_at,r.id) rn
 from public.contractor_team_worker_payments pm join public.worker_finance_received r on r.worker_profile_id=pm.worker_profile_id and r.received_at=pm.paid_at and r.deleted_at is null and r.source_payment_id is null and ((r.entry_type='payment' and r.amount=pm.payable_applied_amount) or (r.entry_type='advance' and r.amount=pm.advance_amount))
) update public.worker_finance_received r set source_payment_id=c.payment_id from candidates c where r.id=c.received_id and c.rn=1;

create or replace function private.sync_contractor_team_worker_payment_to_finance_received() returns trigger language plpgsql security definer set search_path='' as $$
declare v_existing_id uuid;
begin
 if new.deleted_at is not null then update public.worker_finance_received set deleted_at=coalesce(deleted_at,now()) where source_payment_id=new.id; return new; end if;
 if new.payable_applied_amount>0 then
  select id into v_existing_id from public.worker_finance_received where source_payment_id=new.id and entry_type='payment' order by created_at,id limit 1;
  if v_existing_id is null then insert into public.worker_finance_received(worker_profile_id,entry_type,amount,received_at,source_payment_id,deleted_at) values(new.worker_profile_id,'payment',new.payable_applied_amount,new.paid_at,new.id,null);
  else update public.worker_finance_received set worker_profile_id=new.worker_profile_id,amount=new.payable_applied_amount,received_at=new.paid_at,deleted_at=null where id=v_existing_id; end if;
 else update public.worker_finance_received set deleted_at=coalesce(deleted_at,now()) where source_payment_id=new.id and entry_type='payment'; end if;
 if new.advance_amount>0 then
  select id into v_existing_id from public.worker_finance_received where source_payment_id=new.id and entry_type='advance' order by created_at,id limit 1;
  if v_existing_id is null then insert into public.worker_finance_received(worker_profile_id,entry_type,amount,received_at,source_payment_id,deleted_at) values(new.worker_profile_id,'advance',new.advance_amount,new.paid_at,new.id,null);
  else update public.worker_finance_received set worker_profile_id=new.worker_profile_id,amount=new.advance_amount,received_at=new.paid_at,deleted_at=null where id=v_existing_id; end if;
 else update public.worker_finance_received set deleted_at=coalesce(deleted_at,now()) where source_payment_id=new.id and entry_type='advance'; end if;
 return new;
end; $$;
revoke all on function private.sync_contractor_team_worker_payment_to_finance_received() from public,anon,authenticated;
drop trigger if exists contractor_team_worker_payment_finance_received on public.contractor_team_worker_payments;
create trigger contractor_team_worker_payment_finance_received after insert or update of amount,payable_applied_amount,advance_amount,paid_at,deleted_at on public.contractor_team_worker_payments for each row execute function private.sync_contractor_team_worker_payment_to_finance_received();

create or replace function private.recalculate_contractor_team_payable(p_payable_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 with ordered as (select pm.id,pm.amount,py.payable_amount,coalesce(sum(pm.amount) over(order by pm.paid_at,pm.id rows between unbounded preceding and 1 preceding),0) prior_amount from public.contractor_team_worker_payments pm join public.contractor_team_worker_payables py on py.id=pm.payable_id where pm.payable_id=p_payable_id and pm.deleted_at is null)
 update public.contractor_team_worker_payments pm set payable_applied_amount=least(o.amount,greatest(o.payable_amount-o.prior_amount,0)),advance_amount=greatest(o.amount-least(o.amount,greatest(o.payable_amount-o.prior_amount,0)),0) from ordered o where pm.id=o.id;
end; $$;
revoke all on function private.recalculate_contractor_team_payable(uuid) from public,anon,authenticated;

create or replace function public.edit_contractor_team_worker_payment(p_team_number bigint,p_payment_id uuid,p_amount numeric,p_note text default null) returns uuid language plpgsql security definer set search_path='' as $$
declare v_team_id bigint;v_payable_id uuid;
begin
 if p_amount is null or p_amount<=0 then raise exception 'Payment amount must be greater than zero';end if;
 select pm.team_id,pm.payable_id into v_team_id,v_payable_id from public.contractor_team_worker_payments pm join public.contractor_teams t on t.id=pm.team_id where pm.id=p_payment_id and pm.deleted_at is null and t.team_number=p_team_number and t.leader_profile_id=(select auth.uid()) for update;
 if v_team_id is null then raise exception 'Payment not found or access denied';end if;
 with ordered as (select pm.id,case when pm.id=p_payment_id then p_amount else pm.amount end new_amount,py.payable_amount,coalesce(sum(case when pm.id=p_payment_id then p_amount else pm.amount end) over(order by pm.paid_at,pm.id rows between unbounded preceding and 1 preceding),0) prior_amount from public.contractor_team_worker_payments pm join public.contractor_team_worker_payables py on py.id=pm.payable_id where pm.payable_id=v_payable_id and pm.deleted_at is null)
 update public.contractor_team_worker_payments pm set amount=o.new_amount,payable_applied_amount=least(o.new_amount,greatest(o.payable_amount-o.prior_amount,0)),advance_amount=greatest(o.new_amount-least(o.new_amount,greatest(o.payable_amount-o.prior_amount,0)),0),note=case when pm.id=p_payment_id then nullif(btrim(p_note),'') else pm.note end from ordered o where pm.id=o.id;
 return p_payment_id;
end; $$;
revoke all on function public.edit_contractor_team_worker_payment(bigint,uuid,numeric,text) from public,anon;
grant execute on function public.edit_contractor_team_worker_payment(bigint,uuid,numeric,text) to authenticated;

create or replace function public.delete_contractor_team_worker_payment(p_team_number bigint,p_payment_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare v_team_id bigint;v_payable_id uuid;
begin
 select pm.team_id,pm.payable_id into v_team_id,v_payable_id from public.contractor_team_worker_payments pm join public.contractor_teams t on t.id=pm.team_id where pm.id=p_payment_id and pm.deleted_at is null and t.team_number=p_team_number and t.leader_profile_id=(select auth.uid()) for update;
 if v_team_id is null then raise exception 'Payment not found or access denied';end if;
 update public.contractor_team_worker_payments set deleted_at=now() where id=p_payment_id;
 perform private.recalculate_contractor_team_payable(v_payable_id);return p_payment_id;
end; $$;
revoke all on function public.delete_contractor_team_worker_payment(bigint,uuid) from public,anon;
grant execute on function public.delete_contractor_team_worker_payment(bigint,uuid) to authenticated;

-- All Team Finance read RPCs must ignore soft-deleted payments. Existing implementations are replaced with the same locked accounting semantics.
drop function if exists public.get_contractor_team_finance_summary(bigint,timestamptz,timestamptz);
create function public.get_contractor_team_finance_summary(p_team_number bigint,p_start timestamptz,p_end timestamptz) returns table(payable numeric(24,4),paid numeric(24,4),advance_paid numeric(24,4),total_paid numeric(24,4),due numeric(24,4),paid_percent numeric(8,2)) language sql security definer stable set search_path='' as $$
with scope as(select t.id team_id from public.contractor_teams t where t.team_number=p_team_number and t.leader_profile_id=(select auth.uid()) limit 1),p as(select coalesce(sum(wp.payable_amount),0)::numeric(24,4) payable from public.contractor_team_worker_payables wp join scope s on s.team_id=wp.team_id where wp.created_at>=p_start and wp.created_at<p_end),m as(select coalesce(sum(pm.payable_applied_amount),0)::numeric(24,4) paid,coalesce(sum(pm.advance_amount),0)::numeric(24,4) advance_paid,coalesce(sum(pm.amount),0)::numeric(24,4) total_paid from public.contractor_team_worker_payments pm join scope s on s.team_id=pm.team_id where pm.paid_at>=p_start and pm.paid_at<p_end and pm.deleted_at is null) select p.payable,m.paid,m.advance_paid,m.total_paid,greatest(p.payable-m.paid,0)::numeric(24,4),case when p.payable=0 then 0::numeric else round((least(m.paid,p.payable)/p.payable)*100,2) end from p,m; $$;

drop function if exists public.get_contractor_team_finance_workers(bigint,timestamptz,timestamptz);
create function public.get_contractor_team_finance_workers(p_team_number bigint,p_start timestamptz,p_end timestamptz) returns table(worker_profile_id uuid,work_id uuid,display_name text,username text,avatar_url text,payable numeric(24,4),paid numeric(24,4),advance_paid numeric(24,4),total_paid numeric(24,4),due numeric(24,4),paid_percent numeric(8,2)) language sql security definer stable set search_path='' as $$
select wp.id,wp.work_id,pr.display_name,pr.username,pr.avatar_url,coalesce((select sum(py.payable_amount) from public.contractor_team_worker_payables py where py.team_id=t.id and py.worker_profile_id=wp.id and py.created_at>=p_start and py.created_at<p_end),0)::numeric(24,4),coalesce((select sum(pm.payable_applied_amount) from public.contractor_team_worker_payments pm where pm.team_id=t.id and pm.worker_profile_id=wp.id and pm.paid_at>=p_start and pm.paid_at<p_end and pm.deleted_at is null),0)::numeric(24,4),coalesce((select sum(pm.advance_amount) from public.contractor_team_worker_payments pm where pm.team_id=t.id and pm.worker_profile_id=wp.id and pm.paid_at>=p_start and pm.paid_at<p_end and pm.deleted_at is null),0)::numeric(24,4),coalesce((select sum(pm.amount) from public.contractor_team_worker_payments pm where pm.team_id=t.id and pm.worker_profile_id=wp.id and pm.paid_at>=p_start and pm.paid_at<p_end and pm.deleted_at is null),0)::numeric(24,4),greatest(coalesce((select sum(py.payable_amount) from public.contractor_team_worker_payables py where py.team_id=t.id and py.worker_profile_id=wp.id and py.created_at>=p_start and py.created_at<p_end),0)-coalesce((select sum(pm.payable_applied_amount) from public.contractor_team_worker_payments pm where pm.team_id=t.id and pm.worker_profile_id=wp.id and pm.paid_at>=p_start and pm.paid_at<p_end and pm.deleted_at is null),0),0)::numeric(24,4),case when coalesce((select sum(py.payable_amount) from public.contractor_team_worker_payables py where py.team_id=t.id and py.worker_profile_id=wp.id and py.created_at>=p_start and py.created_at<p_end),0)=0 then 0::numeric else round((least(coalesce((select sum(pm.payable_applied_amount) from public.contractor_team_worker_payments pm where pm.team_id=t.id and pm.worker_profile_id=wp.id and pm.paid_at>=p_start and pm.paid_at<p_end and pm.deleted_at is null),0),coalesce((select sum(py.payable_amount) from public.contractor_team_worker_payables py where py.team_id=t.id and py.worker_profile_id=wp.id and py.created_at>=p_start and py.created_at<p_end),0))/nullif(coalesce((select sum(py.payable_amount) from public.contractor_team_worker_payables py where py.team_id=t.id and py.worker_profile_id=wp.id and py.created_at>=p_start and py.created_at<p_end),0),0))*100,2) end from public.contractor_team_members m join public.contractor_teams t on t.id=m.team_id and t.team_number=p_team_number and t.leader_profile_id=(select auth.uid()) join public.worker_profiles wp on wp.profile_id=m.profile_id left join public.profiles pr on pr.id=wp.profile_id group by wp.id,wp.work_id,pr.display_name,pr.username,pr.avatar_url,m.joined_at,t.id order by coalesce(pr.display_name,pr.username,''),m.joined_at; $$;

drop function if exists public.get_contractor_team_worker_finance(bigint,uuid,timestamptz,timestamptz);
create function public.get_contractor_team_worker_finance(p_team_number bigint,p_worker_profile_id uuid,p_start timestamptz,p_end timestamptz) returns table(payable numeric(24,4),paid numeric(24,4),advance_paid numeric(24,4),total_paid numeric(24,4),due numeric(24,4),paid_percent numeric(8,2)) language sql security definer stable set search_path='' as $$
with scope as(select t.id team_id from public.contractor_teams t where t.team_number=p_team_number and t.leader_profile_id=(select auth.uid()) limit 1),p as(select coalesce(sum(x.payable_amount),0)::numeric(24,4) payable from public.contractor_team_worker_payables x join scope s on s.team_id=x.team_id where x.worker_profile_id=p_worker_profile_id and x.created_at>=p_start and x.created_at<p_end),m as(select coalesce(sum(x.payable_applied_amount),0)::numeric(24,4) paid,coalesce(sum(x.advance_amount),0)::numeric(24,4) advance_paid,coalesce(sum(x.amount),0)::numeric(24,4) total_paid from public.contractor_team_worker_payments x join scope s on s.team_id=x.team_id where x.worker_profile_id=p_worker_profile_id and x.paid_at>=p_start and x.paid_at<p_end and x.deleted_at is null) select p.payable,m.paid,m.advance_paid,m.total_paid,greatest(p.payable-m.paid,0)::numeric(24,4),case when p.payable=0 then 0::numeric else round((least(m.paid,p.payable)/p.payable)*100,2) end from p,m; $$;

drop function if exists public.get_contractor_team_worker_payment_history(bigint,uuid,timestamptz,timestamptz);
create function public.get_contractor_team_worker_payment_history(p_team_number bigint,p_worker_profile_id uuid,p_start timestamptz,p_end timestamptz) returns table(id uuid,amount numeric(24,4),payable_applied_amount numeric(24,4),advance_amount numeric(24,4),paid_at timestamptz,note text,payable_id uuid,payable_amount numeric(24,4),created_at timestamptz) language sql security definer stable set search_path='' as $$
select pm.id,pm.amount,pm.payable_applied_amount,pm.advance_amount,pm.paid_at,pm.note,pm.payable_id,py.payable_amount,pm.created_at from public.contractor_team_worker_payments pm join public.contractor_team_worker_payables py on py.id=pm.payable_id join public.contractor_teams t on t.id=pm.team_id where t.team_number=p_team_number and t.leader_profile_id=(select auth.uid()) and pm.worker_profile_id=p_worker_profile_id and pm.paid_at>=p_start and pm.paid_at<p_end and pm.deleted_at is null order by pm.paid_at desc,pm.id desc; $$;

drop function if exists public.get_contractor_team_worker_payables(bigint,uuid);
create function public.get_contractor_team_worker_payables(p_team_number bigint,p_worker_profile_id uuid) returns table(id uuid,payable_amount numeric(24,4),quantity numeric(18,4),worker_rate numeric(24,4),created_at timestamptz,work_entry_id uuid,remaining numeric(24,4)) language sql security definer stable set search_path='' as $$
select py.id,py.payable_amount,py.quantity,py.worker_rate,py.created_at,py.work_entry_id,greatest((py.payable_amount-coalesce((select sum(pm.payable_applied_amount) from public.contractor_team_worker_payments pm where pm.payable_id=py.id and pm.deleted_at is null),0)),0)::numeric(24,4) from public.contractor_team_worker_payables py join public.contractor_teams t on t.id=py.team_id where t.team_number=p_team_number and t.leader_profile_id=(select auth.uid()) and py.worker_profile_id=p_worker_profile_id order by py.created_at desc; $$;

revoke all on function public.get_contractor_team_finance_summary(bigint,timestamptz,timestamptz) from public,anon; grant execute on function public.get_contractor_team_finance_summary(bigint,timestamptz,timestamptz) to authenticated;
revoke all on function public.get_contractor_team_finance_workers(bigint,timestamptz,timestamptz) from public,anon; grant execute on function public.get_contractor_team_finance_workers(bigint,timestamptz,timestamptz) to authenticated;
revoke all on function public.get_contractor_team_worker_finance(bigint,uuid,timestamptz,timestamptz) from public,anon; grant execute on function public.get_contractor_team_worker_finance(bigint,uuid,timestamptz,timestamptz) to authenticated;
revoke all on function public.get_contractor_team_worker_payment_history(bigint,uuid,timestamptz,timestamptz) from public,anon; grant execute on function public.get_contractor_team_worker_payment_history(bigint,uuid,timestamptz,timestamptz) to authenticated;
revoke all on function public.get_contractor_team_worker_payables(bigint,uuid) from public,anon; grant execute on function public.get_contractor_team_worker_payables(bigint,uuid) to authenticated;