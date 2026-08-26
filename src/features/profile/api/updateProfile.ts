import { supabase } from '../../../lib/supabase/client';

export interface ProfileUpdateInput {
  display_name: string;
  bio: string;
  avatar_url: string;
}

export async function updateProfile(profileId: string, input: ProfileUpdateInput) {
  return supabase
    .from('profiles')
    .update({
      display_name: input.display_name.trim(),
      bio: input.bio.trim() || null,
      avatar_url: input.avatar_url.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profileId)
    .select('id, username, display_name, bio, avatar_url, created_at, updated_at')
    .single();
}
