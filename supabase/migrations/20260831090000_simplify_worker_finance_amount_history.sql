-- Forward-only reconciliation for the Finance simplification.
-- Preserve any existing received history before removing transaction-system baggage.

DO $$
BEGIN
  IF to_regclass('public.worker_finance_transactions') IS NOT NULL
     AND to_regclass('public.worker_finance_received') IS NULL THEN
    ALTER TABLE public.worker_finance_transactions RENAME TO worker_finance_received;
  END IF;
END
$$;

-- The live production schema historically used transaction-oriented names.
-- Rename only the persisted representation; IDs, Worker ownership, amounts and timestamps remain intact.
DO $$
BEGIN
  IF to_regclass('public.worker_finance_received') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'worker_finance_received' AND column_name = 'transaction_type'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'worker_finance_received' AND column_name = 'entry_type'
    ) THEN
      ALTER TABLE public.worker_finance_received RENAME COLUMN transaction_type TO entry_type;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'worker_finance_received' AND column_name = 'occurred_at'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'worker_finance_received' AND column_name = 'received_at'
    ) THEN
      ALTER TABLE public.worker_finance_received RENAME COLUMN occurred_at TO received_at;
    END IF;
  END IF;
END
$$;

-- Normalize the old uppercase representation to the final application representation.
UPDATE public.worker_finance_received
SET entry_type = lower(entry_type)
WHERE entry_type IN ('PAYMENT', 'ADVANCE');

ALTER TABLE public.worker_finance_received
  DROP CONSTRAINT IF EXISTS worker_finance_transactions_transaction_type_check,
  DROP CONSTRAINT IF EXISTS worker_finance_transactions_note_check;

ALTER TABLE public.worker_finance_received
  ADD CONSTRAINT worker_finance_received_entry_type_check CHECK (entry_type IN ('payment', 'advance'));

-- Idempotency and note fields belonged to the old transaction-management model.
-- Only remove them when the table is empty; if real history exists, preserving data wins.
DO $$
DECLARE
  row_count bigint;
BEGIN
  SELECT count(*) INTO row_count FROM public.worker_finance_received;
  IF row_count = 0 THEN
    ALTER TABLE public.worker_finance_received DROP COLUMN IF EXISTS note;
    ALTER TABLE public.worker_finance_received DROP COLUMN IF EXISTS idempotency_key;
    DROP INDEX IF EXISTS public.worker_finance_transactions_worker_idempotency_key_idx;
  END IF;
END
$$;

DROP FUNCTION IF EXISTS public.create_worker_finance_transaction(text, numeric, timestamptz, text, uuid);
DROP FUNCTION IF EXISTS public.get_worker_finance_history(timestamptz, uuid, text, integer);
DROP FUNCTION IF EXISTS public.get_worker_finance_summary();

ALTER TABLE public.worker_finance_received ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.worker_finance_received FROM anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.worker_finance_received TO authenticated;

DROP POLICY IF EXISTS "Workers can view own finance transactions" ON public.worker_finance_received;
DROP POLICY IF EXISTS "Workers can view own finance received" ON public.worker_finance_received;
DROP POLICY IF EXISTS "Workers can create own finance received" ON public.worker_finance_received;

CREATE POLICY "Workers can view own finance received"
  ON public.worker_finance_received
  FOR SELECT
  TO authenticated
  USING (
    worker_profile_id IN (
      SELECT wp.id
      FROM public.worker_profiles wp
      WHERE wp.profile_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Workers can create own finance received"
  ON public.worker_finance_received
  FOR INSERT
  TO authenticated
  WITH CHECK (
    worker_profile_id IN (
      SELECT wp.id
      FROM public.worker_profiles wp
      WHERE wp.profile_id = (SELECT auth.uid())
    )
    AND entry_type IN ('payment', 'advance')
    AND amount > 0
  );
