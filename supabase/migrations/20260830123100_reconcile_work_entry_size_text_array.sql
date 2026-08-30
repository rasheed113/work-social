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

-- ALTER TABLE ... USING expressions cannot contain subqueries. Keep the JSON
-- parsing in a narrowly scoped helper so the conversion remains exact and
-- transactional. The helper is removed before the migration completes.
CREATE OR REPLACE FUNCTION private.reconcile_work_entry_size_text_value(p_size text)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  parsed jsonb;
  converted text[];
BEGIN
  IF p_size IS NULL THEN
    RETURN NULL;
  END IF;

  IF btrim(p_size) LIKE '[%]' THEN
    parsed := btrim(p_size)::jsonb;
    SELECT array_agg(btrim(element #>> '{}') ORDER BY ordinality)
      INTO converted
    FROM jsonb_array_elements(parsed) WITH ORDINALITY AS elements(element, ordinality);
    RETURN converted;
  END IF;

  RETURN ARRAY[btrim(p_size)];
END;
$$;

-- PostgreSQL prevents changing a column's type while an UPDATE OF trigger
-- depends on that column. Temporarily remove only the existing audit trigger;
-- it is recreated verbatim below with the same event semantics and function.
DROP TRIGGER work_entries_record_version ON public.work_entries;

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
  USING private.reconcile_work_entry_size_text_value(size);

ALTER TABLE public.work_entry_versions
  ALTER COLUMN size TYPE text[]
  USING private.reconcile_work_entry_size_text_value(size);

DROP FUNCTION private.reconcile_work_entry_size_text_value(text);

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

CREATE TRIGGER work_entries_record_version
AFTER INSERT OR UPDATE OF item_name, size, quantity, rate, special_note
ON public.work_entries
FOR EACH ROW
EXECUTE FUNCTION private.record_work_entry_version();
