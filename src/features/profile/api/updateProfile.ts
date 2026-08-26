import { supabase } from '../../../lib/supabase/client';

export interface ProfileUpdateInput {
  display_name: string;
  bio: string;
  date_of_birth: string;
  gender: string;
  location: string;
  website: string;
}

export async function updateProfile(profileId: string, input: ProfileUpdateInput) {
  return supabase
    .from('profiles')
    .update({
      display_name: input.display_name.trim(),
      bio: input.bio.trim() || null,
      date_of_birth: input.date_of_birth || null,
      gender: input.gender || null,
      location: input.location.trim() || null,
      website: input.website.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profileId)
    .select(
      'id, username, display_name, bio, avatar_url, date_of_birth, gender, location, website, created_at, updated_at',
    )
    .single();
}
