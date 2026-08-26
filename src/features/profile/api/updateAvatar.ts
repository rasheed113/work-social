import { supabase } from '../../../lib/supabase/client';

export async function updateAvatar(profileId: string, avatarUrl: string) {
  return supabase
    .from('profiles')
    .update({
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profileId)
    .select('id, avatar_url, updated_at')
    .single();
}
