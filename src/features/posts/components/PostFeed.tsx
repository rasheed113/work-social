import { useEffect, useRef, useState } from 'react';
import { listPosts } from '../api/listPosts';
import { deletePost } from '../api/deletePost';
import { updatePost } from '../api/updatePost';
import { updatePostPrivacy, type PostPrivacy } from '../api/updatePostPrivacy';
import { supabase } from '../../lib/supabase/client';

interface PostFeedProps { refreshKey: number; profileId: string; }

const privacyLabels: Record<PostPrivacy, string> = { public: '🌎 Public', friends: '👥 Friends', private: '🔒 Only me' };
const reactions = ['👍', '❤️', '😂', '😮', '😢', '😡'];

export function PostFeed({ refreshKey, profileId }: PostFeedProps) {
  const [posts, setPosts] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [openReactionId, setOpenReactionId] = useState<string | null>(null);
  const [reactionCounts, setReactionCounts] = useState<Record<string, Record<string, number>>>({});
  const [myReactions, setMyReactions] = useState<Record<string, string | null>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [commentText, setCommentText] = useState<Record<string, string>>({});

  const loadPosts = async () => {
    const { data, error: loadError } = await listPosts();
    if (loadError) setError(loadError.message); else setPosts(data ?? []);
  };

  const loadInteractions = async (items: any[]) => {
    if (!items.length) return;
    const ids = items.map((post) => post.id);
    const [{ data: reactionRows, error: reactionError }, { data: commentRows, error: commentError }] = await Promise.all([
      supabase.from('post_reactions').select('post_id, profile_id, reaction').in('post_id', ids),
      supabase.from('post_comments').select('post_id').in('post_id', ids),
    ]);
    if (reactionError) return setError(reactionError.message);
    if (commentError) return setError(commentError.message);
    const counts: Record<string, Record<string, number>> = {};
    const mine: Record<string, string | null> = {};
    (reactionRows ?? []).forEach((row: any) => {
      counts[row.post_id] ??= {};
      counts[row.post_id][row.reaction] = (counts[row.post_id][row.reaction] ?? 0) + 1;
      if (row.profile_id === profileId) mine[row.post_id] = row.reaction;
    });
    const comments: Record<string, number> = {};
    (commentRows ?? []).forEach((row: any) => { comments[row.post_id] = (comments[row.post_id] ?? 0) + 1; });
    setReactionCounts(counts); setMyReactions(mine); setCommentCounts(comments);
  };

  useEffect(() => {
    let active = true;
    listPosts().then(async ({ data, error: loadError }) => {
      if (!active) return;
      if (loadError) setError(loadError.message);
      else { const items = data ?? []; setPosts(items); await loadInteractions(items); }
    });
    return () => { active = false; };
  }, [refreshKey, profileId]);

  const startEdit = (post: any) => { setEditingId(post.id); setEditContent(post.content); setOpenMenuId(null); };
  const saveEdit = async (postId: string) => { const { error: e } = await updatePost(postId, editContent); if (e) return setError(e.message); setEditingId(null); setEditContent(''); await loadPosts(); };
  const removePost = async (postId: string) => { if (!window.confirm('Delete this post?')) return; const { error: e } = await deletePost(postId); if (e) return setError(e.message); setOpenMenuId(null); await loadPosts(); };
  const changePrivacy = async (postId: string, privacy: PostPrivacy) => { const { error: e } = await updatePostPrivacy(postId, privacy); if (e) return setError(e.message); setOpenMenuId(null); await loadPosts(); };

  const react = async (postId: string, reaction: string) => {
    const current = myReactions[postId];
    if (current === reaction) {
      const { error: e } = await supabase.from('post_reactions').delete().eq('post_id', postId).eq('profile_id', profileId);
      if (e) return setError(e.message);
    } else {
      const { error: e } = await supabase.from('post_reactions').upsert({ post_id: postId, profile_id: profileId, reaction }, { onConflict: 'post_id,profile_id' });
      if (e) return setError(e.message);
    }
    setOpenReactionId(null);
    const { data } = await listPosts();
    if (data) { setPosts(data); await loadInteractions(data); }
  };

  const addComment = async (postId: string) => {
    const content = (commentText[postId] ?? '').trim();
    if (!content) return;
    const { error: e } = await supabase.from('post_comments').insert({ post_id: postId, profile_id: profileId, content });
    if (e) return setError(e.message);
    setCommentText((current) => ({ ...current, [postId]: '' }));
    const { data } = await supabase.from('post_comments').select('post_id').eq('post_id', postId);
    setCommentCounts((current) => ({ ...current, [postId]: data?.length ?? 0 }));
  };

  return <section><h2>Feed</h2>{error && <p role="alert">{error}</p>}
    {posts.map((post) => {
      const isOwner = post.profile_id === profileId;
      const privacy = (post.privacy ?? 'public') as PostPrivacy;
      const counts = reactionCounts[post.id] ?? {};
      const myReaction = myReactions[post.id];
      const totalReactions = Object.values(counts).reduce((sum, value) => sum + value, 0);
      return <article key={post.id} style={{ position: 'relative', marginBottom: 16, padding: 16, border: '1px solid rgba(0,0,0,.12)', borderRadius: 12 }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} alt="" width={44} height={44} style={{ borderRadius: '50%', objectFit: 'cover' }} /> : <div aria-hidden="true" style={{ width: 44, height: 44, borderRadius: '50%', display: 'grid', placeItems: 'center', background: '#eee' }}>👤</div>}
          <strong>{post.profiles?.display_name ?? post.profiles?.username ?? 'User'}</strong>
          <span style={{ marginLeft: 'auto' }}>{new Date(post.created_at).toLocaleString()}</span>
          <button type="button" aria-label="Post options" onClick={() => setOpenMenuId(openMenuId === post.id ? null : post.id)}>⋯</button>
        </header>
        {openMenuId === post.id && <div role="menu" style={{ position: 'absolute', right: 16, top: 64, zIndex: 2, padding: 10, background: 'white', border: '1px solid rgba(0,0,0,.15)', borderRadius: 10 }}><strong>Privacy</strong>{(['public', 'friends', 'private'] as PostPrivacy[]).map((value) => <button key={value} type="button" onClick={() => changePrivacy(post.id, value)}>{privacyLabels[value]}{privacy === value ? ' ✓' : ''}</button>)}</div>}
        {editingId === post.id ? <div><textarea value={editContent} onChange={(event) => setEditContent(event.target.value)} rows={4} /><div><button type="button" onClick={() => void saveEdit(post.id)}>Save</button><button type="button" onClick={() => setEditingId(null)}>Cancel</button></div></div> : <p>{post.content}</p>}
        <small>{privacyLabels[privacy]} · {new Date(post.created_at).toLocaleString()}</small>
        <footer style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-around', gap: 8 }}>
            <button type="button" onClick={() => void react(post.id, myReaction ?? 'like')} onContextMenu={(event) => { event.preventDefault(); setOpenReactionId(openReactionId === post.id ? null : post.id); }}>{myReaction ? `${myReaction} ${counts[myReaction] ?? 0}` : `❤️ Like ${totalReactions ? `(${totalReactions})` : ''}`}</button>
            <button type="button" onClick={() => setOpenReactionId(null)}>💬 Comment {commentCounts[post.id] ? `(${commentCounts[post.id]})` : ''}</button>
            <button type="button" onClick={async () => { const url = window.location.href; if (navigator.share) await navigator.share({ title: 'Work Social post', text: post.content, url }); else await navigator.clipboard.writeText(url); }}>↗️ Share</button>
          </div>
          {openReactionId === post.id && <div role="group" aria-label="Reactions" style={{ display: 'flex', gap: 8, padding: 8, justifyContent: 'center' }}>{reactions.map((reaction) => <button key={reaction} type="button" onClick={() => void react(post.id, reaction)}>{reaction}</button>)}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}><input value={commentText[post.id] ?? ''} onChange={(event) => setCommentText((current) => ({ ...current, [post.id]: event.target.value }))} placeholder="Write a comment..." /><button type="button" onClick={() => void addComment(post.id)}>Comment</button></div>
          {isOwner && <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}><button type="button" onClick={() => startEdit(post)}>Edit</button><button type="button" onClick={() => void removePost(post.id)}>Delete</button></div>}
        </footer>
      </article>;
    })}
    {!error && posts.length === 0 && <p>No posts yet.</p>}</section>;
}
