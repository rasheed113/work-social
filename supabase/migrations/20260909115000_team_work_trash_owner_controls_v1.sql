drop function if exists public.get_worker_team_work_context(bigint);
create function public.get_worker_team_work_context(p_team_number bigint) returns table(team_id bigint,team_number bigint,team_name text,team_purpose text,leader_profile_id uuid,leader_display_name text,leader_username text,leader_avatar_url text,worker_profile_id uuid,is_team_owner boolean) language sql security definer stable set search_path='' as $$
  select t.id,t.team_number,t.name,t.purpose,t.leader_profile_id,p.display_name,p.username,p.avatar_url,wp.id,(t.leader_profile_id=(select auth.uid()))
  from public.contractor_teams t
  join public.contractor_team_members m on m.team_id=t.id and m.profile_id=(select auth.uid())
  join public.worker_profiles wp on wp.profile_id=(select auth.uid())
  left join public.profiles p on p.id=t.leader_profile_id
  where t.team_number=p_team_number;
$$;

create or replace function public.restore_worker_team_work_entry(p_entry_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
  update public.worker_team_work_entries e set lifecycle_state='active',updated_at=now()
  where e.id=p_entry_id and e.lifecycle_state='trashed'
    and exists (select 1 from public.contractor_teams t where t.id=e.team_id and t.leader_profile_id=(select auth.uid()));
  return found;
end;
$$;

create or replace function public.delete_worker_team_work_entry_permanently(p_entry_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
  delete from public.worker_team_work_entries e
  where e.id=p_entry_id and e.lifecycle_state='trashed'
    and exists (select 1 from public.contractor_teams t where t.id=e.team_id and t.leader_profile_id=(select auth.uid()));
  return found;
end;
$$;

create or replace function public.get_worker_team_work_trash(p_team_number bigint)
returns table(id uuid,item_name text,size text[],quantity numeric,rate numeric,total numeric,special_note text,occurred_at timestamptz,updated_at timestamptz,worker_profile_id uuid)
language sql security definer stable set search_path='' as $$
  select e.id,e.item_name,e.size,e.quantity,e.rate,e.total,e.special_note,e.occurred_at,e.updated_at,e.worker_profile_id
  from public.worker_team_work_entries e
  join public.contractor_teams t on t.id=e.team_id
  where t.team_number=p_team_number and e.lifecycle_state='trashed'
    and ((e.worker_profile_id in (select wp.id from public.worker_profiles wp where wp.profile_id=(select auth.uid()))
          and exists(select 1 from public.contractor_team_members m where m.team_id=e.team_id and m.profile_id=(select auth.uid())))
         or t.leader_profile_id=(select auth.uid()))
  order by e.updated_at desc,e.id desc;
$$;

revoke all on function public.get_worker_team_work_context(bigint),public.restore_worker_team_work_entry(uuid),public.delete_worker_team_work_entry_permanently(uuid),public.get_worker_team_work_trash(bigint) from public,anon;
grant execute on function public.get_worker_team_work_context(bigint),public.restore_worker_team_work_entry(uuid),public.delete_worker_team_work_entry_permanently(uuid),public.get_worker_team_work_trash(bigint) to authenticated;
