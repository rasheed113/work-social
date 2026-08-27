import { useEffect, useRef, useState } from 'react';
import { listPosts, type PostFeedScope } from '../api/listPosts';
import { deletePost } from '../api/deletePost';
import { updatePost } from '../api/updatePost';
import { updatePostPrivacy, type PostPrivacy } from '../api/updatePostPrivacy';
import { supabase } from '../../../lib/supabase/client';

interface PostFeedProps { refreshKey: number; profileId: string; feedProfileId?: string; scope?: PostFeedScope; }
type ReactionName = 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry';
const privacyLabels: Record<PostPrivacy, string> = { public: '🌎 Public', friends: '👥 Friends', private: '🔒 Only me' };
const reactionOptions: { value: ReactionName; emoji: string; label: string }[] = [
  { value: 'like', emoji: '👍', label: 'Like' }, { value: 'love', emoji: '❤️', label: 'Love' }, { value: 'haha', emoji: '😂', label: 'Haha' },
  { value: 'wow', emoji: '😮', label: 'Wow' }, { value: 'sad', emoji: '😢', label: 'Sad' }, { value: 'angry', emoji: '😡', label: 'Angry' },
];
const reactionEmoji = Object.fromEntries(reactionOptions.map((item) => [item.value, item.emoji])) as Record<ReactionName, string>;

