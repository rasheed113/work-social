-- Keep system-owned Worker Identity fields immutable from the client.
create or replace function public.protect_worker_profile_fields()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.work_id is distinct from old.work_id then
    raise exception 'work_id is system generated and cannot be changed';
  end if;

  if new.work_role is distinct from old.work_role then
    raise exception 'work_role cannot be changed in Worker v1';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_worker_profile_fields() from public, anon, authenticated;

drop trigger if exists trg_protect_worker_profile_fields on public.worker_profiles;
create trigger trg_protect_worker_profile_fields
before update on public.worker_profiles
for each row execute function public.protect_worker_profile_fields();
