-- Work Entry Size is ordinary optional user data.
-- Keep the existing 100-character contract and allow historical/current
-- records to represent absence as NULL rather than a sentinel string.

alter table public.work_entries
  alter column size drop not null;

alter table public.work_entry_versions
  alter column size drop not null;
