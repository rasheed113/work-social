-- Restore transaction-scoped revision allocation serialization while preserving
-- the approved worker_profile_id audit snapshot contract.
create or replace function private.record_work_entry_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.id::text, 0));

  insert into public.work_entry_versions (
    work_entry_id, revision_no, worker_profile_id, item_name, size, quantity, rate, total,
    special_note, recorded_at, changed_by
  )
  values (
    new.id,
    coalesce((select max(v.revision_no) from public.work_entry_versions v where v.work_entry_id = new.id), 0) + 1,
    new.worker_profile_id,
    new.item_name, new.size, new.quantity, new.rate, new.total,
    new.special_note, now(), (select auth.uid())
  );
  return new;
end;
$$;
