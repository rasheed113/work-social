import { supabase } from '../../../lib/supabase/client';
import { withSessionRecovery } from '../../auth/api/withSessionRecovery';

export async function getProfile(profileId: string) {
  return withSessionRecovery(() =>
    supabase
      .from('profiles')
      .select(
        'id, username, display_name, bio, avatar_url, date_of_birth, gender, location, website, created_at, updated_at',
      )
      .eq('id', profileId)
      .single(),
  );
}
