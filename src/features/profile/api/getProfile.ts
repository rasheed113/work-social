import { supabase } from '../../../lib/supabase/client';

export async function getProfile(profileId: string) {
  return supabase
    .from('profiles')
    .select(
      'id, username, display_name, bio, avatar_url, date_of_birth, gender, location, website, created_at, updated_at',
    )
    .eq('id', profileId)
    .single();
}
