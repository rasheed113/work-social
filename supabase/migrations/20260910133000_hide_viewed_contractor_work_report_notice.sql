create or replace function private.get_worker_pending_contractor_work_entry_reports(p_team_number bigint default null)
returns table(
  report_id uuid,
  work_entry_id uuid,
  team_id bigint,
  team_number bigint,
  team_name text,
  contractor_profile_id uuid,
  contractor_display_name text,
  contractor_username text,
  note text,
  created_at timestamptz,
  item_name text,
  size text[],
  quantity numeric,
  rate numeric,
  total numeric,
  occurred_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select
    r.id,
    r.work_entry_id,
    r.team_id,
    t.team_number,
    t.name,
    r.contractor_profile_id,
    p.display_name,
    p.username,
    r.note,
    r.created_at,
    e.item_name,
    e.size,
    e.quantity,
    e.rate,
    e.total,
    e.occurred_at
  from public.contractor_team_work_entry_reports r
  join public.contractor_teams t on t.id=r.team_id
  join public.profiles p on p.id=r.contractor_profile_id
  join public.worker_team_work_entries e on e.id=r.work_entry_id
  where r.worker_profile_id=(select auth.uid())
    and r.status='pending'
    and e.lifecycle_state='active'
    and (p_team_number is null or t.team_number=p_team_number)
    and not exists (
      select 1
      from public.notifications n
      where n.receiver_id=(select auth.uid())
        and n.type='contractor_work_entry_report'
        and n.metadata->>'report_id'=r.id::text
        and n.is_read=true
    )
  order by r.created_at desc;
$$;
