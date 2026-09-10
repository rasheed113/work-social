alter table public.contractor_team_work_entry_reports
  drop constraint if exists contractor_team_work_entry_reports_worker_profile_id_fkey;

alter table public.contractor_team_work_entry_reports
  add constraint contractor_team_work_entry_reports_worker_profile_id_fkey
  foreign key (worker_profile_id) references public.worker_profiles(id) on delete cascade;

drop policy if exists "Workers can view their own contractor reports" on public.contractor_team_work_entry_reports;
create policy "Workers can view their own contractor reports"
on public.contractor_team_work_entry_reports
for select to authenticated
using (
  exists (
    select 1
    from public.worker_profiles wp
    where wp.id = worker_profile_id
      and wp.profile_id = (select auth.uid())
  )
);

create or replace function private.submit_contractor_team_work_entry_report(p_entry_id uuid, p_note text)
returns table(report_id uuid, worker_profile_id uuid, status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_id bigint;
  v_worker uuid;
  v_worker_profile_id uuid;
  v_report_id uuid;
  v_status text;
  v_team_number bigint;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_entry_id is null or char_length(btrim(coalesce(p_note,''))) = 0 then raise exception 'A report note is required'; end if;

  select e.team_id,e.worker_profile_id,wp.profile_id,t.team_number
    into v_team_id,v_worker,v_worker_profile_id,v_team_number
  from public.worker_team_work_entries e
  join public.worker_profiles wp on wp.id=e.worker_profile_id
  join public.contractor_teams t on t.id=e.team_id
  where e.id=p_entry_id
    and e.lifecycle_state='active'
    and t.leader_profile_id=(select auth.uid());

  if v_team_id is null or v_worker_profile_id is null then
    raise exception 'This Team Work entry is not available to report';
  end if;

  select r.id,r.status
    into v_report_id,v_status
  from public.contractor_team_work_entry_reports r
  where r.work_entry_id=p_entry_id and r.status='pending'
  limit 1;

  if v_report_id is not null then
    return query select v_report_id,v_worker,v_status;
    return;
  end if;

  insert into public.contractor_team_work_entry_reports(
    team_id,work_entry_id,contractor_profile_id,worker_profile_id,note
  ) values (
    v_team_id,p_entry_id,(select auth.uid()),v_worker,btrim(p_note)
  )
  returning public.contractor_team_work_entry_reports.id,
            public.contractor_team_work_entry_reports.status
  into v_report_id,v_status;

  perform public.create_notification(
    v_worker_profile_id,
    (select auth.uid()),
    'contractor_work_entry_report',
    null,
    null,
    jsonb_build_object(
      'report_id',v_report_id,
      'work_entry_id',p_entry_id,
      'team_id',v_team_id,
      'team_number',v_team_number,
      'worker_profile_id',v_worker,
      'worker_user_id',v_worker_profile_id,
      'action_state','pending',
      'note',btrim(p_note)
    )
  );

  return query select v_report_id,v_worker,v_status;
end;
$$;

create or replace function private.decline_contractor_team_work_entry_report(p_report_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_worker uuid;
  v_notification uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;

  update public.contractor_team_work_entry_reports r
  set status='declined',resolved_at=now(),resolved_by=(select auth.uid())
  from public.worker_profiles wp
  where r.id=p_report_id
    and r.worker_profile_id=wp.id
    and wp.profile_id=(select auth.uid())
    and r.status='pending'
  returning r.worker_profile_id into v_worker;

  if v_worker is null then return false; end if;

  select n.id into v_notification
  from public.notifications n
  where n.receiver_id=(select auth.uid())
    and n.type='contractor_work_entry_report'
    and n.metadata->>'report_id'=p_report_id::text
  order by n.created_at desc
  limit 1;

  if v_notification is not null then
    update public.notifications
    set is_read=true,
        metadata=jsonb_set(coalesce(metadata,'{}'::jsonb),'{action_state}','"declined"'::jsonb,true)
    where id=v_notification;
  end if;

  return true;
end;
$$;

create or replace function private.get_worker_pending_contractor_work_entry_reports(p_team_number bigint default null)
returns table(
  report_id uuid, work_entry_id uuid, team_id bigint, team_number bigint, team_name text,
  contractor_profile_id uuid, contractor_display_name text, contractor_username text,
  note text, created_at timestamptz, item_name text, size text[], quantity numeric,
  rate numeric, total numeric, occurred_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select r.id,r.work_entry_id,r.team_id,t.team_number,t.name,
         r.contractor_profile_id,p.display_name,p.username,r.note,r.created_at,
         e.item_name,e.size,e.quantity,e.rate,e.total,e.occurred_at
  from public.contractor_team_work_entry_reports r
  join public.worker_profiles wp on wp.id=r.worker_profile_id
  join public.contractor_teams t on t.id=r.team_id
  join public.profiles p on p.id=r.contractor_profile_id
  join public.worker_team_work_entries e on e.id=r.work_entry_id
  where wp.profile_id=(select auth.uid())
    and r.status='pending'
    and e.lifecycle_state='active'
    and (p_team_number is null or t.team_number=p_team_number)
  order by r.created_at desc;
$$;
