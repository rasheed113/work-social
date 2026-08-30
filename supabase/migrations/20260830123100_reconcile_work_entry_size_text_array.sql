-- Reconcile production Work Entry Size storage with the approved optional
-- TRUE MULTI-SIZE contract without replaying the historical Size migrations.
--
-- Production currently contains both legacy scalar text values and values that
-- were previously persisted as serialized JSON arrays. This migration parses
-- valid JSON string arrays into native text[] values and preserves ordinary
-- scalar text as one-element arrays. NULL remains NULL.
--
-- The preflight intentionally fails the migration for any value that cannot be
-- deterministically converted to a valid approved Size array. No value is
-- silently discarded, invented, or delimiter-split.

DO $$
DECLARE
  invalid_value text;
BEGIN
  -- A JSON-looking value must be a JSON array of strings, with at least one
  -- non-empty, <=100-character trimmed element and no duplicate trimmed values.
  SELECT size
    INTO invalid_value
  FROM public.work_entries
  WHERE size IS NOT NULL
    AND (
      (btrim(size) LIKE '[%]'
       AND (
         (btrim(size)::jsonb IS NULL)
         OR jsonb_typeof(btrim(size)::jsonb) <> 'array'
         OR jsonb_array_length(btrim(size)::jsonb) = 0
         OR EXISTS (
              SELECT 1
              FROM jsonb_array_elements(btrim(size)::jsonb) AS element
              WHERE jsonb_typeof(element) <> 'string'
                 OR char_length(btrim(element #>> '{}')) NOT BETWEEN 1 AND 100
            )
         OR jsonb_array_length(btrim(size)::jsonb) <> (
              SELECT count(DISTINCT btrim(element #>> '{}'))
              FROM jsonb_array_elements(btrim(size)::jsonb) AS element
            )
       )
      )
      OR (NOT (btrim(size) LIKE '[%]')
          AND char_length(btrim(size)) NOT BETWEEN 1 AND 100)
    )
  LIMIT 1;

  IF invalid_value IS NOT NULL THEN
    RAISE EXCEPTION
      'Cannot safely reconcile public.work_entries.size value: %', invalid_value;
  END IF;
EXCEPTION
  WHEN invalid_text_representation OR invalid_parameter_value THEN
    RAISE EXCEPTION
      'Cannot safely parse a JSON-looking public.work_entries.size value; migration aborted';
END
$$;

DO $$
DECLARE
  invalid_value text;
BEGIN
  SELECT size
    INTO invalid_value
  FROM public.work_entry_versions
  WHERE size IS NOT NULL
    AND (
      (btrim(size) LIKE '[%]'
       AND (
         (btrim(size)::jsonb IS NULL)
         OR jsonb_typeof(btrim(size)::jsonb) <> 'array'
         OR jsonb_array_length(btrim(size)::jsonb) = 0
         OR EXISTS (
              SELECT 1
              FROM jsonb_array_elements(btrim(size)::jsonb) AS element
              WHERE jsonb_typeof(element) <> 'string'
                 OR char_length(btrim(element #>> '{}')) NOT BETWEEN 1 AND 100
            )
         OR jsonb_array_length(btrim(size)::jsonb) <> (
              SELECT count(DISTINCT btrim(element #>> '{}'))
              FROM jsonb_array_elements(btrim(size)::jsonb) AS element
            )
       )
      )
      OR (NOT (btrim(size) LIKE '[%]')
          AND char_length(btrim(size)) NOT BETWEEN 1 AND 100)
    )
  LIMIT 1;

  IF invalid_value IS NOT NULL THEN
    RAISE EXCEPTION
      'Cannot safely reconcile public.work_entry_versions.size value: %', invalid_value;
  END IF;
EXCEPTION
  WHEN invalid_text_representation OR invalid_parameter_value THEN
    RAISE EXCEPTION
      'Cannot safely parse a JSON-looking public.work_entry_versions.size value; migration aborted';
END
$$;

ALTER TABLE public.work_entries
  DROP CONSTRAINT IF EXISTS work_entries_size_check;

ALTER TABLE public.work_entry_versions
  DROP CONSTRAINT IF EXISTS work_entry_versions_size_check;

ALTER TABLE public.work_entries
  ALTER COLUMN size DROP NOT NULL;

ALTER TABLE public.work_entry_versions
  ALTER COLUMN size DROP NOT NULL;

ALTER TABLE public.work_entries
  ALTER COLUMN size TYPE text[]
  USING CASE
    WHEN size IS NULL THEN NULL
    WHEN btrim(size) LIKE '[%]'
      THEN (
        SELECT array_agg(btrim(element #>> '{}') ORDER BY ordinality)
        FROM jsonb_array_elements(btrim(size)::jsonb) WITH ORDINALITY AS elements(element, ordinality)
      )
    ELSE ARRAY[btrim(size)]
  END;

ALTER TABLE public.work_entry_versions
  ALTER COLUMN size TYPE text[]
  USING CASE
    WHEN size IS NULL THEN NULL
    WHEN btrim(size) LIKE '[%]'
      THEN (
        SELECT array_agg(btrim(element #>> '{}') ORDER BY ordinality)
        FROM jsonb_array_elements(btrim(size)::jsonb) WITH ORDINALITY AS elements(element, ordinality)
      )
    ELSE ARRAY[btrim(size)]
  END;

CREATE OR REPLACE FUNCTION private.is_valid_work_entry_sizes(p_sizes text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT
    p_sizes IS NULL
    OR (
      cardinality(p_sizes) > 0
      AND NOT EXISTS (
        SELECT 1
        FROM unnest(p_sizes) AS size_value
        WHERE size_value IS NULL
           OR char_length(btrim(size_value)) NOT BETWEEN 1 AND 100
      )
      AND cardinality(p_sizes) = (
        SELECT count(DISTINCT btrim(size_value))
        FROM unnest(p_sizes) AS size_value
      )
    );
$$;

ALTER TABLE public.work_entries
  ADD CONSTRAINT work_entries_size_values_check
  CHECK (private.is_valid_work_entry_sizes(size));

ALTER TABLE public.work_entry_versions
  ADD CONSTRAINT work_entry_versions_size_values_check
  CHECK (private.is_valid_work_entry_sizes(size));
