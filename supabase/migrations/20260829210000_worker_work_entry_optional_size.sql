-- Phase 3C: Size is optional and remains a flexible human-readable text value.
-- Existing non-empty sizes remain valid; NULL represents an intentionally omitted size.
alter table public.work_entries
  alter column size drop not null;

alter table public.work_entry_versions
  alter column size drop not null;
