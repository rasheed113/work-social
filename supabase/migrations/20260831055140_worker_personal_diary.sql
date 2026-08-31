create table public.worker_diary_entries (
  id uuid primary key default gen_random_uuid(),
  worker_profile_id uuid not null references public.worker_profiles(id) on delete restrict,
  entry_type text not null check (entry_type in ('note', 'todo', 'idea', 'journal', 'anything')),
  title text null check (title is null or char_length(btrim(title)) between 1 and 200),
  content text not null check (char_length(btrim(content)) between 1 and 20000),
  completed boolean null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint worker_diary_completed_shape check (
    (entry_type = 'todo' and completed is not null)
    or (entry_type <> 'todo' and completed is null)
  )
);

create index worker_diary_entries_worker_created_idx
  on public.worker_diary_entries (worker_profile_id, created_at desc, id desc);

alter table public.worker_diary_entries enable row level security;

revoke all on table public.worker_diary_entries from anon, authenticated;
grant select, insert, update, delete on table public.worker_diary_entries to authenticated;

create policy "Workers can view own diary entries"
  on public.worker_diary_entries
  for select
  to authenticated
  using (
    worker_profile_id in (
      select wp.id
      from public.worker_profiles wp
      where wp.profile_id = (select auth.uid())
    )
  );

create policy "Workers can create own diary entries"
  on public.worker_diary_entries
  for insert
  to authenticated
  with check (
    worker_profile_id in (
      select wp.id
      from public.worker_profiles wp
      where wp.profile_id = (select auth.uid())
    )
  );

create policy "Workers can update own diary entries"
  on public.worker_diary_entries
  for update
  to authenticated
  using (
    worker_profile_id in (
      select wp.id
      from public.worker_profiles wp
      where wp.profile_id = (select auth.uid())
    )
  )
  with check (
    worker_profile_id in (
      select wp.id
      from public.worker_profiles wp
      where wp.profile_id = (select auth.uid())
    )
  );

create policy "Workers can delete own diary entries"
  on public.worker_diary_entries
  for delete
  to authenticated
  using (
    worker_profile_id in (
      select wp.id
      from public.worker_profiles wp
      where wp.profile_id = (select auth.uid())
    )
  );

create or replace function private.guard_worker_diary_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.worker_profile_id is distinct from old.worker_profile_id
     or new.created_at is distinct from old.created_at then
    raise exception 'immutable diary ownership fields cannot be changed';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.guard_worker_diary_update() from public;
grant usage on schema private to authenticated;
grant execute on function private.guard_worker_diary_update() to authenticated;

create trigger worker_diary_entries_guard_update
  before update on public.worker_diary_entries
  for each row
  execute function private.guard_worker_diary_update();
