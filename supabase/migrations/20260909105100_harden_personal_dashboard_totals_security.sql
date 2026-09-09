drop function if exists public.get_worker_work_totals(timestamptz, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz);

create or replace function public.get_worker_work_totals(
  p_day_start timestamptz,
  p_day_end timestamptz,
  p_week_start timestamptz,
  p_week_end timestamptz,
  p_month_start timestamptz,
  p_month_end timestamptz
)
returns table (
  daily_personal_total numeric(24,4), daily_team_total numeric(24,4), daily_total numeric(24,4),
  weekly_personal_total numeric(24,4), weekly_team_total numeric(24,4), weekly_total numeric(24,4),
  monthly_personal_total numeric(24,4), monthly_team_total numeric(24,4), monthly_total numeric(24,4),
  lifetime_personal_total numeric(24,4), lifetime_team_total numeric(24,4), lifetime_total numeric(24,4)
)
language sql
security invoker
stable
set search_path = ''
as $$
  with personal as (
    select
      coalesce(sum(e.total) filter (where e.occurred_at >= p_day_start and e.occurred_at < p_day_end), 0)::numeric(24,4) as daily_total,
      coalesce(sum(e.total) filter (where e.occurred_at >= p_week_start and e.occurred_at < p_week_end), 0)::numeric(24,4) as weekly_total,
      coalesce(sum(e.total) filter (where e.occurred_at >= p_month_start and e.occurred_at < p_month_end), 0)::numeric(24,4) as monthly_total,
      coalesce(sum(e.total), 0)::numeric(24,4) as lifetime_total
    from public.work_entries e
    where e.worker_profile_id in (select wp.id from public.worker_profiles wp where wp.profile_id = (select auth.uid()))
      and e.lifecycle_state = 'active'
  ),
  team as (
    select
      coalesce(sum(e.total) filter (where e.occurred_at >= p_day_start and e.occurred_at < p_day_end), 0)::numeric(24,4) as daily_total,
      coalesce(sum(e.total) filter (where e.occurred_at >= p_week_start and e.occurred_at < p_week_end), 0)::numeric(24,4) as weekly_total,
      coalesce(sum(e.total) filter (where e.occurred_at >= p_month_start and e.occurred_at < p_month_end), 0)::numeric(24,4) as monthly_total,
      coalesce(sum(e.total), 0)::numeric(24,4) as lifetime_total
    from public.worker_team_work_entries e
    where e.worker_profile_id in (select wp.id from public.worker_profiles wp where wp.profile_id = (select auth.uid()))
      and e.lifecycle_state = 'active'
  )
  select p.daily_total, t.daily_total, (p.daily_total + t.daily_total)::numeric(24,4),
         p.weekly_total, t.weekly_total, (p.weekly_total + t.weekly_total)::numeric(24,4),
         p.monthly_total, t.monthly_total, (p.monthly_total + t.monthly_total)::numeric(24,4),
         p.lifetime_total, t.lifetime_total, (p.lifetime_total + t.lifetime_total)::numeric(24,4)
  from personal p cross join team t;
$$;

revoke all on function public.get_worker_work_totals(timestamptz, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz) from public, anon;
grant execute on function public.get_worker_work_totals(timestamptz, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz) to authenticated;
