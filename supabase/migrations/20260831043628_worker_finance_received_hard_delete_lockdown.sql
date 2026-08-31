-- Finance deletion is a reversible soft-delete operation.
-- Remove direct client hard-delete capability while retaining owner-only UPDATE for delete/restore.

REVOKE DELETE ON TABLE public.worker_finance_received FROM anon, authenticated;
DROP POLICY IF EXISTS "Workers can delete own finance received" ON public.worker_finance_received;
