create or replace function public.invite_worker_to_contractor_team(p_team_number bigint,p_worker_profile_id uuid)
returns table(invitation_id uuid, worker_profile_id uuid, status text)
language plpgsql security definer set search_path=''
as $$
declare v_team_id bigint; v_inv uuid; v_status text;
begin
  select t.id into v_team_id from public.contractor_teams t where t.team_number=p_team_number and t.leader_profile_id=(select auth.uid());
  if v_team_id is null then raise exception 'Team not found or access denied'; end if;
  if p_worker_profile_id=(select auth.uid()) then raise exception 'Contractor cannot invite their own profile'; end if;
  if not exists(select 1 from public.worker_profiles w where w.profile_id=p_worker_profile_id) then raise exception 'Worker profile not found'; end if;
  if exists(select 1 from public.contractor_team_members m where m.team_id=v_team_id and m.profile_id=p_worker_profile_id) then raise exception 'Worker is already a team member'; end if;
  select i.id,i.status into v_inv,v_status from public.contractor_team_invitations i where i.team_id=v_team_id and i.worker_profile_id=p_worker_profile_id and i.status='pending' limit 1;
  if v_inv is not null then return query select v_inv,p_worker_profile_id,v_status; return; end if;
  insert into public.contractor_team_invitations(team_id,contractor_profile_id,worker_profile_id) values(v_team_id,(select auth.uid()),p_worker_profile_id) returning id into v_inv;
  select i.status into v_status from public.contractor_team_invitations i where i.id=v_inv;
  insert into public.notifications(receiver_id,sender_id,type,metadata) values(p_worker_profile_id,(select auth.uid()),'team_invitation',jsonb_build_object('invitation_id',v_inv,'team_number',p_team_number,'team_id',v_team_id,'action_state','pending'));
  return query select v_inv,p_worker_profile_id,v_status;
end;
$$;
revoke all on function public.invite_worker_to_contractor_team(bigint,uuid) from public,anon;
grant execute on function public.invite_worker_to_contractor_team(bigint,uuid) to authenticated;
