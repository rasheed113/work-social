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
  const displayName = input.display_name.trim();
  const bio = input.bio.trim();
  const location = input.location.trim();
  const website = input.website.trim();

  if (!displayName) {
    return {
      data: null,
      error: new Error('Display name is required.'),
    };
  }

  if (website) {
    try {
      const url = new URL(website);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
    } catch {
      return {
        data: null,
        error: new Error('Website must be a valid HTTP or HTTPS URL.'),
      };
    }
  }

  return supabase
    .from('profiles')
    .update({
      display_name: displayName,
      bio: bio || null,
      date_of_birth: input.date_of_birth || null,
      gender: input.gender || null,
      location: location || null,
      website: website || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profileId)
    .select(
      'id, username, display_name, bio, avatar_url, date_of_birth, gender, location, website, created_at, updated_at',
    )
    .single();
}
