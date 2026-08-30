import { supabase } from '../../../lib/supabase/client';

const JWT_ISSUED_AT_FUTURE = 'jwt issued at future';
let refreshInFlight: Promise<boolean> | null = null;

export function isJwtIssuedAtFutureError(error: { message?: string } | null | undefined) {
  return error?.message?.trim().toLowerCase().includes(JWT_ISSUED_AT_FUTURE) ?? false;
}

export async function refreshSessionAfterJwtClockError(error: { message?: string } | null | undefined) {
  if (!isJwtIssuedAtFutureError(error)) return false;

  if (!refreshInFlight) {
    refreshInFlight = supabase.auth.refreshSession()
      .then(({ error: refreshError }) => !refreshError)
      .finally(() => {
        refreshInFlight = null;
      });
  }

  return refreshInFlight;
}
