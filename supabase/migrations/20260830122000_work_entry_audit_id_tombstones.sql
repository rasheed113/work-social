-- Preserve canonical Work Entry UUID identity after permanent removal so an old
-- audit stream can never become attached to a newly created Work Entry that reuses
-- the same client-supplied UUID.
create table public.work_entry_id_tombstones (
  work_entry_id uuid primary key,
  removed_at timestamptz not null default now()
);

alter table public.work_entry_id_tombstones enable row level security;
revoke all on table public.work_entry_id_tombstones from anon, authenticated;

create or replace function private.guard_work_entry_id_reuse()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.work_entry_id_tombstones t
    where t.work_entry_id = new.id
  ) then
    raise exception 'Work Entry identity has been permanently removed and cannot be reused';
  end if;
  return new;
end;
$$;

create or replace function private.record_work_entry_id_tombstone()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.work_entry_id_tombstones (work_entry_id)
  values (old.id)
  on conflict (work_entry_id) do nothing;
  return old;
end;
$$;

revoke all on function private.guard_work_entry_id_reuse() from public;
revoke all on function private.record_work_entry_id_tombstone() from public;
grant execute on function private.guard_work_entry_id_reuse() to authenticated;
grant execute on function private.record_work_entry_id_tombstone() to authenticated;

drop trigger if exists work_entries_guard_id_reuse on public.work_entries;
create trigger work_entries_guard_id_reuse
  before insert on public.work_entries
  for each row
  execute function private.guard_work_entry_id_reuse();

drop trigger if exists work_entries_record_id_tombstone on public.work_entries;
create trigger work_entries_record_id_tombstone
  after delete on public.work_entries
  for each row
  execute function private.record_work_entry_id_tombstone();
