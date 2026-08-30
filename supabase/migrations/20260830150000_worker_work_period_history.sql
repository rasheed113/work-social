create or replace function public.get_worker_work_period_history(
  p_period text,
  p_timezone text,
  p_cursor_start timestamptz default null,
  p_limit integer default 5
)
returns table (
  period_start timestamptz,
  period_end timestamptz,
  period_total numeric(24,4)
)
language sql
security invoker
stable
set search_path = ''
as $$
  with worker_entries as (
    select
      e.occurred_at,
      e.total
    from public.work_entries e
    where e.worker_profile_id in (
      select wp.id
      from public.worker_profiles wp
      where wp.profile_id = (select auth.uid())
    )
      and e.lifecycle_state = 'active'
      and not exists (
        select 1
        from public.work_entry_hidden_for hidden
        where hidden.work_entry_id = e.id
          and hidden.profile_id = (select auth.uid())
      )
  ),
  bucketed as (
    select
      case p_period
        when 'day' then date_trunc('day', occurred_at at time zone p_timezone)
        when 'week' then date_trunc('week', occurred_at at time zone p_timezone)
        when 'month' then date_trunc('month', occurred_at at time zone p_timezone)
      end as bucket_local,
      total
    from worker_entries
    where p_period in ('day', 'week', 'month')
  ),
  grouped as (
    select
      bucket_local at time zone p_timezone as bucket_start,
      sum(total)::numeric(24,4) as bucket_total
    from bucketed
    where bucket_local is not null
    group by bucket_local
  ),
  bounded as (
    select
      g.bucket_start,
      g.bucket_total,
      case p_period
        when 'day' then (g.bucket_start at time zone p_timezone + interval '1 day') at time zone p_timezone
        when 'week' then (g.bucket_start at time zone p_timezone + interval '7 days') at time zone p_timezone
        when 'month' then (g.bucket_start at time zone p_timezone + interval '1 month') at time zone p_timezone
      end as bucket_end,
      case p_period
        when 'day' then date_trunc('day', now() at time zone p_timezone) at time zone p_timezone
        when 'week' then date_trunc('week', now() at time zone p_timezone) at time zone p_timezone
        when 'month' then date_trunc('month', now() at time zone p_timezone) at time zone p_timezone
      end as current_bucket_start
    from grouped g
  )
  select
    bucket_start as period_start,
    bucket_end as period_end,
    bucket_total as period_total
  from bounded
  where bucket_start <= current_bucket_start
    and (p_cursor_start is null or bucket_start < p_cursor_start)
  order by bucket_start desc
  limit greatest(1, least(p_limit, 10));
$$;

revoke all on function public.get_worker_work_period_history(text, text, timestamptz, integer) from public, anon;
grant execute on function public.get_worker_work_period_history(text, text, timestamptz, integer) to authenticated;
