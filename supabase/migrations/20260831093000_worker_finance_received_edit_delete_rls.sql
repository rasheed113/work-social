-- Allow Workers to edit/delete only their own received amount history.
-- The existing SELECT/INSERT ownership model remains unchanged.

ALTER TABLE public.worker_finance_received ENABLE ROW LEVEL SECURITY;

REVOKE UPDATE, DELETE ON TABLE public.worker_finance_received FROM anon, authenticated;
GRANT UPDATE, DELETE ON TABLE public.worker_finance_received TO authenticated;

DROP POLICY IF EXISTS "Workers can update own finance received" ON public.worker_finance_received;
DROP POLICY IF EXISTS "Workers can delete own finance received" ON public.worker_finance_received;

CREATE POLICY "Workers can update own finance received"
  ON public.worker_finance_received
  FOR UPDATE
  TO authenticated
  USING (
    worker_profile_id IN (
      SELECT wp.id
      FROM public.worker_profiles wp
      WHERE wp.profile_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    worker_profile_id IN (
      SELECT wp.id
      FROM public.worker_profiles wp
      WHERE wp.profile_id = (SELECT auth.uid())
    )
    AND entry_type IN ('payment', 'advance')
    AND amount > 0
  );

CREATE POLICY "Workers can delete own finance received"
  ON public.worker_finance_received
  FOR DELETE
  TO authenticated
  USING (
    worker_profile_id IN (
      SELECT wp.id
      FROM public.worker_profiles wp
      WHERE wp.profile_id = (SELECT auth.uid())
    )
  );
