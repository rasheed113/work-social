-- Phase 3C stabilization: serialize revision allocation per Work Entry.
-- MAX(revision_no) + 1 is safe only when concurrent edits cannot overlap.
-- A transaction-scoped advisory lock preserves the existing revision model while
-- making the allocation atomic for one canonical Work Entry.
create or replace function private.record_work_entry_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_revision integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.id::text, 0));

  select coalesce(max(v.revision_no), 0) + 1
    into next_revision
  from public.work_entry_versions v
  where v.work_entry_id = new.id;

  insert into public.work_entry_versions (
    work_entry_id, revision_no, item_name, size, quantity, rate, total,
    special_note, recorded_at, changed_by
  )
  values (
    new.id, next_revision, new.item_name, new.size, new.quantity, new.rate,
    new.total, new.special_note, now(), (select auth.uid())
  );

  return new;
end;
$$;

revoke all on function private.record_work_entry_version() from public;
grant execute on function private.record_work_entry_version() to authenticated;

comment on column public.work_entries.quantity is 'Worker Work Entry quantity; positive decimal, up to numeric(18,4), per the current Work Entry contract.';
comment on column public.work_entries.rate is 'Worker Work Entry rate; non-negative decimal, up to numeric(18,4), per the current Work Entry contract.';
