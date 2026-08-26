import { supabase } from '../../../lib/supabase/client';

export async function updatePost(postId: string, content: string) {
  return supabase.from('posts').update({ content: content.trim() }).eq('id', postId).select().single();
}
