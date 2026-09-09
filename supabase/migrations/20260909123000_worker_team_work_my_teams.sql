create or replace function public.get_worker_team_work_teams()
returns table(
  team_id bigint,
  team_number bigint,
  team_name text,
  team_purpose text,
  team_created_at timestamptz,
  leader_profile_id uuid,
  leader_display_name text,
  leader_username text,
  leader_avatar_url text,
  joined_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select
    t.id,
    t.team_number,
    t.name,
    t.purpose,
    t.created_at,
    t.leader_profile_id,
    p.display_name,
    p.username,
    p.avatar_url,
    m.joined_at
  from public.contractor_team_members m
  join public.contractor_teams t on t.id = m.team_id
  left join public.profiles p on p.id = t.leader_profile_id
  where m.profile_id = (select auth.uid())
  order by m.joined_at desc, t.created_at desc;
$$;

revoke all on function public.get_worker_team_work_teams() from public, anon;
grant execute on function public.get_worker_team_work_teams() to authenticated;
