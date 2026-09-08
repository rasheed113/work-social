create sequence if not exists public.contractor_team_number_seq
  start with 100001
  increment by 1;

alter table public.contractor_teams
  add column if not exists team_number bigint;

alter table public.contractor_teams
  alter column team_number set default nextval('public.contractor_team_number_seq');

update public.contractor_teams
set team_number = nextval('public.contractor_team_number_seq')
where team_number is null;

alter table public.contractor_teams
  alter column team_number set not null;

create unique index if not exists contractor_teams_team_number_key
  on public.contractor_teams (team_number);

grant usage, select on sequence public.contractor_team_number_seq to authenticated;

comment on column public.contractor_teams.team_number is
  'User-facing unique numeric Team ID; separate from the internal database primary key.';
