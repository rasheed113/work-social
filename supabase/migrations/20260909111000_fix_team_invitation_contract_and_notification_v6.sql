create or replace function public.invite_worker_to_contractor_team(p_team_number bigint, p_worker_profile_id uuid)
returns table(invitation_id uuid, status text)
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_team_id bigint;
  v_invitation_id uuid;
  v_invitation_status text;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required';
  end if;

  select t.id into v_team_id
  from public.contractor_teams as t
  where t.team_number = p_team_number
    and t.leader_profile_id = (select auth.uid())
  limit 1;

  if v_team_id is null then
    raise exception 'team not found or not owned by current user';
  end if;

  if p_worker_profile_id = (select auth.uid()) then
    raise exception 'contractor cannot invite their own profile';
  end if;

  if not exists (
    select 1 from public.worker_profiles as wp
    where wp.profile_id = p_worker_profile_id
  ) then
    raise exception 'worker not found';
  end if;

  if exists (
    select 1 from public.contractor_team_members as tm
    where tm.team_id = v_team_id
      and tm.profile_id = p_worker_profile_id
  ) then
    raise exception 'worker is already a member of this team';
  end if;

  if exists (
    select 1 from public.contractor_team_invitations as pending_invitation
    where pending_invitation.team_id = v_team_id
      and pending_invitation.worker_profile_id = p_worker_profile_id
      and pending_invitation.status = 'pending'
  ) then
    raise exception 'invitation already pending';
  end if;

  insert into public.contractor_team_invitations (
    team_id, contractor_profile_id, worker_profile_id, status
  ) values (
    v_team_id, (select auth.uid()), p_worker_profile_id, 'pending'
  )
  returning contractor_team_invitations.id,
            contractor_team_invitations.status
  into v_invitation_id, v_invitation_status;

  insert into public.notifications (
    receiver_id, sender_id, type, metadata
  ) values (
    p_worker_profile_id,
    (select auth.uid()),
    'team_invitation',
    jsonb_build_object(
      'invitation_id', v_invitation_id,
      'team_number', p_team_number,
      'team_id', v_team_id,
      'action_state', 'pending'
    )
  );

  return query select v_invitation_id, v_invitation_status;
end;
$$;

revoke all on function public.invite_worker_to_contractor_team(bigint, uuid) from public, anon;
grant execute on function public.invite_worker_to_contractor_team(bigint, uuid) to authenticated;
