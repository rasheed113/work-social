import { supabase } from '../../../lib/supabase/client';

export async function listPosts() {
  return supabase
    .from('posts')
    .select('id, profile_id, content, privacy, created_at, profiles(username, display_name, avatar_url)')
    .order('created_at', { ascending: false });
}
