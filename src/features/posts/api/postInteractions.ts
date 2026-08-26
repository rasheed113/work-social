import { supabase } from '../../../lib/supabase/client';

export const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '😡'] as const;

export async function getPostInteractions(postId: string, profileId: string) {
  const [reactions, comments] = await Promise.all([
    supabase.from('post_reactions').select('reaction, profile_id').eq('post_id', postId),
    supabase.from('post_comments').select('id, profile_id, content, created_at, updated_at, profiles(display_name, avatar_url)').eq('post_id', postId).order('created_at', { ascending: true }),
  ]);
  return { reactions: reactions.data ?? [], comments: comments.data ?? [], error: reactions.error ?? comments.error };
}

export async function setPostReaction(postId: string, profileId: string, reaction: string) {
  if (!REACTIONS.includes(reaction as typeof REACTIONS[number])) return { data: null, error: new Error('Invalid reaction.') };
  return supabase.from('post_reactions').upsert({ post_id: postId, profile_id: profileId, reaction }, { onConflict: 'post_id,profile_id' }).select().single();
}

export async function removePostReaction(postId: string, profileId: string) {
  return supabase.from('post_reactions').delete().eq('post_id', postId).eq('profile_id', profileId);
}

export async function addPostComment(postId: string, profileId: string, content: string) {
  const normalizedContent = content.trim();
  if (!normalizedContent) return { data: null, error: new Error('Comment cannot be empty.') };
  return supabase.from('post_comments').insert({ post_id: postId, profile_id: profileId, content: normalizedContent }).select('id, post_id, profile_id, content, created_at, updated_at').single();
}

export async function updatePostComment(commentId: string, content: string) {
  const normalizedContent = content.trim();
  if (!normalizedContent) return { data: null, error: new Error('Comment cannot be empty.') };
  return supabase.from('post_comments').update({ content: normalizedContent }).eq('id', commentId).select().single();
}

export async function deletePostComment(commentId: string) {
  return supabase.from('post_comments').delete().eq('id', commentId);
}
