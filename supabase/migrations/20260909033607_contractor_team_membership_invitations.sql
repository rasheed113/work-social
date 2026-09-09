alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type = any (array['like','comment','comment_reply','mention_post','mention_comment','follow','message','friend_request','friend_accept','attendance_reminder','team_invitation']));

create table if not exists public.contractor_team_invitations (
  id uuid primary key default gen_random_uuid(),
  team_id bigint not null references public.contractor_teams(id) on delete cascade,
  contractor_profile_id uuid not null references public.profiles(id) on delete cascade,
  worker_profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (team_id, worker_profile_id)
);
create index if not exists contractor_team_invitations_worker_idx on public.contractor_team_invitations(worker_profile_id,status,created_at desc);
create index if not exists contractor_team_invitations_team_idx on public.contractor_team_invitations(team_id,status,created_at desc);
alter table public.contractor_team_invitations enable row level security;
grant select on public.contractor_team_invitations to authenticated;
create policy contractor_team_invitations_worker_select on public.contractor_team_invitations for select to authenticated using ((select auth.uid()) = worker_profile_id);
create policy contractor_team_invitations_contractor_select on public.contractor_team_invitations for select to authenticated using ((select auth.uid()) = contractor_profile_id);

create table if not exists public.contractor_team_members (
  id uuid primary key default gen_random_uuid(),
  team_id bigint not null references public.contractor_teams(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique(team_id,profile_id)
);
create index if not exists contractor_team_members_team_idx on public.contractor_team_members(team_id,joined_at desc);
create index if not exists contractor_team_members_profile_idx on public.contractor_team_members(profile_id,joined_at desc);
alter table public.contractor_team_members enable row level security;
grant select on public.contractor_team_members to authenticated;
create policy contractor_team_members_select_involved on public.contractor_team_members for select to authenticated using ((select auth.uid()) = profile_id or exists (select 1 from public.contractor_teams t where t.id=team_id and t.leader_profile_id=(select auth.uid())));

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
  insert into public.contractor_team_invitations(team_id,contractor_profile_id,worker_profile_id) values(v_team_id,(select auth.uid()),p_worker_profile_id) returning id,status into v_inv,v_status;
  insert into public.notifications(receiver_id,sender_id,type,metadata) values(p_worker_profile_id,(select auth.uid()),'team_invitation',jsonb_build_object('invitation_id',v_inv,'team_number',p_team_number,'team_id',v_team_id,'action_state','pending'));
  return query select v_inv,p_worker_profile_id,v_status;
end;
$$;
revoke all on function public.invite_worker_to_contractor_team(bigint,uuid) from public,anon;
grant execute on function public.invite_worker_to_contractor_team(bigint,uuid) to authenticated;

create or replace function public.respond_to_contractor_team_invitation(p_invitation_id uuid,p_accept boolean)
returns text
language plpgsql security definer set search_path=''
as $$
declare v_team_id bigint; v_status text;
begin
  select i.team_id,i.status into v_team_id,v_status from public.contractor_team_invitations i where i.id=p_invitation_id and i.worker_profile_id=(select auth.uid()) for update;
  if v_team_id is null then raise exception 'Invitation not found'; end if;
  if v_status <> 'pending' then return v_status; end if;
  if p_accept then
    insert into public.contractor_team_members(team_id,profile_id) values(v_team_id,(select auth.uid())) on conflict(team_id,profile_id) do nothing;
    update public.contractor_team_invitations set status='accepted',responded_at=now() where id=p_invitation_id;
    update public.notifications set is_read=true,metadata=metadata || jsonb_build_object('action_state','accepted') where receiver_id=(select auth.uid()) and type='team_invitation' and metadata->>'invitation_id'=p_invitation_id::text;
    return 'accepted';
  else
    update public.contractor_team_invitations set status='declined',responded_at=now() where id=p_invitation_id;
    update public.notifications set is_read=true,metadata=metadata || jsonb_build_object('action_state','declined') where receiver_id=(select auth.uid()) and type='team_invitation' and metadata->>'invitation_id'=p_invitation_id::text;
    return 'declined';
  end if;
end;
$$;
revoke all on function public.respond_to_contractor_team_invitation(uuid,boolean) from public,anon;
grant execute on function public.respond_to_contractor_team_invitation(uuid,boolean) to authenticated;

create or replace function public.get_contractor_team_member_status(p_team_number bigint,p_worker_profile_id uuid)
returns text
language sql security definer set search_path=''
as $$
  select case
    when exists(select 1 from public.contractor_team_members m join public.contractor_teams t on t.id=m.team_id where t.team_number=p_team_number and m.profile_id=p_worker_profile_id) then 'member'
    when exists(select 1 from public.contractor_team_invitations i join public.contractor_teams t on t.id=i.team_id where t.team_number=p_team_number and i.worker_profile_id=p_worker_profile_id and i.status='pending') then 'pending'
    else 'available'
  end;
$$;
revoke all on function public.get_contractor_team_member_status(bigint,uuid) from public,anon;
grant execute on function public.get_contractor_team_member_status(bigint,uuid) to authenticated;
