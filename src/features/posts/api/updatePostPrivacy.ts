import { supabase } from '../../../lib/supabase/client';

export type PostPrivacy = 'public' | 'friends' | 'private';

export async function updatePostPrivacy(postId: string, privacy: PostPrivacy) {
  return supabase.from('posts').update({ privacy }).eq('id', postId).select('id, privacy').single();
}
