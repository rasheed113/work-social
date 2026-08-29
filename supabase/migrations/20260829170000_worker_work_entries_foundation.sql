create schema if not exists private;

create table public.work_entries (
  id uuid primary key default gen_random_uuid(),
  worker_profile_id uuid not null references public.worker_profiles(id) on delete restrict,
  work_context text not null default 'my_work' check (work_context = 'my_work'),
  item_name text not null check (char_length(btrim(item_name)) between 1 and 200),
  size text not null check (char_length(btrim(size)) between 1 and 100),
  quantity numeric(18,4) not null check (quantity > 0),
  rate numeric(18,4) not null check (rate >= 0),
  total numeric(24,4) generated always as (quantity * rate) stored,
  special_note text null check (special_note is null or char_length(special_note) <= 2000),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index work_entries_worker_occurred_idx
  on public.work_entries (worker_profile_id, occurred_at desc, id desc);

create table public.work_entry_versions (
  id uuid primary key default gen_random_uuid(),
  work_entry_id uuid not null references public.work_entries(id) on delete cascade,
  revision_no integer not null check (revision_no > 0),
  item_name text not null,
  size text not null,
  quantity numeric(18,4) not null,
  rate numeric(18,4) not null,
  total numeric(24,4) not null,
  special_note text null,
  recorded_at timestamptz not null default now(),
  changed_by uuid null references public.profiles(id) on delete set null,
  unique (work_entry_id, revision_no)
);

create index work_entry_versions_entry_revision_idx
  on public.work_entry_versions (work_entry_id, revision_no desc);

create table public.work_entry_hidden_for (
  work_entry_id uuid not null references public.work_entries(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (work_entry_id, profile_id)
);

create index work_entry_hidden_for_profile_idx
  on public.work_entry_hidden_for (profile_id, hidden_at desc);

alter table public.work_entries enable row level security;
alter table public.work_entry_versions enable row level security;
alter table public.work_entry_hidden_for enable row level security;

revoke all on table public.work_entries, public.work_entry_versions, public.work_entry_hidden_for from anon, authenticated;
grant select, insert, update on table public.work_entries to authenticated;
grant select on table public.work_entry_versions to authenticated;
grant select, insert on table public.work_entry_hidden_for to authenticated;

create policy "Workers can view visible own work entries"
  on public.work_entries
  for select
  to authenticated
  using (
    worker_profile_id in (
      select wp.id from public.worker_profiles wp
      where wp.profile_id = (select auth.uid())
    )
    and not exists (
      select 1 from public.work_entry_hidden_for hidden
      where hidden.work_entry_id = work_entries.id
        and hidden.profile_id = (select auth.uid())
    )
  );

create policy "Workers can create own work entries"
  on public.work_entries
  for insert
  to authenticated
  with check (
    worker_profile_id in (
      select wp.id from public.worker_profiles wp
      where wp.profile_id = (select auth.uid())
    )
    and work_context = 'my_work'
  );

create policy "Workers can edit visible own work entries"
  on public.work_entries
  for update
  to authenticated
  using (
    worker_profile_id in (
      select wp.id from public.worker_profiles wp
      where wp.profile_id = (select auth.uid())
    )
    and not exists (
      select 1 from public.work_entry_hidden_for hidden
      where hidden.work_entry_id = work_entries.id
        and hidden.profile_id = (select auth.uid())
    )
  )
  with check (
    worker_profile_id in (
      select wp.id from public.worker_profiles wp
      where wp.profile_id = (select auth.uid())
    )
    and work_context = 'my_work'
  );

create policy "Workers can view own work entry versions"
  on public.work_entry_versions
  for select
  to authenticated
  using (
    exists (
      select 1 from public.work_entries entry
      where entry.id = work_entry_versions.work_entry_id
        and entry.worker_profile_id in (
          select wp.id from public.worker_profiles wp
          where wp.profile_id = (select auth.uid())
        )
        and not exists (
          select 1 from public.work_entry_hidden_for hidden
          where hidden.work_entry_id = entry.id
            and hidden.profile_id = (select auth.uid())
        )
    )
  );

create policy "Workers can view own hidden work markers"
  on public.work_entry_hidden_for
  for select
  to authenticated
  using (profile_id = (select auth.uid()));

create policy "Workers can hide own work entries"
  on public.work_entry_hidden_for
  for insert
  to authenticated
  with check (
    profile_id = (select auth.uid())
    and exists (
      select 1 from public.work_entries entry
      join public.worker_profiles wp on wp.id = entry.worker_profile_id
      where entry.id = work_entry_hidden_for.work_entry_id
        and wp.profile_id = (select auth.uid())
    )
  );

create or replace function private.guard_work_entry_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.worker_profile_id is distinct from old.worker_profile_id
     or new.work_context is distinct from old.work_context
     or new.occurred_at is distinct from old.occurred_at
     or new.created_at is distinct from old.created_at
     or new.id is distinct from old.id then
    raise exception 'immutable work entry fields cannot be changed';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger work_entries_guard_update
  before update on public.work_entries
  for each row
  execute function private.guard_work_entry_update();

create or replace function private.record_work_entry_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.work_entry_versions (
    work_entry_id, revision_no, item_name, size, quantity, rate, total,
    special_note, recorded_at, changed_by
  )
  values (
    new.id,
    coalesce((select max(v.revision_no) from public.work_entry_versions v where v.work_entry_id = new.id), 0) + 1,
    new.item_name, new.size, new.quantity, new.rate, new.total,
    new.special_note, now(), (select auth.uid())
  );
  return new;
end;
$$;

revoke all on function private.record_work_entry_version() from public;
grant usage on schema private to authenticated;
grant execute on function private.record_work_entry_version() to authenticated;

create trigger work_entries_record_version
  after insert or update of item_name, size, quantity, rate, special_note on public.work_entries
  for each row
  execute function private.record_work_entry_version();

create or replace function public.get_worker_work_totals(
  p_day_start timestamptz,
  p_day_end timestamptz,
  p_week_start timestamptz,
  p_week_end timestamptz,
  p_month_start timestamptz,
  p_month_end timestamptz
)
returns table (
  daily_total numeric(24,4),
  weekly_total numeric(24,4),
  monthly_total numeric(24,4),
  lifetime_total numeric(24,4)
)
language sql
security invoker
stable
set search_path = ''
as $$
  select
    coalesce(sum(case when e.occurred_at >= p_day_start and e.occurred_at < p_day_end then e.total else 0 end), 0)::numeric(24,4),
    coalesce(sum(case when e.occurred_at >= p_week_start and e.occurred_at < p_week_end then e.total else 0 end), 0)::numeric(24,4),
    coalesce(sum(case when e.occurred_at >= p_month_start and e.occurred_at < p_month_end then e.total else 0 end), 0)::numeric(24,4),
    coalesce(sum(e.total), 0)::numeric(24,4)
  from public.work_entries e
  where e.worker_profile_id in (
    select wp.id from public.worker_profiles wp
    where wp.profile_id = (select auth.uid())
  )
    and not exists (
      select 1 from public.work_entry_hidden_for hidden
      where hidden.work_entry_id = e.id
        and hidden.profile_id = (select auth.uid())
    );
$$;

revoke all on function public.get_worker_work_totals(timestamptz, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz) from public, anon;
grant execute on function public.get_worker_work_totals(timestamptz, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz) to authenticated;
