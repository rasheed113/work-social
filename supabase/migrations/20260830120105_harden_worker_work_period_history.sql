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
  with recursive
  params as (
    select
      p_period as period,
      p_timezone as timezone,
      greatest(1, least(coalesce(p_limit, 5), 10)) as limit_count,
      case p_period
        when 'day' then date_trunc('day', now() at time zone p_timezone) at time zone p_timezone
        when 'week' then date_trunc('week', now() at time zone p_timezone) at time zone p_timezone
        when 'month' then date_trunc('month', now() at time zone p_timezone) at time zone p_timezone
      end as current_bucket_start
  ),
  worker as (
    select wp.id as worker_profile_id
    from public.worker_profiles wp
    where wp.profile_id = (select auth.uid())
  ),
  oldest as (
    select e.occurred_at as oldest_occurred_at
    from public.work_entries e
    where e.worker_profile_id in (select worker_profile_id from worker)
      and e.lifecycle_state = 'active'
      and not exists (
        select 1
        from public.work_entry_hidden_for hidden
        where hidden.work_entry_id = e.id
          and hidden.profile_id = (select auth.uid())
      )
    order by e.occurred_at asc, e.id asc
    limit 1
  ),
  seed as (
    select
      case
        when p_cursor_start is null then p.current_bucket_start
        when p.period = 'day' then date_trunc('day', p_cursor_start at time zone p.timezone) at time zone p.timezone - interval '1 day'
        when p.period = 'week' then date_trunc('week', p_cursor_start at time zone p.timezone) at time zone p.timezone - interval '7 days'
        when p.period = 'month' then date_trunc('month', p_cursor_start at time zone p.timezone) at time zone p.timezone - interval '1 month'
      end as bucket_start,
      p.*
    from params p
    where p.period in ('day', 'week', 'month')
  ),
  walk as (
    select
      s.bucket_start,
      s.period,
      s.timezone,
      s.limit_count,
      case
        when o.oldest_occurred_at is null then 1
        when s.bucket_start < date_trunc(s.period, o.oldest_occurred_at at time zone s.timezone) at time zone s.timezone then 1
        else 0
      end as exhausted,
      case
        when exists (
          select 1
          from public.work_entries e
          where e.worker_profile_id in (select worker_profile_id from worker)
            and e.lifecycle_state = 'active'
            and e.occurred_at >= s.bucket_start
            and e.occurred_at < case s.period
              when 'day' then (s.bucket_start at time zone s.timezone + interval '1 day') at time zone s.timezone
              when 'week' then (s.bucket_start at time zone s.timezone + interval '7 days') at time zone s.timezone
              when 'month' then (s.bucket_start at time zone s.timezone + interval '1 month') at time zone s.timezone
            end
            and not exists (
              select 1
              from public.work_entry_hidden_for hidden
              where hidden.work_entry_id = e.id
                and hidden.profile_id = (select auth.uid())
            )
        ) then 1 else 0
      end as found_count,
      1 as step
    from seed s
    left join oldest o on true

    union all

    select
      next_bucket.bucket_start,
      w.period,
      w.timezone,
      w.limit_count,
      case
        when o.oldest_occurred_at is null then 1
        when next_bucket.bucket_start < date_trunc(w.period, o.oldest_occurred_at at time zone w.timezone) at time zone w.timezone then 1
        else 0
      end as exhausted,
      w.found_count + case
        when exists (
          select 1
          from public.work_entries e
          where e.worker_profile_id in (select worker_profile_id from worker)
            and e.lifecycle_state = 'active'
            and e.occurred_at >= next_bucket.bucket_start
            and e.occurred_at < w.bucket_start
            and not exists (
              select 1
              from public.work_entry_hidden_for hidden
              where hidden.work_entry_id = e.id
                and hidden.profile_id = (select auth.uid())
            )
        ) then 1 else 0
      end as found_count,
      w.step + 1
    from walk w
    cross join lateral (
      select case w.period
        when 'day' then (w.bucket_start at time zone w.timezone - interval '1 day') at time zone w.timezone
        when 'week' then (w.bucket_start at time zone w.timezone - interval '7 days') at time zone w.timezone
        when 'month' then (w.bucket_start at time zone w.timezone - interval '1 month') at time zone w.timezone
      end as bucket_start
    ) next_bucket
    left join oldest o on true
    where w.found_count < w.limit_count
      and w.exhausted = 0
  ),
  marked as (
    select
      w.*,
      w.found_count - lag(w.found_count, 1, 0) over (order by w.step) as newly_found
    from walk w
  ),
  selected as (
    select bucket_start, period, timezone
    from marked
    where newly_found > 0
  ),
  aggregated as (
    select
      s.bucket_start,
      case s.period
        when 'day' then (s.bucket_start at time zone s.timezone + interval '1 day') at time zone s.timezone
        when 'week' then (s.bucket_start at time zone s.timezone + interval '7 days') at time zone s.timezone
        when 'month' then (s.bucket_start at time zone s.timezone + interval '1 month') at time zone s.timezone
      end as bucket_end,
      sum(e.total)::numeric(24,4) as bucket_total
    from selected s
    join public.work_entries e
      on e.worker_profile_id in (select worker_profile_id from worker)
     and e.lifecycle_state = 'active'
     and e.occurred_at >= s.bucket_start
     and e.occurred_at < case s.period
       when 'day' then (s.bucket_start at time zone s.timezone + interval '1 day') at time zone s.timezone
       when 'week' then (s.bucket_start at time zone s.timezone + interval '7 days') at time zone s.timezone
       when 'month' then (s.bucket_start at time zone s.timezone + interval '1 month') at time zone s.timezone
     end
    where not exists (
      select 1
      from public.work_entry_hidden_for hidden
      where hidden.work_entry_id = e.id
        and hidden.profile_id = (select auth.uid())
    )
    group by s.bucket_start, s.period, s.timezone
  )
  select
    bucket_start as period_start,
    bucket_end as period_end,
    bucket_total as period_total
  from aggregated
  order by bucket_start desc
  limit (select limit_count from params);
$$;

revoke all on function public.get_worker_work_period_history(text, text, timestamptz, integer) from public, anon;
grant execute on function public.get_worker_work_period_history(text, text, timestamptz, integer) to authenticated;
