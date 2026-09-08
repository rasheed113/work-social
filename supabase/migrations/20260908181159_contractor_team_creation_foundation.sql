create table if not exists public.contractor_teams (
  id bigint generated always as identity primary key,
  leader_profile_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  purpose text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contractor_teams_name_check check (char_length(btrim(name)) between 1 and 160),
  constraint contractor_teams_purpose_check check (char_length(btrim(purpose)) between 1 and 1000)
);

create index if not exists contractor_teams_leader_profile_id_idx
  on public.contractor_teams (leader_profile_id);

alter table public.contractor_teams
  add column if not exists search_document tsvector
  generated always as (
    to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(purpose, ''))
  ) stored;

create index if not exists contractor_teams_search_document_idx
  on public.contractor_teams using gin (search_document);

alter table public.contractor_teams enable row level security;

grant select, insert on table public.contractor_teams to authenticated;
grant usage, select on sequence public.contractor_teams_id_seq to authenticated;

drop policy if exists contractor_teams_select_own on public.contractor_teams;
create policy contractor_teams_select_own
  on public.contractor_teams
  for select
  to authenticated
  using ((select auth.uid()) = leader_profile_id);

drop policy if exists contractor_teams_insert_own on public.contractor_teams;
create policy contractor_teams_insert_own
  on public.contractor_teams
  for insert
  to authenticated
  with check ((select auth.uid()) = leader_profile_id);

create or replace function public.touch_contractor_team_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists contractor_teams_touch_updated_at on public.contractor_teams;
create trigger contractor_teams_touch_updated_at
before update on public.contractor_teams
for each row execute function public.touch_contractor_team_updated_at();