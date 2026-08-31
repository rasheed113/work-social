create or replace function public.save_worker_diary_entry(
  p_id uuid default null,
  p_entry_type text default 'note',
  p_title text default null,
  p_content text default '',
  p_completed boolean default null,
  p_event_start_at timestamptz default null,
  p_event_end_at timestamptz default null,
  p_event_timezone text default null,
  p_reminder_enabled boolean default false,
  p_reminder_scheduled_at timestamptz default null,
  p_reminder_timezone text default null,
  p_reminder_mode text default 'custom',
  p_reminder_offset_minutes integer default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  owner_id uuid;
  entry_id uuid;
  existing_type text;
  event_timezone_ok boolean;
  reminder_kind text;
begin
  select id into owner_id
  from public.worker_profiles
  where profile_id = (select auth.uid())
  limit 1;
  if owner_id is null then raise exception 'Worker Identity is unavailable.'; end if;

  if p_entry_type not in ('note','todo','idea','journal','anything','event') then
    raise exception 'Unsupported diary entry type.';
  end if;
  if char_length(btrim(coalesce(p_content,''))) < 1 or char_length(btrim(p_content)) > 20000 then
    raise exception 'Diary content is invalid.';
  end if;
  if p_title is not null and char_length(btrim(p_title)) > 200 then
    raise exception 'Diary title is invalid.';
  end if;

  if p_entry_type = 'event' then
    if p_event_start_at is null or nullif(btrim(coalesce(p_event_timezone,'')),'') is null or nullif(btrim(coalesce(p_title,'')),'') is null then
      raise exception 'Event title, start time and timezone are required.';
    end if;
    select exists(select 1 from pg_timezone_names where name = p_event_timezone) into event_timezone_ok;
    if not event_timezone_ok then raise exception 'Event timezone is invalid.'; end if;
    if p_event_end_at is not null and p_event_end_at < p_event_start_at then raise exception 'Event end time cannot be before start time.'; end if;
  end if;

  if p_id is null then
    insert into public.worker_diary_entries(id, worker_profile_id, entry_type, title, content, completed, event_start_at, event_end_at, event_timezone)
    values (
      gen_random_uuid(), owner_id, p_entry_type, nullif(btrim(p_title),''), btrim(p_content),
      case when p_entry_type='todo' then coalesce(p_completed,false) else null end,
      case when p_entry_type='event' then p_event_start_at else null end,
      case when p_entry_type='event' then p_event_end_at else null end,
      case when p_entry_type='event' then btrim(p_event_timezone) else null end
    ) returning id into entry_id;
  else
    select entry_type into existing_type from public.worker_diary_entries where id=p_id and worker_profile_id=owner_id for update;
    if existing_type is null then raise exception 'Diary entry was not found.'; end if;
    update public.worker_diary_entries
      set entry_type=p_entry_type,
          title=nullif(btrim(p_title),''),
          content=btrim(p_content),
          completed=case when p_entry_type='todo' then coalesce(p_completed,false) else null end,
          event_start_at=case when p_entry_type='event' then p_event_start_at else null end,
          event_end_at=case when p_entry_type='event' then p_event_end_at else null end,
          event_timezone=case when p_entry_type='event' then btrim(p_event_timezone) else null end
      where id=p_id and worker_profile_id=owner_id
      returning id into entry_id;
  end if;

  reminder_kind := case when p_entry_type='event' then 'event' when p_entry_type='todo' then 'todo' else null end;
  if reminder_kind is null or not coalesce(p_reminder_enabled,false) or (p_entry_type='todo' and coalesce(p_completed,false)) then
    delete from public.worker_diary_reminders where diary_entry_id=entry_id;
  else
    if p_reminder_scheduled_at is null or nullif(btrim(coalesce(p_reminder_timezone,'')),'') is null then
      raise exception 'Reminder date, time and timezone are required when a reminder is enabled.';
    end if;
    if not exists(select 1 from pg_timezone_names where name=p_reminder_timezone) then raise exception 'Reminder timezone is invalid.'; end if;
    if p_reminder_mode not in ('at_time','before_event','custom') then raise exception 'Reminder mode is invalid.'; end if;
    if p_reminder_mode='before_event' and (p_reminder_offset_minutes is null or p_reminder_offset_minutes <= 0) then raise exception 'Reminder offset is invalid.'; end if;
    insert into public.worker_diary_reminders(id, diary_entry_id, worker_profile_id, reminder_kind, enabled, scheduled_at, timezone, reminder_mode, offset_minutes, status, claimed_at, sent_at, last_error)
    values (gen_random_uuid(), entry_id, owner_id, reminder_kind, true, p_reminder_scheduled_at, btrim(p_reminder_timezone), p_reminder_mode, p_reminder_offset_minutes, case when p_reminder_scheduled_at > now() then 'pending' else 'failed' end, null, null, case when p_reminder_scheduled_at <= now() then 'Reminder time is already in the past.' else null end)
    on conflict (diary_entry_id) do update set
      enabled=true,
      scheduled_at=excluded.scheduled_at,
      timezone=excluded.timezone,
      reminder_mode=excluded.reminder_mode,
      offset_minutes=excluded.offset_minutes,
      status=case when excluded.scheduled_at > now() then 'pending' else 'failed' end,
      claimed_at=null,
      sent_at=null,
      last_error=case when excluded.scheduled_at <= now() then 'Reminder time is already in the past.' else null end,
      updated_at=now();
  end if;

  return entry_id;
end;
$$;

revoke all on function public.save_worker_diary_entry(uuid,text,text,text,boolean,timestamptz,timestamptz,text,boolean,timestamptz,text,text,integer) from public;
grant execute on function public.save_worker_diary_entry(uuid,text,text,text,boolean,timestamptz,timestamptz,text,boolean,timestamptz,text,text,integer) to authenticated;
