import { useEffect, useRef, useState, type JSX } from 'react';
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

type CommentProfile = { display_name: string | null; avatar_url: string | null };
type CommentRow = {
  id: string; post_id: string; profile_id: string; parent_comment_id: string | null; content: string;
  created_at: string; updated_at: string; profiles?: CommentProfile | CommentProfile[] | null;
};
const commentProfile = (comment: CommentRow): CommentProfile | null => Array.isArray(comment.profiles) ? (comment.profiles[0] ?? null) : (comment.profiles ?? null);

type LightboxMedia = { type: 'image' | 'video'; url: string; alt?: string };

const glassCard: React.CSSProperties = { background: 'linear-gradient(145deg, rgba(255,255,255,.98), rgba(247,249,252,.96))', border: '1px solid rgba(80,100,130,.14)', boxShadow: '0 10px 30px rgba(20,35,60,.08), inset 0 1px 0 rgba(255,255,255,.9)' };
const softButton: React.CSSProperties = { border: '1px solid rgba(80,100,130,.12)', borderRadius: 999, background: 'linear-gradient(145deg,#fff,#eef2f7)', boxShadow: '0 3px 10px rgba(20,35,60,.08)', cursor: 'pointer', fontWeight: 600 };

export function PostFeed({ refreshKey, profileId, feedProfileId, scope = 'profile' }: PostFeedProps) {
  const [posts, setPosts] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [openReactionId, setOpenReactionId] = useState<string | null>(null);
  const [reactionCounts, setReactionCounts] = useState<Record<string, Record<string, number>>>({});
  const [myReactions, setMyReactions] = useState<Record<string, ReactionName | null>>({});
  const [comments, setComments] = useState<Record<string, CommentRow[]>>({});
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [openCommentsId, setOpenCommentsId] = useState<string | null>(null);
  const [replyToCommentId, setReplyToCommentId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [openCommentMenuId, setOpenCommentMenuId] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [commentReactionCounts, setCommentReactionCounts] = useState<Record<string, Record<string, number>>>({});
  const [myCommentReactions, setMyCommentReactions] = useState<Record<string, ReactionName | null>>({});
  const [openCommentReactionId, setOpenCommentReactionId] = useState<string | null>(null);
  const [lightboxMedia, setLightboxMedia] = useState<LightboxMedia | null>(null);
  const reactionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const commentReactionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const loadInteractions = async (items: any[]) => {
    if (!items.length) return;
    const ids = items.map((post) => post.id);
    const [{ data: reactionRows, error: reactionError }, { data: commentRows, error: commentError }] = await Promise.all([
      supabase.from('post_reactions').select('post_id, profile_id, reaction').in('post_id', ids),
      supabase.from('post_comments').select('id, post_id, profile_id, parent_comment_id, content, created_at, updated_at, profiles(display_name, avatar_url)').in('post_id', ids).order('created_at', { ascending: true }),
    ]);
    if (reactionError) return setError(reactionError.message);
    if (commentError) return setError(commentError.message);
    const counts: Record<string, Record<string, number>> = {};
    const mine: Record<string, ReactionName | null> = {};
    const grouped: Record<string, CommentRow[]> = {};
    (reactionRows ?? []).forEach((row: any) => {
      counts[row.post_id] ??= {};
      counts[row.post_id][row.reaction] = (counts[row.post_id][row.reaction] ?? 0) + 1;
      if (row.profile_id === profileId) mine[row.post_id] = row.reaction as ReactionName;
    });
    (commentRows ?? []).forEach((row: any) => { const normalized = row as CommentRow; grouped[normalized.post_id] ??= []; grouped[normalized.post_id].push(normalized); });
    setReactionCounts(counts); setMyReactions(mine); setComments(grouped);

    const commentIds = (commentRows ?? []).map((row: any) => row.id);
    if (!commentIds.length) { setCommentReactionCounts({}); setMyCommentReactions({}); return; }
    const { data: commentReactionRows, error: commentReactionError } = await supabase.from('comment_reactions').select('comment_id, profile_id, reaction').in('comment_id', commentIds);
    if (commentReactionError) return setError(commentReactionError.message);
    const commentCounts: Record<string, Record<string, number>> = {};
    const commentMine: Record<string, ReactionName | null> = {};
    (commentReactionRows ?? []).forEach((row: any) => {
      commentCounts[row.comment_id] ??= {};
      commentCounts[row.comment_id][row.reaction] = (commentCounts[row.comment_id][row.reaction] ?? 0) + 1;
      if (row.profile_id === profileId) commentMine[row.comment_id] = row.reaction as ReactionName;
    });
    setCommentReactionCounts(commentCounts); setMyCommentReactions(commentMine);
  };

  const loadPosts = async () => {
    const targetProfileId = scope === 'profile' ? (feedProfileId ?? profileId) : undefined;
    const { data, error: loadError } = await listPosts(targetProfileId, scope);
    if (loadError) setError(loadError.message);
    else { const items = data ?? []; setPosts(items); await loadInteractions(items); }
  };

  useEffect(() => { void loadPosts(); }, [refreshKey, profileId, feedProfileId, scope]);
  useEffect(() => {
    const close = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (!Object.values(reactionRefs.current).some((node) => node?.contains(target))) setOpenReactionId(null);
      if (!Object.values(commentReactionRefs.current).some((node) => node?.contains(target))) setOpenCommentReactionId(null);
    };
    document.addEventListener('mousedown', close); document.addEventListener('touchstart', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('touchstart', close); };
  }, []);
  useEffect(() => {
    if (!lightboxMedia) return;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setLightboxMedia(null); };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', onKeyDown); };
  }, [lightboxMedia]);

  const startEdit = (post: any) => { setEditingId(post.id); setEditContent(post.content ?? ''); setOpenMenuId(null); };
  const saveEdit = async (postId: string) => { const { error: e } = await updatePost(postId, editContent); if (e) return setError(e.message); setEditingId(null); setEditContent(''); await loadPosts(); };
  const removePost = async (postId: string) => { if (!window.confirm('Delete this post?')) return; const { error: e } = await deletePost(postId); if (e) return setError(e.message); setOpenMenuId(null); await loadPosts(); };
  const changePrivacy = async (postId: string, privacy: PostPrivacy) => { const { error: e } = await updatePostPrivacy(postId, privacy); if (e) return setError(e.message); setOpenMenuId(null); await loadPosts(); };
  const react = async (postId: string, reaction: ReactionName) => {
    const current = myReactions[postId];
    const result = current === reaction
      ? await supabase.from('post_reactions').delete().eq('post_id', postId).eq('profile_id', profileId)
      : await supabase.from('post_reactions').upsert({ post_id: postId, profile_id: profileId, reaction }, { onConflict: 'post_id,profile_id' });
    if (result.error) return setError(result.error.message); setOpenReactionId(null); await loadPosts();
  };

  const addComment = async (postId: string, parentCommentId: string | null = null) => {
    const content = (parentCommentId ? replyText : commentText[postId] ?? '').trim();
    if (!content) return;
    const { data, error: e } = await supabase.from('post_comments').insert({ post_id: postId, profile_id: profileId, parent_comment_id: parentCommentId, content }).select('id, post_id, profile_id, parent_comment_id, content, created_at, updated_at, profiles(display_name, avatar_url)').single();
    if (e) return setError(e.message);
    if (parentCommentId) { setReplyText(''); setReplyToCommentId(null); } else setCommentText((current) => ({ ...current, [postId]: '' }));
    if (data) setComments((current) => ({ ...current, [postId]: [...(current[postId] ?? []), data as CommentRow] }));
  };

  const saveCommentEdit = async (commentId: string) => {
    const content = editingCommentText.trim(); if (!content) return;
    const { data, error: e } = await supabase.from('post_comments').update({ content }).eq('id', commentId).select('id, post_id, profile_id, parent_comment_id, content, created_at, updated_at, profiles(display_name, avatar_url)').single();
    if (e) return setError(e.message);
    if (data) setComments((current) => Object.fromEntries(Object.entries(current).map(([postId, rows]) => [postId, rows.map((row) => row.id === commentId ? data as CommentRow : row)])));
    setEditingCommentId(null); setEditingCommentText(''); setOpenCommentMenuId(null);
  };

  const deleteComment = async (commentId: string) => {
    if (!window.confirm('Delete this comment?')) return;
    const { error: e } = await supabase.from('post_comments').delete().eq('id', commentId);
    if (e) return setError(e.message);
    setComments((current) => Object.fromEntries(Object.entries(current).map(([postId, rows]) => [postId, rows.filter((row) => row.id !== commentId && row.parent_comment_id !== commentId)])));
    setOpenCommentMenuId(null);
  };

  const reactToComment = async (commentId: string, reaction: ReactionName) => {
    const current = myCommentReactions[commentId];
    const result = current === reaction
      ? await supabase.from('comment_reactions').delete().eq('comment_id', commentId).eq('profile_id', profileId)
      : await supabase.from('comment_reactions').upsert({ comment_id: commentId, profile_id: profileId, reaction }, { onConflict: 'comment_id,profile_id' });
    if (result.error) return setError(result.error.message);
    setOpenCommentReactionId(null);
    await loadPosts();
  };

  const openMedia = (type: 'image' | 'video', url: string, alt?: string) => {
    if (!url) return;
    setOpenMenuId(null);
    setLightboxMedia({ type, url, alt });
  };

  const renderComment = (comment: CommentRow, allComments: CommentRow[], depth = 0): JSX.Element => {
    const children = allComments.filter((row) => row.parent_comment_id === comment.id);
    const profile = commentProfile(comment);
    const isOwner = comment.profile_id === profileId;
    const isEditing = editingCommentId === comment.id;
    const counts = commentReactionCounts[comment.id] ?? {};
    const myReaction = myCommentReactions[comment.id];
    const totalReactions = Object.values(counts).reduce((sum, value) => sum + value, 0);
    return <div key={comment.id} style={{ marginTop: 12, marginLeft: Math.min(depth, 4) * 20, paddingLeft: depth ? 12 : 0, borderLeft: depth ? '2px solid rgba(91,108,132,.12)' : undefined }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        {profile?.avatar_url ? <img src={profile.avatar_url} alt="" width={32} height={32} style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0, boxShadow: '0 3px 10px rgba(20,35,60,.14)' }} /> : <div aria-hidden="true" style={{ width: 32, height: 32, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'linear-gradient(145deg,#f8fafc,#e7ecf2)', flexShrink: 0 }}>👤</div>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}><strong style={{ fontSize: 13 }}>{profile?.display_name ?? 'User'}</strong><small style={{ opacity: .55, whiteSpace: 'nowrap' }}>{new Date(comment.created_at).toLocaleString()}</small><div style={{ marginLeft: 'auto', position: 'relative' }}>
            <button type="button" aria-label="Comment options" onClick={() => setOpenCommentMenuId(openCommentMenuId === comment.id ? null : comment.id)} style={{ ...softButton, width: 30, height: 30, padding: 0, fontSize: 17 }}>⋯</button>
            {openCommentMenuId === comment.id && isOwner && <div role="menu" style={{ position: 'absolute', right: 0, top: 34, zIndex: 6, padding: 8, display: 'grid', gap: 4, background: '#fff', border: '1px solid rgba(80,100,130,.14)', borderRadius: 12, boxShadow: '0 12px 28px rgba(20,35,60,.16)' }}><button type="button" onClick={() => { setEditingCommentId(comment.id); setEditingCommentText(comment.content); setOpenCommentMenuId(null); }} style={{ ...softButton, border: 0, boxShadow: 'none', borderRadius: 8, padding: '7px 12px' }}>Edit</button><button type="button" onClick={() => void deleteComment(comment.id)} style={{ ...softButton, border: 0, boxShadow: 'none', borderRadius: 8, padding: '7px 12px' }}>Delete</button></div>}
          </div></div>
          {isEditing ? <div style={{ display: 'flex', gap: 8, marginTop: 6 }}><input value={editingCommentText} onChange={(event) => setEditingCommentText(event.target.value)} autoFocus style={{ flex: 1, minWidth: 0, border: '1px solid rgba(80,100,130,.18)', borderRadius: 12, padding: '8px 10px', outline: 'none', boxSizing: 'border-box' }} /><button type="button" onClick={() => void saveCommentEdit(comment.id)} style={{ ...softButton, padding: '7px 12px' }}>Save</button><button type="button" onClick={() => { setEditingCommentId(null); setEditingCommentText(''); }} style={{ ...softButton, padding: '7px 12px' }}>Cancel</button></div> : <div style={{ marginTop: 3, overflowWrap: 'anywhere', lineHeight: 1.45 }}>{comment.content}</div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 6 }}>
            <div ref={(node) => { commentReactionRefs.current[comment.id] = node; }} style={{ position: 'relative' }}>
              <button type="button" aria-haspopup="true" aria-expanded={openCommentReactionId === comment.id} onClick={() => setOpenCommentReactionId(openCommentReactionId === comment.id ? null : comment.id)} style={{ ...softButton, padding: '5px 10px', fontSize: 12 }}>{myReaction ? `${reactionEmoji[myReaction]} ${counts[myReaction] ?? 0}` : `❤️${totalReactions ? ` ${totalReactions}` : ''}`}</button>
              {openCommentReactionId === comment.id && <div role="group" aria-label="Comment reactions" style={{ position: 'absolute', left: 0, bottom: 'calc(100% + 7px)', zIndex: 7, display: 'flex', gap: 5, padding: 7, background: '#fff', border: '1px solid rgba(80,100,130,.14)', borderRadius: 14, boxShadow: '0 12px 28px rgba(20,35,60,.16)' }}>{reactionOptions.map((item) => <button key={item.value} type="button" aria-label={item.label} title={item.label} onClick={() => void reactToComment(comment.id, item.value)} style={{ border: 0, background: 'transparent', borderRadius: 9, padding: 3, fontSize: 19, cursor: 'pointer' }}>{item.emoji}</button>)}</div>}
            </div>
            <button type="button" onClick={() => { setReplyToCommentId(comment.id); setReplyText(''); }} style={{ ...softButton, padding: '5px 10px', fontSize: 12 }}>Reply</button>
          </div>
          {replyToCommentId === comment.id && <div style={{ display: 'flex', gap: 8, marginTop: 7, minWidth: 0 }}><input value={replyText} onChange={(event) => setReplyText(event.target.value)} placeholder="Write a reply..." style={{ flex: 1, minWidth: 0, border: '1px solid rgba(80,100,130,.18)', borderRadius: 12, padding: '8px 10px', boxSizing: 'border-box' }} /><button type="button" onClick={() => void addComment(comment.post_id, comment.id)} style={{ ...softButton, padding: '7px 12px' }}>Reply</button><button type="button" onClick={() => setReplyToCommentId(null)} style={{ ...softButton, padding: '7px 12px' }}>Cancel</button></div>}
          {children.map((child) => renderComment(child, allComments, depth + 1))}
        </div>
      </div>
    </div>;
  };

  return <section style={{ minWidth: 0 }}><div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 2px 12px', padding: '8px 12px', borderRadius: 14, background: 'linear-gradient(145deg,rgba(255,255,255,.9),rgba(240,244,249,.72))', border: '1px solid rgba(80,100,130,.10)', boxShadow: '0 5px 18px rgba(20,35,60,.05)' }}><span style={{ width: 8, height: 28, borderRadius: 99, background: 'linear-gradient(180deg,#6d7cff,#b56cff)', boxShadow: '0 0 12px rgba(109,124,255,.35)' }} /><h2 style={{ margin: 0, fontSize: 17, letterSpacing: '.01em' }}>Posts</h2><span style={{ marginLeft: 'auto', fontSize: 11, opacity: .55, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>Community feed</span></div>{error && <p role="alert">{error}</p>}
    {posts.map((post) => {
      const isOwner = post.profile_id === profileId; const privacy = (post.privacy ?? 'public') as PostPrivacy; const counts = reactionCounts[post.id] ?? {}; const myReaction = myReactions[post.id]; const totalReactions = Object.values(counts).reduce((sum, value) => sum + value, 0); const postComments = comments[post.id] ?? []; const latestComment = postComments[postComments.length - 1]; const attachments = post.attachments ?? [];
      const rootComments = postComments.filter((comment) => !comment.parent_comment_id);
      const latestProfile = latestComment ? commentProfile(latestComment) : null;
      return <article key={post.id} style={{ ...glassCard, position: 'relative', marginBottom: 14, padding: 14, borderRadius: 18, minWidth: 0, maxWidth: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, padding: '2px 2px 10px', borderBottom: '1px solid rgba(80,100,130,.08)' }}><div style={{ flexShrink: 0, padding: 2, borderRadius: '50%', background: 'linear-gradient(145deg,#ffffff,#dfe5ec)', boxShadow: '0 4px 12px rgba(20,35,60,.12)' }}>{post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} alt="" width={42} height={42} style={{ display: 'block', borderRadius: '50%', objectFit: 'cover' }} /> : <div aria-hidden="true" style={{ width: 42, height: 42, borderRadius: '50%', display: 'grid', placeItems: 'center', background: '#eef2f6' }}>👤</div>}</div><div style={{ minWidth: 0, flex: 1 }}><strong style={{ display: 'block', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 14 }}>{post.profiles?.display_name ?? 'User'}</strong><small style={{ display: 'block', marginTop: 2, opacity: .55, fontSize: 11 }}>{new Date(post.created_at).toLocaleString()}</small></div><span style={{ fontSize: 10, opacity: .55, fontWeight: 700, padding: '5px 8px', borderRadius: 999, background: 'rgba(255,255,255,.72)', border: '1px solid rgba(80,100,130,.08)', whiteSpace: 'nowrap' }}>{privacyLabels[privacy]}</span><button type="button" aria-label="Post options" onClick={() => setOpenMenuId(openMenuId === post.id ? null : post.id)} style={{ ...softButton, width: 34, height: 34, padding: 0, fontSize: 18 }}>⋯</button></header>
        {openMenuId === post.id && <div role="menu" style={{ position: 'absolute', right: 14, top: 66, zIndex: 2, padding: 10, display: 'grid', gap: 5, background: 'rgba(255,255,255,.98)', border: '1px solid rgba(80,100,130,.14)', borderRadius: 14, boxShadow: '0 16px 34px rgba(20,35,60,.18)', backdropFilter: 'blur(12px)' }}><strong style={{ fontSize: 11, opacity: .65, padding: '2px 6px' }}>Privacy</strong>{(['public', 'friends', 'private'] as PostPrivacy[]).map((value) => <button key={value} type="button" onClick={() => void changePrivacy(post.id, value)} style={{ ...softButton, borderRadius: 9, padding: '7px 10px', textAlign: 'left' }}>{privacyLabels[value]}{privacy === value ? ' ✓' : ''}</button>)}{isOwner && <><button type="button" onClick={() => startEdit(post)} style={{ ...softButton, borderRadius: 9, padding: '7px 10px', textAlign: 'left' }}>Edit</button><button type="button" onClick={() => void removePost(post.id)} style={{ ...softButton, borderRadius: 9, padding: '7px 10px', textAlign: 'left' }}>Delete</button></>}</div>}
        {editingId === post.id ? <div style={{ marginTop: 10 }}><textarea value={editContent} onChange={(event) => setEditContent(event.target.value)} rows={4} style={{ width: '100%', boxSizing: 'border-box', border: '1px solid rgba(80,100,130,.18)', borderRadius: 14, padding: 10, resize: 'vertical' }} /><div style={{ display: 'flex', gap: 8, marginTop: 7 }}><button type="button" onClick={() => void saveEdit(post.id)} style={{ ...softButton, padding: '7px 13px' }}>Save</button><button type="button" onClick={() => setEditingId(null)} style={{ ...softButton, padding: '7px 13px' }}>Cancel</button></div></div> : post.content && <p style={{ margin: '12px 2px 0', overflowWrap: 'anywhere', lineHeight: 1.55, fontSize: 14 }}>{post.content}</p>}
        {attachments.length > 0 && <div style={{ display: 'grid', gap: 8, marginTop: 11, minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>{attachments.map((attachment: any) => attachment.kind === 'image' ? <button key={attachment.id} type="button" onClick={() => openMedia('image', attachment.public_url, attachment.file_name ?? 'Post image')} aria-label={`Open ${attachment.file_name ?? 'post image'}`} style={{ display: 'block', width: '100%', maxWidth: '100%', padding: 0, margin: 0, border: 0, background: 'transparent', cursor: 'zoom-in', overflow: 'hidden', borderRadius: 13 }}><img src={attachment.public_url} alt={attachment.file_name ?? 'Post image'} style={{ display: 'block', width: '100%', maxWidth: '100%', maxHeight: 520, objectFit: 'contain', borderRadius: 13, boxShadow: '0 6px 18px rgba(20,35,60,.08)' }} /></button> : attachment.kind === 'video' ? <button key={attachment.id} type="button" onClick={() => openMedia('video', attachment.public_url, attachment.file_name ?? 'Post video')} aria-label={`Open ${attachment.file_name ?? 'post video'}`} style={{ display: 'block', width: '100%', maxWidth: '100%', padding: 0, margin: 0, border: 0, background: 'transparent', cursor: 'zoom-in', overflow: 'hidden', borderRadius: 13 }}><video src={attachment.public_url} controls preload="metadata" onClick={(event) => event.stopPropagation()} style={{ display: 'block', width: '100%', maxWidth: '100%', maxHeight: 520, borderRadius: 13 }} /> </button> : <a key={attachment.id} href={attachment.public_url} target="_blank" rel="noreferrer">📎 {attachment.file_name ?? 'Attached file'}</a>)}</div>}
        {(post.location_name || post.latitude !== null) && <div style={{ marginTop: 9, display: 'inline-flex', padding: '6px 9px', borderRadius: 999, background: 'rgba(240,244,249,.8)', border: '1px solid rgba(80,100,130,.08)', fontSize: 11 }}>📍 {post.location_name ?? `${Number(post.latitude).toFixed(5)}, ${Number(post.longitude).toFixed(5)}`}</div>}
        <footer style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(80,100,130,.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, minWidth: 0 }}><div ref={(node) => { reactionRefs.current[post.id] = node; }} style={{ position: 'relative', minWidth: 0 }}><button type="button" aria-haspopup="true" aria-expanded={openReactionId === post.id} onClick={() => setOpenReactionId(openReactionId === post.id ? null : post.id)} style={{ ...softButton, padding: '7px 12px', fontSize: 12 }}>{myReaction ? `${reactionEmoji[myReaction]} ${counts[myReaction] ?? 0}` : `❤️ Like${totalReactions ? ` (${totalReactions})` : ''}`}</button>{openReactionId === post.id && <div role="group" aria-label="Reactions" style={{ position: 'absolute', left: 0, bottom: 'calc(100% + 7px)', zIndex: 5, display: 'flex', gap: 5, padding: 8, background: '#fff', border: '1px solid rgba(80,100,130,.14)', borderRadius: 14, boxShadow: '0 12px 28px rgba(20,35,60,.16)' }}>{reactionOptions.map((item) => <button key={item.value} type="button" aria-label={item.label} title={item.label} onClick={() => void react(post.id, item.value)} style={{ border: 0, background: 'transparent', borderRadius: 9, padding: 3, fontSize: 21, cursor: 'pointer' }}>{item.emoji}</button>)}</div>}</div><button type="button" onClick={async () => { const url = `${window.location.origin}/?post=${encodeURIComponent(post.id)}`; if (navigator.share) await navigator.share({ title: 'Work Social post', text: post.content ?? '', url }); else await navigator.clipboard.writeText(url); }} style={{ ...softButton, padding: '7px 12px', fontSize: 12 }}>↗️ Share</button></div>
          {!openCommentsId && latestComment && <div style={{ marginTop: 10, padding: 9, borderRadius: 13, background: 'linear-gradient(145deg,rgba(246,248,251,.92),rgba(255,255,255,.86))', border: '1px solid rgba(80,100,130,.08)', minWidth: 0 }}><div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>{latestProfile?.avatar_url ? <img src={latestProfile.avatar_url} alt="" width={28} height={28} style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} /> : <div aria-hidden="true" style={{ width: 28, height: 28, borderRadius: '50%', display: 'grid', placeItems: 'center', background: '#e9edf2', flexShrink: 0 }}>👤</div>}<strong style={{ fontSize: 12 }}>{latestProfile?.display_name ?? 'User'}</strong><span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, opacity: .72 }}>{latestComment.content}</span></div><button type="button" onClick={() => setOpenCommentsId(post.id)} style={{ ...softButton, display: 'block', marginTop: 7, padding: '5px 10px', fontSize: 11 }}>View all {postComments.length} comment{postComments.length === 1 ? '' : 's'} →</button></div>}
          {openCommentsId === post.id && <div style={{ marginTop: 10, padding: 11, borderRadius: 15, background: 'linear-gradient(145deg,rgba(247,249,252,.95),rgba(255,255,255,.92))', border: '1px solid rgba(80,100,130,.10)', minWidth: 0, overflow: 'hidden' }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingBottom: 8, borderBottom: '1px solid rgba(80,100,130,.08)' }}><strong style={{ fontSize: 13 }}>Comments <span style={{ opacity: .5 }}>({postComments.length})</span></strong><button type="button" onClick={() => setOpenCommentsId(null)} style={{ ...softButton, padding: '5px 10px', fontSize: 11 }}>Close</button></div>{rootComments.map((comment) => renderComment(comment, postComments))}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10, minWidth: 0, padding: 5, borderRadius: 15, background: 'linear-gradient(145deg,#f5f7fa,#ffffff)', border: '1px solid rgba(80,100,130,.10)', boxShadow: 'inset 0 1px 3px rgba(20,35,60,.04)' }}><input value={commentText[post.id] ?? ''} onChange={(event) => setCommentText((current) => ({ ...current, [post.id]: event.target.value }))} placeholder="Write a comment..." style={{ minWidth: 0, flex: 1, border: 0, outline: 'none', background: 'transparent', padding: '7px 8px', fontSize: 13 }} /><button type="button" onClick={() => void addComment(post.id)} style={{ ...softButton, padding: '7px 12px', fontSize: 12 }}>Comment</button></div>
        </footer>
      </article>;
    })}
    {!error && posts.length === 0 && <p>No posts yet.</p>}
    {lightboxMedia && <div role="dialog" aria-modal="true" aria-label="Media viewer" onClick={() => setLightboxMedia(null)} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, boxSizing: 'border-box' }}>
      <button type="button" aria-label="Close media viewer" onClick={() => setLightboxMedia(null)} style={{ position: 'absolute', top: 16, right: 16, zIndex: 1002, width: 44, height: 44, border: 0, borderRadius: '50%', background: 'rgba(0,0,0,.6)', color: '#fff', fontSize: 28, lineHeight: 1, cursor: 'pointer' }}>×</button>
      <div onClick={(event) => event.stopPropagation()} style={{ position: 'relative', width: '100%', height: '100%', maxWidth: 1400, display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 0, minHeight: 0 }}>
        {lightboxMedia.type === 'image' ? <img src={lightboxMedia.url} alt={lightboxMedia.alt ?? 'Full screen view'} style={{ display: 'block', maxWidth: '95vw', maxHeight: '90vh', width: 'auto', height: 'auto', objectFit: 'contain', borderRadius: 10 }} /> : <video src={lightboxMedia.url} controls autoPlay playsInline preload="metadata" style={{ display: 'block', maxWidth: '95vw', maxHeight: '90vh', width: 'auto', height: 'auto', borderRadius: 10 }} />}
      </div>
    </div>}
  </section>;
}
