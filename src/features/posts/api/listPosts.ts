import { supabase } from '../../../lib/supabase/client';

export type PostFeedScope = 'profile' | 'public';

export async function listPosts(profileId?: string, scope: PostFeedScope = 'profile') {
  let query = supabase
    .from('posts')
    .select('id, profile_id, content, privacy, latitude, longitude, location_name, created_at, profiles(username, display_name, avatar_url)')
    .order('created_at', { ascending: false });

  if (profileId) query = query.eq('profile_id', profileId);
  if (scope === 'public') query = query.eq('privacy', 'public');

  const { data: posts, error } = await query;
  if (error || !posts) return { data: posts, error };
  if (!posts.length) return { data: posts, error: null };

  const { data: attachments, error: attachmentError } = await supabase
    .from('post_attachments')
    .select('id, post_id, kind, storage_path, file_name, mime_type, file_size')
    .in('post_id', posts.map((post) => post.id))
    .order('created_at', { ascending: true });

  if (attachmentError) return { data: null, error: attachmentError };

  const attachmentMap = new Map<string, any[]>();
  (attachments ?? []).forEach((attachment) => {
    const current = attachmentMap.get(attachment.post_id) ?? [];
    const { data } = supabase.storage.from('post-media').getPublicUrl(attachment.storage_path);
    current.push({ ...attachment, public_url: data.publicUrl });
    attachmentMap.set(attachment.post_id, current);
  });

  return {
    data: posts.map((post) => ({ ...post, attachments: attachmentMap.get(post.id) ?? [] })),
    error: null,
  };
}
