create table if not exists public.contractor_work_entry_trash (
  id uuid primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  item_name text not null,
  size text not null,
  pieces numeric not null,
  rate_per_piece numeric not null,
  commission_type text,
  commission_value numeric,
  commission_mode text,
  commission_per_piece numeric not null default 0,
  actual_rate_per_piece numeric not null,
  total numeric not null,
  occurred_at timestamptz not null,
  special_note text,
  deleted_at timestamptz not null default now()
);

alter table public.contractor_work_entry_trash enable row level security;
grant select, delete on public.contractor_work_entry_trash to authenticated;

drop policy if exists contractor_work_entry_trash_select_own on public.contractor_work_entry_trash;
create policy contractor_work_entry_trash_select_own on public.contractor_work_entry_trash for select to authenticated using (profile_id = auth.uid());

drop policy if exists contractor_work_entry_trash_delete_own on public.contractor_work_entry_trash;
create policy contractor_work_entry_trash_delete_own on public.contractor_work_entry_trash for delete to authenticated using (profile_id = auth.uid());

create or replace function public.move_contractor_work_entry_to_trash()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if old.profile_id <> auth.uid() then raise exception 'not authorized'; end if;
  insert into public.contractor_work_entry_trash (
    id, profile_id, item_name, size, pieces, rate_per_piece,
    commission_type, commission_value, commission_mode,
    commission_per_piece, actual_rate_per_piece, total,
    occurred_at, special_note, deleted_at
  ) values (
    old.id, old.profile_id, old.item_name, old.size, old.pieces, old.rate_per_piece,
    old.commission_type, old.commission_value, old.commission_mode,
    old.commission_per_piece, old.actual_rate_per_piece, old.total,
    old.occurred_at, old.special_note, now()
  )
  on conflict (id) do update set deleted_at = excluded.deleted_at;
  return old;
end;
$$;
revoke all on function public.move_contractor_work_entry_to_trash() from public;
grant execute on function public.move_contractor_work_entry_to_trash() to authenticated;

drop trigger if exists contractor_work_entry_before_delete_trash on public.contractor_work_entries;
create trigger contractor_work_entry_before_delete_trash before delete on public.contractor_work_entries for each row execute function public.move_contractor_work_entry_to_trash();

create index if not exists contractor_work_entry_trash_profile_deleted_idx on public.contractor_work_entry_trash(profile_id, deleted_at desc);
