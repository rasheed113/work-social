grant update, delete on public.contractor_work_entries to authenticated;

drop policy if exists contractor_work_entries_update_own on public.contractor_work_entries;
create policy contractor_work_entries_update_own
on public.contractor_work_entries
for update to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

drop policy if exists contractor_work_entries_delete_own on public.contractor_work_entries;
create policy contractor_work_entries_delete_own
on public.contractor_work_entries
for delete to authenticated
using (profile_id = auth.uid());
