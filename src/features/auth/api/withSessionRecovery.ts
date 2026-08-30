import { supabase } from '../../../lib/supabase/client';

const JWT_ISSUED_AT_FUTURE = 'jwt issued at future';

function isJwtIssuedAtFutureError(error: { message?: string } | null | undefined) {
  return error?.message?.trim().toLowerCase().includes(JWT_ISSUED_AT_FUTURE) ?? false;
}

/**
 * A persisted Supabase session can contain a token whose iat is now in the
 * future relative to the PostgREST clock (for example after restoring a stale
 * session created while a clock was skewed). Refreshing asks Supabase Auth
 * for a newly issued token; it does not disable JWT validation or alter RLS.
 *
 * Retry at most once and only for this exact server-side JWT clock error.
 */
export async function withSessionRecovery<T extends { error: { message?: string } | null }>(
  operation: () => Promise<T>,
): Promise<T> {
  const first = await operation();
  if (!isJwtIssuedAtFutureError(first.error)) return first;

  const { error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) return first;

  return operation();
}
