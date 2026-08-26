import { supabase } from '../../../lib/supabase/client';

export interface PostAttachmentInput { file: File; kind: 'image' | 'video' | 'file'; }
export interface PostLocationInput { latitude: number; longitude: number; name?: string; }

export async function createPost(profileId: string, content: string, attachments: PostAttachmentInput[] = [], location: PostLocationInput | null = null) {
  const normalizedContent = content.trim();
  if (!normalizedContent && attachments.length === 0 && !location) return { data: null, error: new Error('Post cannot be empty.') };
  const { data: post, error: postError } = await supabase.from('posts').insert({ profile_id: profileId, content: normalizedContent, latitude: location?.latitude ?? null, longitude: location?.longitude ?? null, location_name: location?.name ?? null }).select().single();
  if (postError || !post) return { data: null, error: postError ?? new Error('Post could not be created.') };
  for (const attachment of attachments) {
    const safeName = attachment.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${profileId}/${post.id}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from('post-media').upload(storagePath, attachment.file, { upsert: false, contentType: attachment.file.type || undefined });
    if (uploadError) { await supabase.from('posts').delete().eq('id', post.id); return { data: null, error: uploadError }; }
    const { error: attachmentError } = await supabase.from('post_attachments').insert({ post_id: post.id, profile_id: profileId, kind: attachment.kind, storage_path: storagePath, file_name: attachment.file.name, mime_type: attachment.file.type || null, file_size: attachment.file.size });
    if (attachmentError) { await supabase.storage.from('post-media').remove([storagePath]); await supabase.from('posts').delete().eq('id', post.id); return { data: null, error: attachmentError }; }
  }
  return { data: post, error: null };
}
