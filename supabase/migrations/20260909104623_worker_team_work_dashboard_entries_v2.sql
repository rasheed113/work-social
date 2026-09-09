create table if not exists public.worker_team_work_entries (
  id uuid primary key default gen_random_uuid(),
  team_id bigint not null references public.contractor_teams(id) on delete cascade,
  worker_profile_id uuid not null references public.worker_profiles(id) on delete restrict,
  item_name text not null check (char_length(btrim(item_name)) between 1 and 200),
  size text[] null,
  quantity numeric(18,4) not null check (quantity > 0),
  rate numeric(18,4) not null check (rate >= 0),
  total numeric(24,4) generated always as (quantity * rate) stored,
  special_note text null check (special_note is null or char_length(special_note) <= 2000),
  lifecycle_state text not null default 'active' check (lifecycle_state in ('active','trashed')),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists worker_team_work_entries_scope_idx on public.worker_team_work_entries(team_id, worker_profile_id, occurred_at desc, id desc);
create index if not exists worker_team_work_entries_state_idx on public.worker_team_work_entries(team_id, worker_profile_id, lifecycle_state, occurred_at desc);
create table if not exists public.worker_team_work_entry_versions (
  id uuid primary key default gen_random_uuid(), work_entry_id uuid not null references public.worker_team_work_entries(id) on delete cascade,
  revision_no integer not null check (revision_no > 0), item_name text not null, size text[] null,
  quantity numeric(18,4) not null, rate numeric(18,4) not null, total numeric(24,4) not null,
  special_note text null, recorded_at timestamptz not null default now(), changed_by uuid null references public.profiles(id) on delete set null,
  unique(work_entry_id, revision_no)
);
create index if not exists worker_team_work_entry_versions_idx on public.worker_team_work_entry_versions(work_entry_id, revision_no desc);
alter table public.worker_team_work_entries enable row level security;
alter table public.worker_team_work_entry_versions enable row level security;
revoke all on table public.worker_team_work_entries, public.worker_team_work_entry_versions from anon, authenticated;
grant select, insert, update on public.worker_team_work_entries to authenticated;
grant select on public.worker_team_work_entry_versions to authenticated;
create or replace function private.worker_team_work_member(p_team_id bigint) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.contractor_team_members m where m.team_id=p_team_id and m.profile_id=(select auth.uid())); $$;
revoke all on function private.worker_team_work_member(bigint) from public, anon;
grant execute on function private.worker_team_work_member(bigint) to authenticated;
create policy "Workers can view own team work entries" on public.worker_team_work_entries for select to authenticated using (private.worker_team_work_member(team_id) and worker_profile_id in (select wp.id from public.worker_profiles wp where wp.profile_id=(select auth.uid())));
create policy "Workers can create own team work entries" on public.worker_team_work_entries for insert to authenticated with check (private.worker_team_work_member(team_id) and worker_profile_id in (select wp.id from public.worker_profiles wp where wp.profile_id=(select auth.uid())));
create policy "Workers can update own team work entries" on public.worker_team_work_entries for update to authenticated using (private.worker_team_work_member(team_id) and worker_profile_id in (select wp.id from public.worker_profiles wp where wp.profile_id=(select auth.uid()))) with check (private.worker_team_work_member(team_id) and worker_profile_id in (select wp.id from public.worker_profiles wp where wp.profile_id=(select auth.uid())));
create policy "Workers can view own team work versions" on public.worker_team_work_entry_versions for select to authenticated using (exists(select 1 from public.worker_team_work_entries e where e.id=worker_team_work_entry_versions.work_entry_id and e.worker_profile_id in (select wp.id from public.worker_profiles wp where wp.profile_id=(select auth.uid())) and private.worker_team_work_member(e.team_id)));
create or replace function private.guard_worker_team_work_entry_update() returns trigger language plpgsql security invoker set search_path='' as $$ begin if new.id is distinct from old.id or new.team_id is distinct from old.team_id or new.worker_profile_id is distinct from old.worker_profile_id or new.occurred_at is distinct from old.occurred_at or new.created_at is distinct from old.created_at then raise exception 'immutable team work entry fields cannot be changed'; end if; new.updated_at:=now(); return new; end; $$;
create trigger worker_team_work_entries_guard_update before update on public.worker_team_work_entries for each row execute function private.guard_worker_team_work_entry_update();
create or replace function private.record_worker_team_work_entry_version() returns trigger language plpgsql security definer set search_path='' as $$ begin insert into public.worker_team_work_entry_versions(work_entry_id,revision_no,item_name,size,quantity,rate,total,special_note,recorded_at,changed_by) values(new.id,coalesce((select max(v.revision_no) from public.worker_team_work_entry_versions v where v.work_entry_id=new.id),0)+1,new.item_name,new.size,new.quantity,new.rate,new.total,new.special_note,now(),(select auth.uid())); return new; end; $$;
revoke all on function private.record_worker_team_work_entry_version() from public, anon;
grant execute on function private.record_worker_team_work_entry_version() to authenticated;
create trigger worker_team_work_entries_record_version after insert or update of item_name,size,quantity,rate,special_note on public.worker_team_work_entries for each row execute function private.record_worker_team_work_entry_version();
create or replace function public.get_worker_team_work_context(p_team_number bigint) returns table(team_id bigint,team_number bigint,team_name text,team_purpose text,leader_profile_id uuid,leader_display_name text,leader_username text,leader_avatar_url text,worker_profile_id uuid) language sql security definer stable set search_path='' as $$ select t.id,t.team_number,t.name,t.purpose,t.leader_profile_id,p.display_name,p.username,p.avatar_url,wp.id from public.contractor_teams t join public.contractor_team_members m on m.team_id=t.id and m.profile_id=(select auth.uid()) join public.worker_profiles wp on wp.profile_id=(select auth.uid()) left join public.profiles p on p.id=t.leader_profile_id where t.team_number=p_team_number; $$;
revoke all on function public.get_worker_team_work_context(bigint) from public, anon;
grant execute on function public.get_worker_team_work_context(bigint) to authenticated;
create or replace function public.get_worker_team_work_totals(p_team_number bigint,p_day_start timestamptz,p_day_end timestamptz,p_week_start timestamptz,p_week_end timestamptz,p_month_start timestamptz,p_month_end timestamptz) returns table(daily_total numeric(24,4),weekly_total numeric(24,4),monthly_total numeric(24,4),lifetime_total numeric(24,4)) language sql security definer stable set search_path='' as $$ select coalesce(sum(case when e.occurred_at>=p_day_start and e.occurred_at<p_day_end then e.total else 0 end),0)::numeric(24,4),coalesce(sum(case when e.occurred_at>=p_week_start and e.occurred_at<p_week_end then e.total else 0 end),0)::numeric(24,4),coalesce(sum(case when e.occurred_at>=p_month_start and e.occurred_at<p_month_end then e.total else 0 end),0)::numeric(24,4),coalesce(sum(e.total),0)::numeric(24,4) from public.worker_team_work_entries e join public.contractor_teams t on t.id=e.team_id where t.team_number=p_team_number and e.lifecycle_state='active' and e.worker_profile_id in(select wp.id from public.worker_profiles wp where wp.profile_id=(select auth.uid())) and exists(select 1 from public.contractor_team_members m where m.team_id=e.team_id and m.profile_id=(select auth.uid())); $$;
revoke all on function public.get_worker_team_work_totals(bigint,timestamptz,timestamptz,timestamptz,timestamptz,timestamptz,timestamptz) from public, anon;
grant execute on function public.get_worker_team_work_totals(bigint,timestamptz,timestamptz,timestamptz,timestamptz,timestamptz,timestamptz) to authenticated;
create or replace function public.trash_worker_team_work_entry(p_entry_id uuid) returns boolean language plpgsql security definer set search_path='' as $$ begin update public.worker_team_work_entries e set lifecycle_state='trashed',updated_at=now() where e.id=p_entry_id and e.worker_profile_id in(select wp.id from public.worker_profiles wp where wp.profile_id=(select auth.uid())) and exists(select 1 from public.contractor_team_members m where m.team_id=e.team_id and m.profile_id=(select auth.uid())) and e.lifecycle_state='active'; return found; end; $$;
revoke all on function public.trash_worker_team_work_entry(uuid) from public, anon;
grant execute on function public.trash_worker_team_work_entry(uuid) to authenticated;
