-- Worker Work Identity foundation.
-- Worker identity extends the existing authenticated Social profile; it does not replace it.
create table if not exists public.worker_profiles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  work_id uuid not null unique default gen_random_uuid(),
  work_role text not null default 'worker' check (work_role = 'worker'),
  work_description text,
  skills text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_worker_profile_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_worker_profiles_updated_at on public.worker_profiles;
create trigger trg_worker_profiles_updated_at
before update on public.worker_profiles
for each row execute function public.touch_worker_profile_updated_at();

alter table public.worker_profiles enable row level security;

drop policy if exists worker_profiles_select_own on public.worker_profiles;
create policy worker_profiles_select_own
on public.worker_profiles
for select
to authenticated
using ((select auth.uid()) = profile_id);

drop policy if exists worker_profiles_insert_own on public.worker_profiles;
create policy worker_profiles_insert_own
on public.worker_profiles
for insert
to authenticated
with check ((select auth.uid()) = profile_id);

drop policy if exists worker_profiles_update_own on public.worker_profiles;
create policy worker_profiles_update_own
on public.worker_profiles
for update
to authenticated
using ((select auth.uid()) = profile_id)
with check ((select auth.uid()) = profile_id);

create index if not exists worker_profiles_profile_idx
on public.worker_profiles(profile_id);
