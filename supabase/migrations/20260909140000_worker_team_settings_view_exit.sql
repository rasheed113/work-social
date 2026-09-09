create table if not exists public.contractor_team_member_exit_requests (
  id uuid primary key default gen_random_uuid(),
  team_id bigint not null references public.contractor_teams(id) on delete cascade,
  worker_profile_id uuid not null references public.profiles(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists contractor_team_member_exit_requests_team_idx
  on public.contractor_team_member_exit_requests(team_id, created_at desc);
create index if not exists contractor_team_member_exit_requests_worker_idx
  on public.contractor_team_member_exit_requests(worker_profile_id, created_at desc);
alter table public.contractor_team_member_exit_requests enable row level security;
revoke all on public.contractor_team_member_exit_requests from public, anon, authenticated;

create or replace function public.get_worker_team_workspace_details(p_team_number bigint)
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
  joined_at timestamptz,
  member_profile_id uuid,
  member_display_name text,
  member_username text,
  member_avatar_url text,
  member_joined_at timestamptz
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
    owner_profile.display_name,
    owner_profile.username,
    owner_profile.avatar_url,
    current_member.joined_at,
    member_profile.id,
    member_profile.display_name,
    member_profile.username,
    member_profile.avatar_url,
    member.joined_at
  from public.contractor_team_members current_member
  join public.contractor_teams t on t.id = current_member.team_id
  left join public.profiles owner_profile on owner_profile.id = t.leader_profile_id
  left join public.contractor_team_members member on member.team_id = t.id
  left join public.profiles member_profile on member_profile.id = member.profile_id
  where current_member.profile_id = (select auth.uid())
    and t.team_number = p_team_number
  order by member.joined_at asc;
$$;
revoke all on function public.get_worker_team_workspace_details(bigint) from public, anon;
grant execute on function public.get_worker_team_workspace_details(bigint) to authenticated;

create or replace function public.leave_contractor_team(p_team_number bigint, p_reason text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_id bigint;
  v_profile_id uuid := (select auth.uid());
  v_reason text := nullif(left(trim(coalesce(p_reason, '')), 1000), '');
begin
  if v_profile_id is null then
    raise exception 'Authentication required';
  end if;

  select t.id into v_team_id
  from public.contractor_teams t
  join public.contractor_team_members m on m.team_id = t.id
  where t.team_number = p_team_number
    and m.profile_id = v_profile_id
  for update of t;

  if v_team_id is null then
    raise exception 'You are not an approved member of this team';
  end if;

  insert into public.contractor_team_member_exit_requests(team_id, worker_profile_id, reason)
  values(v_team_id, v_profile_id, v_reason);

  delete from public.contractor_team_members
  where team_id = v_team_id
    and profile_id = v_profile_id;

  return 'left';
end;
$$;
revoke all on function public.leave_contractor_team(bigint,text) from public, anon;
grant execute on function public.leave_contractor_team(bigint,text) to authenticated;
