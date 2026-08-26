import { supabase } from '../../../lib/supabase/client';

export async function deletePost(postId: string) {
  return supabase.from('posts').delete().eq('id', postId);
}
