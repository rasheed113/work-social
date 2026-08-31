-- Preserve received amount history while allowing Finance delete + Undo.
-- NULL means active; a timestamp means deleted.

ALTER TABLE public.worker_finance_received
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS worker_finance_received_active_worker_received_idx
  ON public.worker_finance_received (worker_profile_id, received_at DESC, id DESC)
  WHERE deleted_at IS NULL;
