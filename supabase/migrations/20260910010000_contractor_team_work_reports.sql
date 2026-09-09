create table public.contractor_team_work_reports (
  id uuid primary key default gen_random_uuid(),
  team_id bigint not null references public.contractor_teams(id) on delete cascade,
  work_entry_id uuid not null references public.worker_team_work_entries(id) on delete cascade,
  contractor_profile_id uuid not null references public.profiles(id) on delete restrict,
  worker_profile_id uuid not null references public.profiles(id) on delete restrict,
  report_text text not null check (char_length(btrim(report_text)) between 1 and 4000),
  reported_at timestamptz not null default now(),
  read_at timestamptz null,
  unique (work_entry_id, contractor_profile_id)
);

create index contractor_team_work_reports_worker_idx
  on public.contractor_team_work_reports (worker_profile_id, read_at, reported_at desc);

create index contractor_team_work_reports_team_idx
  on public.contractor_team_work_reports (team_id, reported_at desc);

alter table public.contractor_team_work_reports enable row level security;
revoke all on public.contractor_team_work_reports from anon, authenticated;
grant select, insert, update on public.contractor_team_work_reports to authenticated;

create policy "Contractors can create reports for their team entries"
  on public.contractor_team_work_reports
  for insert to authenticated
  with check (
    contractor_profile_id = (select auth.uid())
    and exists (
      select 1
      from public.contractor_teams t
      join public.worker_team_work_entries e on e.team_id = t.id
      where t.id = contractor_team_work_reports.team_id
        and t.leader_profile_id = (select auth.uid())
        and e.id = contractor_team_work_reports.work_entry_id
        and e.worker_profile_id = contractor_team_work_reports.worker_profile_id
        and e.lifecycle_state = 'active'
    )
  );

create policy "Contractors can view their team reports"
  on public.contractor_team_work_reports
  for select to authenticated
  using (contractor_profile_id = (select auth.uid()));

create policy "Workers can view reports about their entries"
  on public.contractor_team_work_reports
  for select to authenticated
  using (worker_profile_id = (select auth.uid()));

create policy "Workers can mark their reports read"
  on public.contractor_team_work_reports
  for update to authenticated
  using (worker_profile_id = (select auth.uid()))
  with check (worker_profile_id = (select auth.uid()));
