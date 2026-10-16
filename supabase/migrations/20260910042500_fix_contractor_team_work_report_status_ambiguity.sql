create or replace function private.submit_contractor_team_work_entry_report(p_entry_id uuid, p_note text)
returns table(report_id uuid, worker_profile_id uuid, status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_id bigint;
  v_worker uuid;
  v_report_id uuid;
  v_status text;
  v_team_number bigint;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_entry_id is null or char_length(btrim(coalesce(p_note,''))) = 0 then raise exception 'A report note is required'; end if;

  select e.team_id,e.worker_profile_id,t.team_number into v_team_id,v_worker,v_team_number
  from public.worker_team_work_entries e
  join public.contractor_teams t on t.id=e.team_id
  where e.id=p_entry_id and e.lifecycle_state='active' and t.leader_profile_id=(select auth.uid());

  if v_team_id is null then raise exception 'This Team Work entry is not available to report'; end if;

  select r.id,r.status into v_report_id,v_status
  from public.contractor_team_work_entry_reports r
  where r.work_entry_id=p_entry_id and r.status='pending'
  limit 1;

  if v_report_id is not null then return query select v_report_id,v_worker,v_status; return; end if;

  insert into public.contractor_team_work_entry_reports(team_id,work_entry_id,contractor_profile_id,worker_profile_id,note)
  values(v_team_id,p_entry_id,(select auth.uid()),v_worker,btrim(p_note))
  returning public.contractor_team_work_entry_reports.id, public.contractor_team_work_entry_reports.status into v_report_id,v_status;

  perform public.create_notification(v_worker,(select auth.uid()),'contractor_work_entry_report',null,null,
    jsonb_build_object('report_id',v_report_id,'work_entry_id',p_entry_id,'team_id',v_team_id,'team_number',v_team_number,'worker_profile_id',v_worker,'action_state','pending','note',btrim(p_note)));

  return query select v_report_id,v_worker,v_status;
end;
$$;
