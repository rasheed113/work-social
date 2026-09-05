-- Salary Person foundation. Contract/work-per-job records remain untouched.
alter table public.worker_profiles
  add column if not exists worker_type text not null default 'contract'
  check (worker_type in ('salary_person','contract'));

create table if not exists public.salary_policies (
  id uuid primary key default gen_random_uuid(),
  worker_profile_id uuid not null references public.worker_profiles(id) on delete restrict,
  salary_amount numeric(24,4) not null check (salary_amount > 0),
  currency text not null check (char_length(currency) between 3 and 10),
  salary_type text not null check (salary_type in ('daily','weekly','15_days','monthly')),
  working_hours numeric(8,2) check (working_hours is null or working_hours > 0),
  overtime_multiplier numeric(4,2) not null default 1 check (overtime_multiplier in (1,1.5,2)),
  sunday_paid boolean not null default false,
  holidays_paid boolean not null default false,
  attendance_notification_time time,
  pay_date integer,
  salary_start_date date not null,
  total_salary numeric(24,4),
  basic_salary numeric(24,4),
  attendance_allowance numeric(24,4),
  other_allowance numeric(24,4),
  absent_rule text check (absent_rule is null or absent_rule in ('none','daily_salary')),
  salary_deduction_per_absent_day numeric(24,4),
  allowance_loss_rule text check (allowance_loss_rule is null or allowance_loss_rule in ('none','threshold')),
  allowance_loss_after_absences integer check (allowance_loss_after_absences is null or allowance_loss_after_absences > 0),
  leave_treatment text check (leave_treatment is null or leave_treatment in ('paid','unpaid')),
  custom_rule_note text,
  effective_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (total_salary is null or total_salary > 0),
  check (basic_salary is null or basic_salary >= 0),
  check (attendance_allowance is null or attendance_allowance >= 0),
  check (other_allowance is null or other_allowance >= 0),
  check (salary_deduction_per_absent_day is null or salary_deduction_per_absent_day >= 0),
  check ((allowance_loss_rule = 'threshold' and allowance_loss_after_absences is not null) or allowance_loss_rule is distinct from 'threshold')
);

create index if not exists salary_policies_worker_effective_idx on public.salary_policies(worker_profile_id, salary_start_date desc, created_at desc);

