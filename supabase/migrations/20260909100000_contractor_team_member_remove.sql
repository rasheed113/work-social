create or replace function public.remove_contractor_team_member(p_team_number bigint,p_worker_profile_id uuid)
returns text
language plpgsql
security definer
set search_path=''
as $$
declare
  v_team_id bigint;
  v_member_exists boolean;
  v_pending_invitation_id uuid;
begin
  select t.id into v_team_id
  from public.contractor_teams t
  where t.team_number=p_team_number
    and t.leader_profile_id=(select auth.uid());

  if v_team_id is null then
    raise exception 'Team not found or access denied';
  end if;

  if p_worker_profile_id=(select auth.uid()) then
    raise exception 'Contractor cannot remove their own profile';
  end if;

  select exists(
    select 1 from public.contractor_team_members m
    where m.team_id=v_team_id and m.profile_id=p_worker_profile_id
  ) into v_member_exists;

  if v_member_exists then
    delete from public.contractor_team_members
    where team_id=v_team_id and profile_id=p_worker_profile_id;

    return 'removed';
  end if;

  select i.id into v_pending_invitation_id
  from public.contractor_team_invitations i
  where i.team_id=v_team_id
    and i.worker_profile_id=p_worker_profile_id
    and i.status='pending'
  order by i.created_at desc
  limit 1
  for update;

  if v_pending_invitation_id is not null then
    update public.contractor_team_invitations
    set status='cancelled',responded_at=now()
    where id=v_pending_invitation_id;

    update public.notifications
    set is_read=true,
        metadata=metadata || jsonb_build_object('action_state','cancelled')
    where receiver_id=p_worker_profile_id
      and type='team_invitation'
      and metadata->>'invitation_id'=v_pending_invitation_id::text;

    return 'cancelled';
  end if;

  return 'not_found';
end;
$$;

revoke all on function public.remove_contractor_team_member(bigint,uuid) from public,anon;
grant execute on function public.remove_contractor_team_member(bigint,uuid) to authenticated;
