import { supabase } from '../../../lib/supabase/client';

const JWT_ISSUED_AT_FUTURE = 'jwt issued at future';
let refreshInFlight: Promise<boolean> | null = null;

function isJwtIssuedAtFutureError(error: { message?: string } | null | undefined) {
  return error?.message?.trim().toLowerCase().includes(JWT_ISSUED_AT_FUTURE) ?? false;
}

async function refreshSessionOnce() {
  if (!refreshInFlight) {
    refreshInFlight = supabase.auth.refreshSession()
      .then(({ error }) => !error)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

/**
 * Recover once from the specific PostgREST "JWT issued at future" error by
 * asking Supabase Auth for a newly issued session. This never disables JWT
 * validation, changes auth.uid(), or bypasses RLS.
 *
 * The error accessor keeps this helper independent of Supabase response types
 * and allows concurrent Worker requests to share one refresh-token rotation.
 */
export async function withSessionRecovery<T>(
  operation: () => Promise<T>,
  getError: (result: T) => { message?: string } | null | undefined,
): Promise<T> {
  const first = await operation();
  if (!isJwtIssuedAtFutureError(getError(first))) return first;

  if (!(await refreshSessionOnce())) return first;

  return operation();
}
