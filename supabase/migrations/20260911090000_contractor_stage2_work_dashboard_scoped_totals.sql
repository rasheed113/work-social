-- Canonical Contractor Stage 2 Work Dashboard totals.
-- Keeps the proven contractor work formulas while adding an optional team scope.
-- p_team_id = null means all contractor-owned active work, including historical unassigned rows.
-- A concrete team scope includes only that real contractor-owned team.
create or replace function public.get_contractor_stage2_work_totals(
  p_team_id bigint default null,
  p_day_start timestamptz default null,
  p_day_end timestamptz default null,
  p_week_start timestamptz default null,
  p_week_end timestamptz default null,
  p_month_start timestamptz default null,
  p_month_end timestamptz default null
)
returns table(
  daily_total numeric(24,4),
  weekly_total numeric(24,4),
  monthly_total numeric(24,4),
  lifetime_total numeric(24,4),
  commission_total numeric(24,4)
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_team_id is not null and not exists (
    select 1
    from public.contractor_teams t
    where t.id = p_team_id
      and t.leader_profile_id = v_uid
  ) then
    raise exception 'Team not found or not owned by the authenticated contractor';
  end if;

  return query
  select
    coalesce(sum(case when e.occurred_at >= p_day_start and e.occurred_at < p_day_end then e.total else 0 end), 0)::numeric(24,4),
    coalesce(sum(case when e.occurred_at >= p_week_start and e.occurred_at < p_week_end then e.total else 0 end), 0)::numeric(24,4),
    coalesce(sum(case when e.occurred_at >= p_month_start and e.occurred_at < p_month_end then e.total else 0 end), 0)::numeric(24,4),
    coalesce(sum(e.total), 0)::numeric(24,4),
    coalesce(sum(e.pieces * coalesce(e.commission_per_piece, 0)), 0)::numeric(24,4)
  from public.contractor_work_entries e
  where e.profile_id = v_uid
    and (p_team_id is null or e.team_id = p_team_id);
end;
$$;

revoke all on function public.get_contractor_stage2_work_totals(bigint,timestamptz,timestamptz,timestamptz,timestamptz,timestamptz,timestamptz) from public, anon;
grant execute on function public.get_contractor_stage2_work_totals(bigint,timestamptz,timestamptz,timestamptz,timestamptz,timestamptz,timestamptz) to authenticated;
