import { supabase } from '../../../lib/supabase/client';

export async function createPost(profileId: string, content: string) {
  const normalizedContent = content.trim();
  if (!normalizedContent) return { data: null, error: new Error('Post cannot be empty.') };
  return supabase.from('posts').insert({ profile_id: profileId, content: normalizedContent }).select().single();
}
