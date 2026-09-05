-- Salary Person attendance reminder: extend the existing notification stream without changing existing social event types.
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type = any (array[
  'like','comment','comment_reply','mention_post','mention_comment','follow','message','friend_request','friend_accept','attendance_reminder'
]));

grant select, insert, update, delete on public.salary_policies to service_role;
grant select, insert, update, delete on public.salary_attendance_records to service_role;
grant select, insert, update, delete on public.worker_profiles to service_role;
grant select, insert, update, delete on public.notifications to service_role;
grant select, insert, update, delete on public.worker_diary_push_subscriptions to service_role;

create index if not exists notifications_attendance_reminder_lookup_idx
  on public.notifications(receiver_id, type, created_at desc)
  where type = 'attendance_reminder';

create unique index if not exists notifications_attendance_reminder_daily_uidx
  on public.notifications(receiver_id, type, ((metadata->>'attendance_date')))
  where type = 'attendance_reminder';

-- The dispatcher runs once per minute and uses the configured worker attendance time.
select cron.unschedule(jobid)
from cron.job
where jobname = 'salary-attendance-notification-dispatch-every-minute';

select cron.schedule(
  'salary-attendance-notification-dispatch-every-minute',
  '* * * * *',
  $$
    select net.http_post(
      url := (select secret from private.worker_diary_runtime_secrets where name = 'worker_diary_project_url') || '/functions/v1/salary-attendance-notification-dispatch',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-worker-diary-cron-secret', (select secret from private.worker_diary_runtime_secrets where name = 'worker_diary_cron_secret')
      ),
      body := jsonb_build_object('source', 'pg_cron', 'at', now())
    );
  $$
);
