create or replace function private.record_work_entry_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
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
