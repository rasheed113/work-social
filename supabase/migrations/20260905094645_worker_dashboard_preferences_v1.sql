create table if not exists public.worker_dashboard_preferences (
  worker_profile_id uuid primary key references public.worker_profiles(id) on delete cascade,
  card_order text[] not null default '{}'::text[],
  hidden_cards text[] not null default '{}'::text[],
  updated_at timestamptz not null default now()
);

alter table public.worker_dashboard_preferences enable row level security;

grant select, insert, update, delete on public.worker_dashboard_preferences to authenticated;

drop policy if exists "Workers can view own dashboard preference" on public.worker_dashboard_preferences;
create policy "Workers can view own dashboard preference"
on public.worker_dashboard_preferences for select to authenticated
using (exists (select 1 from public.worker_profiles wp where wp.id = worker_dashboard_preferences.worker_profile_id and wp.profile_id = (select auth.uid())));

drop policy if exists "Workers can insert own dashboard preference" on public.worker_dashboard_preferences;
create policy "Workers can insert own dashboard preference"
on public.worker_dashboard_preferences for insert to authenticated
with check (exists (select 1 from public.worker_profiles wp where wp.id = worker_dashboard_preferences.worker_profile_id and wp.profile_id = (select auth.uid())));

drop policy if exists "Workers can update own dashboard preference" on public.worker_dashboard_preferences;
create policy "Workers can update own dashboard preference"
on public.worker_dashboard_preferences for update to authenticated
using (exists (select 1 from public.worker_profiles wp where wp.id = worker_dashboard_preferences.worker_profile_id and wp.profile_id = (select auth.uid())))
with check (exists (select 1 from public.worker_profiles wp where wp.id = worker_dashboard_preferences.worker_profile_id and wp.profile_id = (select auth.uid())));

drop policy if exists "Workers can delete own dashboard preference" on public.worker_dashboard_preferences;
create policy "Workers can delete own dashboard preference"
on public.worker_dashboard_preferences for delete to authenticated
using (exists (select 1 from public.worker_profiles wp where wp.id = worker_dashboard_preferences.worker_profile_id and wp.profile_id = (select auth.uid())));

create index if not exists worker_dashboard_preferences_worker_profile_id_idx on public.worker_dashboard_preferences(worker_profile_id);
