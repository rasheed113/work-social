create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create table if not exists private.worker_diary_runtime_secrets (
  name text primary key,
  secret text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
revoke all on table private.worker_diary_runtime_secrets from public, anon, authenticated;

create or replace function public.get_worker_diary_runtime_secrets()
returns jsonb
language sql
security definer
set search_path = public, private
as $$
  select coalesce(jsonb_object_agg(name, secret), '{}'::jsonb)
  from private.worker_diary_runtime_secrets;
$$;
revoke all on function public.get_worker_diary_runtime_secrets() from public, anon, authenticated;
grant execute on function public.get_worker_diary_runtime_secrets() to service_role;

create or replace function public.claim_worker_diary_reminders(p_limit integer default 50)
returns table (id uuid, worker_profile_id uuid, reminder_kind text, scheduled_at timestamptz, timezone text, entry_title text, entry_content text, event_start_at timestamptz)
language plpgsql security definer set search_path=public as $$
begin
  return query
  with due as (
    select r.id from public.worker_diary_reminders r
    join public.worker_diary_preferences p on p.worker_profile_id=r.worker_profile_id
    join public.worker_diary_entries e on e.id=r.diary_entry_id
    where r.enabled=true and r.scheduled_at<=now()
      and (r.status='pending' or (r.status='processing' and r.claimed_at<now()-interval '10 minutes'))
      and p.notifications_enabled=true
      and ((r.reminder_kind='todo' and p.todo_reminders_enabled=true and e.completed=false) or (r.reminder_kind='event' and p.event_reminders_enabled=true))
    order by r.scheduled_at asc
    for update of r skip locked
    limit greatest(1,least(coalesce(p_limit,50),200))
  ), claimed as (
    update public.worker_diary_reminders r
      set status='processing',claimed_at=now(),last_error=null,updated_at=now()
    from due where r.id=due.id
    returning r.id,r.worker_profile_id,r.reminder_kind,r.scheduled_at,r.timezone,r.diary_entry_id
  )
  select c.id,c.worker_profile_id,c.reminder_kind,c.scheduled_at,c.timezone,e.title,e.content,e.event_start_at
  from claimed c join public.worker_diary_entries e on e.id=c.diary_entry_id;
end; $$;
revoke all on function public.claim_worker_diary_reminders(integer) from public, anon, authenticated;
grant execute on function public.claim_worker_diary_reminders(integer) to service_role;

create index if not exists worker_diary_reminders_processing_idx on public.worker_diary_reminders(claimed_at,status) where status='processing';
