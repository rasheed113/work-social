select cron.unschedule(jobid)
from cron.job
where jobname = 'worker-diary-reminder-dispatch-every-minute';

select cron.schedule(
  'worker-diary-reminder-dispatch-every-minute',
  '* * * * *',
  $$
    select net.http_post(
      url := (select secret from private.worker_diary_runtime_secrets where name = 'worker_diary_project_url') || '/functions/v1/worker-diary-reminder-dispatch',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-worker-diary-cron-secret', (select secret from private.worker_diary_runtime_secrets where name = 'worker_diary_cron_secret')
      ),
      body := jsonb_build_object('source', 'pg_cron', 'at', now())
    );
  $$
);
