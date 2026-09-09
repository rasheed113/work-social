create index if not exists worker_team_work_entries_worker_profile_idx
  on public.worker_team_work_entries(worker_profile_id, lifecycle_state, occurred_at desc, id desc);