export function PostFeed({ refreshKey, profileId, feedProfileId, scope = 'profile' }: PostFeedProps) {
  const [posts, setPosts] = useState<any[]>([]); const [error, setError] = useState<string | null>(null); const [editingId, setEditingId] = useState<string | null>(null); const [editContent, setEditContent] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null); const [openReactionId, setOpenReactionId] = useState<string | null>(null); const [reactionCounts, setReactionCounts] = useState<Record<string, Record<string, number>>>({});
  const [myReactions, setMyReactions] = useState<Record<string, ReactionName | null>>({}); const [comments, setComments] = useState<Record<string, any[]>>({}); const [commentText, setCommentText] = useState<Record<string, string>>({}); const [openCommentsId, setOpenCommentsId] = useState<string | null>(null); const [replyToCommentId, setReplyToCommentId] = useState<string | null>(null); const [replyText, setReplyText] = useState('');
  const reactionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const loadInteractions = async (items: any[]) => {
    if (!items.length) return; const ids = items.map((post) => post.id);
    const [{ data: reactionRows, error: reactionError }, { data: commentRows, error: commentError }] = await Promise.all([
      supabase.from('post_reactions').select('post_id, profile_id, reaction').in('post_id', ids),
      supabase.from('post_comments').select('id, post_id, profile_id, parent_comment_id, content, created_at, updated_at, profiles(display_name, avatar_url)').in('post_id', ids).order('created_at', { ascending: true }),
    ]);
    if (reactionError) return setError(reactionError.message); if (commentError) return setError(commentError.message);
    const counts: Record<string, Record<string, number>> = {}; const mine: Record<string, ReactionName | null> = {}; const grouped: Record<string, any[]> = {};
    (reactionRows ?? []).forEach((row: any) => { counts[row.post_id] ??= {}; counts[row.post_id][row.reaction] = (counts[row.post_id][row.reaction] ?? 0) + 1; if (row.profile_id === profileId) mine[row.post_id] = row.reaction as ReactionName; });
    (commentRows ?? []).forEach((row: any) => { grouped[row.post_id] ??= []; grouped[row.post_id].push(row); }); setReactionCounts(counts); setMyReactions(mine); setComments(grouped);
  };

  const loadPosts = async () => {
    const targetProfileId = scope === 'profile' ? (feedProfileId ?? profileId) : undefined;
    const { data, error: loadError } = await listPosts(targetProfileId, scope);
    if (loadError) setError(loadError.message);
    else { const items = data ?? []; setPosts(items); await loadInteractions(items); }
  };

  useEffect(() => { void loadPosts(); }, [refreshKey, profileId, feedProfileId, scope]);
  useEffect(() => { const close = (event: MouseEvent | TouchEvent) => { const target = event.target as Node; if (!Object.values(reactionRefs.current).some((node) => node?.contains(target))) setOpenReactionId(null); }; document.addEventListener('mousedown', close); document.addEventListener('touchstart', close); return () => { document.removeEventListener('mousedown', close); document.removeEventListener('touchstart', close); }; }, []);

  const startEdit = (post: any) => { setEditingId(post.id); setEditContent(post.content ?? ''); setOpenMenuId(null); };
  const saveEdit = async (postId: string) => { const { error: e } = await updatePost(postId, editContent); if (e) return setError(e.message); setEditingId(null); setEditContent(''); await loadPosts(); };
  const removePost = async (postId: string) => { if (!window.confirm('Delete this post?')) return; const { error: e } = await deletePost(postId); if (e) return setError(e.message); setOpenMenuId(null); await loadPosts(); };
  const changePrivacy = async (postId: string, privacy: PostPrivacy) => { const { error: e } = await updatePostPrivacy(postId, privacy); if (e) return setError(e.message); setOpenMenuId(null); await loadPosts(); };
  const react = async (postId: string, reaction: ReactionName) => { const current = myReactions[postId]; const result = current === reaction ? await supabase.from('post_reactions').delete().eq('post_id', postId).eq('profile_id', profileId) : await supabase.from('post_reactions').upsert({ post_id: postId, profile_id: profileId, reaction }, { onConflict: 'post_id,profile_id' }); if (result.error) return setError(result.error.message); setOpenReactionId(null); await loadPosts(); };
  const addComment = async (postId: string, parentCommentId: string | null = null) => {
    const content = (parentCommentId ? replyText : commentText[postId] ?? '').trim(); if (!content) return;
    const { data, error: e } = await supabase.from('post_comments').insert({ post_id: postId, profile_id: profileId, parent_comment_id: parentCommentId, content }).select('id, post_id, profile_id, parent_comment_id, content, created_at, updated_at, profiles(display_name, avatar_url)').single();
    if (e) return setError(e.message);
    if (parentCommentId) { setReplyText(''); setReplyToCommentId(null); } else setCommentText((current) => ({ ...current, [postId]: '' }));
    setComments((current) => ({ ...current, [postId]: [...(current[postId] ?? []), data] }));
  };

  return <section><h2>Posts</h2>{error && <p role="alert">{error}</p>}
    {posts.map((post) => {
      const isOwner = post.profile_id === profileId; const privacy = (post.privacy ?? 'public') as PostPrivacy; const counts = reactionCounts[post.id] ?? {}; const myReaction = myReactions[post.id]; const totalReactions = Object.values(counts).reduce((sum, value) => sum + value, 0); const postComments = comments[post.id] ?? []; const latestComment = postComments[postComments.length - 1]; const attachments = post.attachments ?? [];
      return <article key={post.id} style={{ position: 'relative', marginBottom: 16, padding: 16, border: '1px solid rgba(0,0,0,.12)', borderRadius: 12 }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} alt="" width={44} height={44} style={{ borderRadius: '50%', objectFit: 'cover' }} /> : <div aria-hidden="true" style={{ width: 44, height: 44, borderRadius: '50%', display: 'grid', placeItems: 'center', background: '#eee' }}>👤</div>}<strong>{post.profiles?.display_name ?? 'User'}</strong><span style={{ marginLeft: 'auto' }}>{new Date(post.created_at).toLocaleString()}</span><button type="button" aria-label="Post options" onClick={() => setOpenMenuId(openMenuId === post.id ? null : post.id)}>⋯</button></header>
        {openMenuId === post.id && <div role="menu" style={{ position: 'absolute', right: 16, top: 64, zIndex: 2, padding: 10, display: 'grid', gap: 4, background: 'white', border: '1px solid rgba(0,0,0,.15)', borderRadius: 10 }}><strong>Privacy</strong>{(['public', 'friends', 'private'] as PostPrivacy[]).map((value) => <button key={value} type="button" onClick={() => void changePrivacy(post.id, value)}>{privacyLabels[value]}{privacy === value ? ' ✓' : ''}</button>)}{isOwner && <><button type="button" onClick={() => startEdit(post)}>Edit</button><button type="button" onClick={() => void removePost(post.id)}>Delete</button></>}</div>}
        {editingId === post.id ? <div><textarea value={editContent} onChange={(event) => setEditContent(event.target.value)} rows={4} /><div><button type="button" onClick={() => void saveEdit(post.id)}>Save</button><button type="button" onClick={() => setEditingId(null)}>Cancel</button></div></div> : post.content && <p>{post.content}</p>}
        {attachments.length > 0 && <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>{attachments.map((attachment: any) => attachment.kind === 'image' ? <img key={attachment.id} src={attachment.public_url} alt={attachment.file_name ?? 'Post image'} style={{ maxWidth: '100%', maxHeight: 520, objectFit: 'contain', borderRadius: 10 }} /> : attachment.kind === 'video' ? <video key={attachment.id} src={attachment.public_url} controls preload="metadata" style={{ width: '100%', maxHeight: 520, borderRadius: 10 }} /> : <a key={attachment.id} href={attachment.public_url} target="_blank" rel="noreferrer">📎 {attachment.file_name ?? 'Attached file'}</a>)}</div>}
        {(post.location_name || post.latitude !== null) && <div style={{ marginTop: 8 }}>📍 {post.location_name ?? `${Number(post.latitude).toFixed(5)}, ${Number(post.longitude).toFixed(5)}`}</div>}
        <small>{privacyLabels[privacy]} · {new Date(post.created_at).toLocaleString()}</small>
        <footer style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}><div ref={(node) => { reactionRefs.current[post.id] = node; }} style={{ position: 'relative' }}><button type="button" aria-haspopup="true" aria-expanded={openReactionId === post.id} onClick={() => setOpenReactionId(openReactionId === post.id ? null : post.id)}>{myReaction ? `${reactionEmoji[myReaction]} ${counts[myReaction] ?? 0}` : `❤️ Like${totalReactions ? ` (${totalReactions})` : ''}`}</button>{openReactionId === post.id && <div role="group" aria-label="Reactions" style={{ position: 'absolute', left: 0, bottom: 'calc(100% + 6px)', zIndex: 5, display: 'flex', gap: 6, padding: 8, background: 'white', border: '1px solid rgba(0,0,0,.15)', borderRadius: 12, boxShadow: '0 4px 16px rgba(0,0,0,.15)' }}>{reactionOptions.map((item) => <button key={item.value} type="button" aria-label={item.label} title={item.label} onClick={() => void react(post.id, item.value)} style={{ fontSize: 22 }}>{item.emoji}</button>)}</div>}</div><button type="button" onClick={async () => { const url = `${window.location.origin}/?post=${encodeURIComponent(post.id)}`; if (navigator.share) await navigator.share({ title: 'Work Social post', text: post.content ?? '', url }); else await navigator.clipboard.writeText(url); }}>↗️ Share</button></div>
          {!openCommentsId && latestComment && <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(0,0,0,.08)' }}><div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}><strong>{latestComment.profiles?.display_name ?? 'User'}</strong><span>{latestComment.content}</span></div><button type="button" onClick={() => setOpenCommentsId(post.id)} style={{ display: 'block', marginTop: 6 }}>View all {postComments.length} comment{postComments.length === 1 ? '' : 's'}</button></div>}
          {openCommentsId === post.id && <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(0,0,0,.08)' }}><button type="button" onClick={() => setOpenCommentsId(null)}>Close comments</button>{postComments.map((comment) => <div key={comment.id} style={{ marginTop: 8, paddingLeft: comment.parent_comment_id ? 18 : 0, borderLeft: comment.parent_comment_id ? '2px solid rgba(0,0,0,.08)' : undefined }}><div><strong>{comment.profiles?.display_name ?? 'User'}</strong><div>{comment.content}</div><button type="button" onClick={() => { setReplyToCommentId(comment.id); setReplyText(''); }}>Reply</button></div>{replyToCommentId === comment.id && <div style={{ display: 'flex', gap: 8, marginTop: 6 }}><input value={replyText} onChange={(event) => setReplyText(event.target.value)} placeholder="Write a reply..." /><button type="button" onClick={() => void addComment(post.id, comment.id)}>Reply</button><button type="button" onClick={() => setReplyToCommentId(null)}>Cancel</button></div>}</div>)}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}><input value={commentText[post.id] ?? ''} onChange={(event) => setCommentText((current) => ({ ...current, [post.id]: event.target.value }))} placeholder="Write a comment..." /><button type="button" onClick={() => void addComment(post.id)}>Comment</button></div>
        </footer>
      </article>;
    })}
    {!error && posts.length === 0 && <p>No posts yet.</p>}
  </section>;
}
