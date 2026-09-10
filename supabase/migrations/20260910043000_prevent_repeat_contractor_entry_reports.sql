create unique index if not exists contractor_team_work_entry_reports_one_per_entry
  on public.contractor_team_work_entry_reports (work_entry_id);

create or replace function private.submit_contractor_team_work_entry_report(p_entry_id uuid, p_note text)
returns table(report_id uuid, worker_profile_id uuid, status text)
language plpgsql
security definer
set search_path to ''
as $function$
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
  where r.work_entry_id=p_entry_id
  order by r.created_at asc,r.id asc
  limit 1;

  if v_report_id is not null then
    raise exception 'This Team Work entry has already been reported';
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
$function$;

drop function public.get_contractor_team_work_entries(bigint);

create function public.get_contractor_team_work_entries(p_team_number bigint)
returns table(
  id uuid,
  item_name text,
  size text[],
  quantity numeric,
  rate numeric,
  total numeric,
  special_note text,
  occurred_at timestamp with time zone,
  updated_at timestamp with time zone,
  worker_profile_id uuid,
  worker_display_name text,
  worker_username text,
  worker_avatar_url text
)
language sql
stable
security definer
set search_path to ''
as $function$
  select
    e.id,
    case
      when exists (
        select 1 from public.worker_team_work_entry_versions v
        where v.work_entry_id=e.id and v.revision_no>1
      ) then case
        when exists (
          select 1 from public.contractor_team_work_entry_reports r
          where r.work_entry_id=e.id
        ) then e.item_name || ' · REPORTED · Edited'
        else e.item_name || ' · Edited'
      end
      else case
        when exists (
          select 1 from public.contractor_team_work_entry_reports r
          where r.work_entry_id=e.id
        ) then e.item_name || ' · REPORTED'
        else e.item_name
      end
    end,
    e.size,e.quantity,e.rate,e.total,e.special_note,e.occurred_at,e.updated_at,
    e.worker_profile_id,p.display_name,p.username,p.avatar_url
  from public.worker_team_work_entries e
  join public.contractor_teams t on t.id=e.team_id
  join public.worker_profiles wp on wp.id=e.worker_profile_id
  left join public.profiles p on p.id=wp.profile_id
  where t.team_number=p_team_number
    and t.leader_profile_id=(select auth.uid())
    and e.lifecycle_state='active'
  order by e.occurred_at desc,e.id desc
  limit 100;
$function$;

grant execute on function public.get_contractor_team_work_entries(bigint) to authenticated;
