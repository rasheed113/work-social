create or replace function public.get_worker_finance_summary()
returns table (
  total_earnings numeric(24,4),
  received numeric(24,4),
  remaining numeric(24,4)
)
language sql
security invoker
stable
set search_path = ''
as $$
  with earnings as (
    select coalesce(sum(e.total), 0)::numeric(24,4) as total_earnings
    from public.work_entries e
    where e.lifecycle_state = 'active'
      and e.worker_profile_id in (
        select wp.id from public.worker_profiles wp
        where wp.profile_id = (select auth.uid())
      )
      and not exists (
        select 1 from public.work_entry_hidden_for hidden
        where hidden.work_entry_id = e.id
          and hidden.profile_id = (select auth.uid())
      )
  ), received as (
    select coalesce(sum(r.amount), 0)::numeric(24,4) as received
    from public.worker_finance_received r
    where r.worker_profile_id in (
      select wp.id from public.worker_profiles wp
      where wp.profile_id = (select auth.uid())
    )
  )
  select
    earnings.total_earnings,
    received.received,
    (earnings.total_earnings - received.received)::numeric(24,4) as remaining
  from earnings cross join received;
$$;

revoke all on function public.get_worker_finance_summary() from public, anon;
grant execute on function public.get_worker_finance_summary() to authenticated;
