-- Work Entry Size now represents a truthful optional list of values.
-- Existing single values are migrated as one-element arrays; NULL remains NULL.
-- No JSON, delimiter encoding, or first-value-only persistence is introduced.

create or replace function private.is_valid_work_entry_sizes(p_sizes text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    p_sizes is null
    or (
      cardinality(p_sizes) > 0
      and not exists (
        select 1
        from unnest(p_sizes) as size_value
        where size_value is null
           or char_length(btrim(size_value)) not between 1 and 100
      )
      and cardinality(p_sizes) = (
        select count(distinct btrim(size_value))
        from unnest(p_sizes) as size_value
      )
    );
$$;

alter table public.work_entries
  drop constraint if exists work_entries_size_check;

alter table public.work_entry_versions
  drop constraint if exists work_entry_versions_size_check;

alter table public.work_entries
  alter column size type text[]
  using case
    when size is null then null
    else array[btrim(size)]
  end;

alter table public.work_entry_versions
  alter column size type text[]
  using case
    when size is null then null
    else array[btrim(size)]
  end;

alter table public.work_entries
  add constraint work_entries_size_values_check
  check (private.is_valid_work_entry_sizes(size));

alter table public.work_entry_versions
  add constraint work_entry_versions_size_values_check
  check (private.is_valid_work_entry_sizes(size));
