-- Salary Person calculator hardening: overtime values are derived from the active saved policy.
-- The client supplies only the work date and hours; multiplier, hourly rate and amount are authoritative server-side.
create or replace function public.apply_salary_overtime_calculation() returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  p record;
  days_in_month integer;
  daily_rate numeric(24,8);
begin
  select sp.salary_amount, sp.salary_type, sp.working_hours, sp.overtime_multiplier
    into p
  from public.salary_policies sp
  where sp.worker_profile_id = new.worker_profile_id
    and sp.salary_start_date <= new.work_date
    and (sp.effective_to is null or sp.effective_to >= new.work_date)
  order by sp.salary_start_date desc, sp.created_at desc
  limit 1;

  if p is null then
    raise exception 'No salary policy is active for overtime date %', new.work_date;
  end if;
  if p.working_hours is null or p.working_hours <= 0 then
    raise exception 'Working hours must be configured before overtime can be calculated';
  end if;

  days_in_month := extract(day from (date_trunc('month', new.work_date) + interval '1 month - 1 day'))::integer;
  daily_rate := case p.salary_type
    when 'daily' then p.salary_amount
    when 'weekly' then p.salary_amount / 7
    when '15_days' then p.salary_amount / 15
    when 'monthly' then p.salary_amount / days_in_month
  end;

  new.multiplier := p.overtime_multiplier;
  new.hourly_rate := daily_rate / p.working_hours;
  new.amount := new.hours * new.multiplier * new.hourly_rate;
  return new;
end;
$$;

revoke all on function public.apply_salary_overtime_calculation() from public, anon, authenticated;

drop trigger if exists salary_overtime_calculate on public.salary_overtime_records;
create trigger salary_overtime_calculate
before insert or update of worker_profile_id, work_date, hours
on public.salary_overtime_records
for each row execute function public.apply_salary_overtime_calculation();

-- Keep monthly summaries policy-driven as well. Absence deduction and attendance-allowance loss
-- are applied only when the corresponding optional policy rule was selected.
create or replace function public.get_salary_person_month_summary(p_month date) returns table (month_start date, month_end date, base_salary numeric(24,4), overtime_hours numeric(10,2), overtime_amount numeric(24,4), adjustments numeric(24,4), bonus_amount numeric(24,4), present_days integer, absent_days integer, leave_days integer, paid_days integer, attendance_percentage numeric(8,4), final_salary numeric(24,4)) language sql stable security invoker set search_path = '' as $$
with p as (
  select date_trunc('month',p_month)::date s,
         (date_trunc('month',p_month)+interval '1 month - 1 day')::date e,
         sp.salary_amount,sp.salary_type,sp.salary_deduction_per_absent_day,sp.absent_rule,
         sp.leave_treatment,sp.attendance_allowance,sp.allowance_loss_rule,sp.allowance_loss_after_absences,
         sp.total_salary,sp.other_allowance
  from public.salary_policies sp
  where sp.worker_profile_id=public.current_worker_profile_id()
    and sp.salary_start_date <= (date_trunc('month',p_month)+interval '1 month - 1 day')::date
    and (sp.effective_to is null or sp.effective_to >= date_trunc('month',p_month)::date)
  order by sp.salary_start_date desc,sp.created_at desc limit 1
),a as (
  select count(*) filter(where r.status='present')::int present_days,
         count(*) filter(where r.status='absent')::int absent_days,
         count(*) filter(where r.status='leave')::int leave_days
  from public.salary_attendance_records r,p
  where r.worker_profile_id=public.current_worker_profile_id() and r.attendance_date between p.s and p.e
),o as (
  select coalesce(sum(hours),0)::numeric(10,2) overtime_hours,
         coalesce(sum(amount),0)::numeric(24,4) overtime_amount
  from public.salary_overtime_records r,p
  where r.worker_profile_id=public.current_worker_profile_id() and r.work_date between p.s and p.e
),b as (
  select coalesce(sum(amount),0)::numeric(24,4) bonus_amount
  from public.salary_bonus_records r,p
  where r.worker_profile_id=public.current_worker_profile_id() and r.bonus_date between p.s and p.e
),d as (
  select p.*,a.present_days,a.absent_days,a.leave_days,o.overtime_hours,o.overtime_amount,b.bonus_amount,
    (select count(*)::int from generate_series(p.s,p.e,'1 day') g(day)
      where extract(isodow from g.day)=7 and p.sunday_paid
        and not exists(select 1 from public.salary_attendance_records ar where ar.worker_profile_id=public.current_worker_profile_id() and ar.attendance_date=g.day and ar.status in ('absent','leave'))) sunday_paid_days
  from p cross join a cross join o cross join b
),c as (
  select d.*,
    (d.present_days+case when d.leave_treatment='paid' then d.leave_days else 0 end+d.sunday_paid_days)::int paid_days_calc,
    case d.salary_type
      when 'daily' then d.salary_amount*(d.present_days+case when d.leave_treatment='paid' then d.leave_days else 0 end+d.sunday_paid_days)
      when 'weekly' then d.salary_amount*(d.present_days+case when d.leave_treatment='paid' then d.leave_days else 0 end+d.sunday_paid_days)/7
      when '15_days' then d.salary_amount*(d.present_days+case when d.leave_treatment='paid' then d.leave_days else 0 end+d.sunday_paid_days)/15
      else d.salary_amount end earned_base,
    case when d.allowance_loss_rule='threshold' and d.allowance_loss_after_absences is not null and d.absent_days>=d.allowance_loss_after_absences then -coalesce(d.attendance_allowance,0) else 0 end allowance_adjustment,
    case when d.absent_rule='daily_salary' then -(coalesce(d.salary_deduction_per_absent_day,0)*d.absent_days) else 0 end absence_adjustment
  from d
),r as (select c.*,coalesce(c.total_salary,c.earned_base) configured_base from c)
select s,e,round(configured_base,4)::numeric(24,4),overtime_hours,overtime_amount,
       round(absence_adjustment+allowance_adjustment+coalesce(other_allowance,0),4)::numeric(24,4),
       bonus_amount,present_days,absent_days,leave_days,paid_days_calc,
       case when (present_days+absent_days+leave_days)>0 then round(present_days::numeric/(present_days+absent_days+leave_days)*100,4) else 0 end::numeric(8,4),
       round(configured_base+absence_adjustment+allowance_adjustment+coalesce(other_allowance,0)+overtime_amount+bonus_amount,4)::numeric(24,4)
from r;
$$;

revoke all on function public.get_salary_person_month_summary(date) from public,anon;
grant execute on function public.get_salary_person_month_summary(date) to authenticated;
