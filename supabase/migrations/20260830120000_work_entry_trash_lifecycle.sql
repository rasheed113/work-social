-- Work Entry Trash lifecycle
-- ACTIVE -> TRASHED -> permanent removal.
-- Audit revisions intentionally survive canonical Work Entry removal.

alter table public.work_entries
  add column lifecycle_state text not null default 'active'
    check (lifecycle_state in ('active', 'trashed'));

create index work_entries_worker_lifecycle_occurred_idx
  on public.work_entries (worker_profile_id, lifecycle_state, occurred_at desc, id desc);

-- Detach immutable revisions from the canonical-row lifecycle. The UUID remains
-- as the historical Work Entry identity, but no FK can cascade-delete revisions.
alter table public.work_entry_versions
  drop constraint if exists work_entry_versions_work_entry_id_fkey;

alter table public.work_entry_versions
  add column worker_profile_id uuid;

update public.work_entry_versions v
set worker_profile_id = e.worker_profile_id
from public.work_entries e
where e.id = v.work_entry_id;

alter table public.work_entry_versions
  alter column worker_profile_id set not null;

create index work_entry_versions_worker_profile_idx
  on public.work_entry_versions (worker_profile_id, recorded_at desc, id desc);

-- Legacy hide markers remain intact. They are no longer used for new Delete
-- operations and are intentionally not reinterpreted as canonical Trash.

-- Active Work Entry reads are lifecycle-based. Legacy hidden markers continue
-- to preserve the old visibility semantics for existing hidden records.
drop policy if exists "Workers can view visible own work entries" on public.work_entries;
create policy "Workers can view active own work entries"
  on public.work_entries
  for select
  to authenticated
  using (
    lifecycle_state = 'active'
    and worker_profile_id in (
      select wp.id from public.worker_profiles wp
      where wp.profile_id = (select auth.uid())
    )
    and not exists (
      select 1 from public.work_entry_hidden_for hidden
      where hidden.work_entry_id = work_entries.id
        and hidden.profile_id = (select auth.uid())
    )
  );

create policy "Workers can view own trashed work entries"
  on public.work_entries
  for select
  to authenticated
  using (
    lifecycle_state = 'trashed'
    and worker_profile_id in (
      select wp.id from public.worker_profiles wp
      where wp.profile_id = (select auth.uid())
    )
    and not exists (
      select 1 from public.work_entry_hidden_for hidden
      where hidden.work_entry_id = work_entries.id
        and hidden.profile_id = (select auth.uid())
    )
  );

drop policy if exists "Workers can edit visible own work entries" on public.work_entries;
create policy "Workers can edit active own work entries"
  on public.work_entries
  for update
  to authenticated
  using (
    lifecycle_state = 'active'
    and worker_profile_id in (
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
    lifecycle_state = 'active'
    and worker_profile_id in (
      select wp.id from public.worker_profiles wp
      where wp.profile_id = (select auth.uid())
    )
    and work_context = 'my_work'
  );

-- Revision reads remain available after canonical deletion. The snapshot owner
-- is authoritative for audit access and no longer depends on work_entries.
drop policy if exists "Workers can view own work entry versions" on public.work_entry_versions;
create policy "Workers can view own work entry versions"
  on public.work_entry_versions
  for select
  to authenticated
  using (
    worker_profile_id in (
      select wp.id from public.worker_profiles wp
      where wp.profile_id = (select auth.uid())
    )
    and not exists (
      select 1
      from public.work_entry_hidden_for hidden
      where hidden.work_entry_id = work_entry_versions.work_entry_id
        and hidden.profile_id = (select auth.uid())
    )
  );

-- Lifecycle transitions are database-authorized operations. They derive the
-- Worker from auth.uid() and the existing worker_profiles ownership relation.
create or replace function public.trash_worker_work_entry(p_entry_id uuid)
returns uuid
language sql
security definer
set search_path = public
as $$
  update public.work_entries e
  set lifecycle_state = 'trashed', updated_at = now()
  where e.id = p_entry_id
    and e.lifecycle_state = 'active'
    and e.worker_profile_id in (
      select wp.id from public.worker_profiles wp
      where wp.profile_id = (select auth.uid())
    )
  returning e.id;
$$;

create or replace function public.restore_worker_work_entry(p_entry_id uuid)
returns uuid
language sql
security definer
set search_path = public
as $$
  update public.work_entries e
  set lifecycle_state = 'active', updated_at = now()
  where e.id = p_entry_id
    and e.lifecycle_state = 'trashed'
    and e.worker_profile_id in (
      select wp.id from public.worker_profiles wp
      where wp.profile_id = (select auth.uid())
    )
  returning e.id;
$$;

create or replace function public.remove_worker_work_entry_permanently(p_entry_id uuid)
returns uuid
language sql
security definer
set search_path = public
as $$
  delete from public.work_entries e
  where e.id = p_entry_id
    and e.lifecycle_state = 'trashed'
    and e.worker_profile_id in (
      select wp.id from public.worker_profiles wp
      where wp.profile_id = (select auth.uid())
    )
  returning e.id;
$$;

create or replace function public.empty_worker_work_trash()
returns integer
language sql
security definer
set search_path = public
as $$
  with deleted as (
    delete from public.work_entries e
    where e.lifecycle_state = 'trashed'
      and e.worker_profile_id in (
        select wp.id from public.worker_profiles wp
        where wp.profile_id = (select auth.uid())
      )
    returning e.id
  )
  select count(*)::integer from deleted;
$$;

revoke all on function public.trash_worker_work_entry(uuid) from public, anon;
revoke all on function public.restore_worker_work_entry(uuid) from public, anon;
revoke all on function public.remove_worker_work_entry_permanently(uuid) from public, anon;
revoke all on function public.empty_worker_work_trash() from public, anon;
grant execute on function public.trash_worker_work_entry(uuid) to authenticated;
grant execute on function public.restore_worker_work_entry(uuid) to authenticated;
grant execute on function public.remove_worker_work_entry_permanently(uuid) to authenticated;
grant execute on function public.empty_worker_work_trash() to authenticated;

-- Active totals only. Formulae are unchanged; lifecycle filtering is the only
-- semantic change.
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
  where e.lifecycle_state = 'active'
    and e.worker_profile_id in (
      select wp.id from public.worker_profiles wp
      where wp.profile_id = (select auth.uid())
    )
    and not exists (
      select 1 from public.work_entry_hidden_for hidden
      where hidden.work_entry_id = e.id
        and hidden.profile_id = (select auth.uid())
    );
$$;