create table if not exists public.salary_attendance_records (
  id uuid primary key default gen_random_uuid(),
  worker_profile_id uuid not null references public.worker_profiles(id) on delete restrict,
  attendance_date date not null,
  status text not null check (status in ('present','absent','leave')),
  source text not null default 'manual' check (source in ('manual','notification')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(worker_profile_id, attendance_date)
);

create index if not exists salary_attendance_worker_date_idx on public.salary_attendance_records(worker_profile_id, attendance_date desc);

create table if not exists public.salary_overtime_records (
  id uuid primary key default gen_random_uuid(),
  worker_profile_id uuid not null references public.worker_profiles(id) on delete restrict,
  work_date date not null,
  hours numeric(10,2) not null check (hours >= 0),
  multiplier numeric(4,2) not null check (multiplier in (1,1.5,2)),
  hourly_rate numeric(24,8) not null check (hourly_rate >= 0),
  amount numeric(24,4) not null check (amount >= 0),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists salary_overtime_worker_date_idx on public.salary_overtime_records(worker_profile_id, work_date desc);

create table if not exists public.salary_bonus_policies (
  id uuid primary key default gen_random_uuid(),
  worker_profile_id uuid not null references public.worker_profiles(id) on delete restrict,
  frequency text not null check (frequency in ('yearly','6_months','3_months','custom')),
  expected_month_count integer not null check (expected_month_count > 0),
  amount_type text not null check (amount_type in ('half_salary','full_salary','fixed_amount')),
  fixed_amount numeric(24,4) check (fixed_amount is null or fixed_amount > 0),
  effective_from date not null,
  created_at timestamptz not null default now(),
  check ((frequency = 'yearly' and expected_month_count = 1) or (frequency = '6_months' and expected_month_count = 2) or (frequency = '3_months' and expected_month_count = 4) or frequency = 'custom'),
  check ((amount_type = 'fixed_amount' and fixed_amount is not null) or (amount_type <> 'fixed_amount' and fixed_amount is null))
);

create table if not exists public.salary_bonus_records (
  id uuid primary key default gen_random_uuid(),
  worker_profile_id uuid not null references public.worker_profiles(id) on delete restrict,
  bonus_date date not null,
  amount numeric(24,4) not null check (amount > 0),
  note text,
  policy_id uuid references public.salary_bonus_policies(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists salary_bonus_worker_date_idx on public.salary_bonus_records(worker_profile_id, bonus_date desc);

create table if not exists public.salary_periods (
  id uuid primary key default gen_random_uuid(),
  worker_profile_id uuid not null references public.worker_profiles(id) on delete restrict,
  period_start date not null,
  period_end date not null,
  status text not null default 'open' check (status in ('open','finalized')),
  base_salary numeric(24,4) not null default 0,
  overtime_amount numeric(24,4) not null default 0,
  adjustments numeric(24,4) not null default 0,
  bonus_amount numeric(24,4) not null default 0,
  final_amount numeric(24,4) not null default 0,
  policy_id uuid references public.salary_policies(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(worker_profile_id, period_start, period_end),
  check (period_end >= period_start)
);

create index if not exists salary_periods_worker_end_idx on public.salary_periods(worker_profile_id, period_end desc);

alter table public.salary_policies enable row level security;
alter table public.salary_attendance_records enable row level security;
alter table public.salary_overtime_records enable row level security;
alter table public.salary_bonus_policies enable row level security;
alter table public.salary_bonus_records enable row level security;
alter table public.salary_periods enable row level security;

grant select, insert, update on public.salary_policies to authenticated;
grant select, insert, update on public.salary_attendance_records to authenticated;
grant select, insert on public.salary_overtime_records to authenticated;
grant select, insert, update on public.salary_bonus_policies to authenticated;
grant select, insert on public.salary_bonus_records to authenticated;
grant select, insert, update on public.salary_periods to authenticated;

create or replace function public.current_worker_profile_id()
returns uuid language sql stable security invoker set search_path = '' as $$
  select wp.id from public.worker_profiles wp where wp.profile_id = (select auth.uid()) limit 1;
$$;
revoke all on function public.current_worker_profile_id() from public, anon;
grant execute on function public.current_worker_profile_id() to authenticated;

create policy salary_policies_own on public.salary_policies for all to authenticated
using (worker_profile_id = public.current_worker_profile_id())
with check (worker_profile_id = public.current_worker_profile_id());
create policy salary_attendance_own on public.salary_attendance_records for all to authenticated
using (worker_profile_id = public.current_worker_profile_id())
with check (worker_profile_id = public.current_worker_profile_id());
create policy salary_overtime_own on public.salary_overtime_records for all to authenticated
using (worker_profile_id = public.current_worker_profile_id())
with check (worker_profile_id = public.current_worker_profile_id());
create policy salary_bonus_policies_own on public.salary_bonus_policies for all to authenticated
using (worker_profile_id = public.current_worker_profile_id())
with check (worker_profile_id = public.current_worker_profile_id());
create policy salary_bonus_records_own on public.salary_bonus_records for all to authenticated
using (worker_profile_id = public.current_worker_profile_id())
with check (worker_profile_id = public.current_worker_profile_id());
create policy salary_periods_own on public.salary_periods for all to authenticated
using (worker_profile_id = public.current_worker_profile_id())
with check (worker_profile_id = public.current_worker_profile_id());

create or replace function public.get_salary_person_month_summary(p_month date)
returns table (
  month_start date,
  month_end date,
  base_salary numeric(24,4),
  overtime_hours numeric(10,2),
  overtime_amount numeric(24,4),
  adjustments numeric(24,4),
  bonus_amount numeric(24,4),
  present_days integer,
  absent_days integer,
  leave_days integer,
  paid_days integer,
  attendance_percentage numeric(8,4),
  final_salary numeric(24,4)
)
language sql stable security invoker set search_path = '' as $$
  with p as (
    select date_trunc('month', p_month)::date s, (date_trunc('month', p_month) + interval '1 month - 1 day')::date e,
           sp.salary_amount, sp.salary_type, sp.salary_deduction_per_absent_day, sp.absent_rule, sp.leave_treatment,
           sp.attendance_allowance, sp.allowance_loss_rule, sp.allowance_loss_after_absences
    from public.salary_policies sp
    where sp.worker_profile_id = public.current_worker_profile_id()
      and sp.salary_start_date <= (date_trunc('month', p_month) + interval '1 month - 1 day')::date
      and (sp.effective_to is null or sp.effective_to >= date_trunc('month', p_month)::date)
    order by sp.salary_start_date desc, sp.created_at desc limit 1
  ), a as (
    select count(*) filter(where r.status='present')::int present_days,
           count(*) filter(where r.status='absent')::int absent_days,
           count(*) filter(where r.status='leave')::int leave_days
    from public.salary_attendance_records r, p
    where r.worker_profile_id = public.current_worker_profile_id() and r.attendance_date between p.s and p.e
  ), o as (
    select coalesce(sum(hours),0)::numeric(10,2) overtime_hours, coalesce(sum(amount),0)::numeric(24,4) overtime_amount
    from public.salary_overtime_records r, p
    where r.worker_profile_id = public.current_worker_profile_id() and r.work_date between p.s and p.e
  ), b as (
    select coalesce(sum(amount),0)::numeric(24,4) bonus_amount
    from public.salary_bonus_records r, p
    where r.worker_profile_id = public.current_worker_profile_id() and r.bonus_date between p.s and p.e
  )
  select p.s, p.e,
    case p.salary_type when 'daily' then p.salary_amount * extract(day from (p.e-p.s+1)) when 'weekly' then p.salary_amount * extract(day from (p.e-p.s+1))/7 when '15_days' then p.salary_amount * extract(day from (p.e-p.s+1))/15 else p.salary_amount end::numeric(24,4),
    o.overtime_hours, o.overtime_amount,
    case when p.absent_rule='daily_salary' then -(coalesce(p.salary_deduction_per_absent_day,0) * a.absent_days) else 0 end::numeric(24,4),
    b.bonus_amount, a.present_days, a.absent_days, a.leave_days,
    (a.present_days + case when p.leave_treatment='paid' then a.leave_days else 0 end + case when p.salary_type='monthly' and p.salary_amount > 0 and p.salary_amount is not null and p.salary_amount >= 0 and p.salary_amount is not null and p.salary_amount is not null and p.salary_amount is not null then 0 else 0 end)::int,
    case when (a.present_days+a.absent_days+a.leave_days)>0 then (a.present_days::numeric/(a.present_days+a.absent_days+a.leave_days)*100)::numeric(8,4) else 0 end,
    (
      case p.salary_type when 'daily' then p.salary_amount * extract(day from (p.e-p.s+1)) when 'weekly' then p.salary_amount * extract(day from (p.e-p.s+1))/7 when '15_days' then p.salary_amount * extract(day from (p.e-p.s+1))/15 else p.salary_amount end
      + o.overtime_amount + b.bonus_amount
      + case when p.absent_rule='daily_salary' then -(coalesce(p.salary_deduction_per_absent_day,0) * a.absent_days) else 0 end
    )::numeric(24,4)
  from p cross join a cross join o cross join b;
$$;
revoke all on function public.get_salary_person_month_summary(date) from public, anon;
grant execute on function public.get_salary_person_month_summary(date) to authenticated;
