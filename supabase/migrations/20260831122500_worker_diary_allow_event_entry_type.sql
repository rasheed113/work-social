alter table public.worker_diary_entries
  drop constraint if exists worker_diary_entries_entry_type_check;

alter table public.worker_diary_entries
  add constraint worker_diary_entries_entry_type_check
  check (entry_type in ('note','todo','idea','journal','anything','event'));
