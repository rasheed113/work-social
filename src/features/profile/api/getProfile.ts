import { supabase } from '../../../lib/supabase/client';
import { refreshSessionAfterJwtClockError } from '../../auth/api/refreshSessionAfterJwtClockError';

export async function getProfile(profileId: string) {
  const run = () =>
    supabase
      .from('profiles')
      .select(
        'id, username, display_name, bio, avatar_url, date_of_birth, gender, location, website, created_at, updated_at',
      )
      .eq('id', profileId)
      .single();

  const result = await run();
  if (await refreshSessionAfterJwtClockError(result.error)) return run();
  return result;
}
