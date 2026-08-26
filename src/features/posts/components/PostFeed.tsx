import { useEffect, useState } from 'react';
import { listPosts } from '../api/listPosts';
import { deletePost } from '../api/deletePost';
import { updatePost } from '../api/updatePost';
import { updatePostPrivacy, type PostPrivacy } from '../api/updatePostPrivacy';

interface PostFeedProps { refreshKey: number; profileId: string; }

const privacyLabels: Record<PostPrivacy, string> = {
  public: '🌎 Public',
  friends: '👥 Friends',
  private: '🔒 Only me',
};

export function PostFeed({ refreshKey, profileId }: PostFeedProps) {
  const [posts, setPosts] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const loadPosts = async () => {
    const { data, error: loadError } = await listPosts();
    if (loadError) setError(loadError.message);
    else setPosts(data ?? []);
  };

  useEffect(() => {
    let active = true;
    listPosts().then(({ data, error: loadError }) => {
      if (!active) return;
      if (loadError) setError(loadError.message);
      else setPosts(data ?? []);
    });
    return () => { active = false; };
  }, [refreshKey]);

  const startEdit = (post: any) => {
    setEditingId(post.id);
    setEditContent(post.content);
    setOpenMenuId(null);
  };

  const saveEdit = async (postId: string) => {
    const { error: updateError } = await updatePost(postId, editContent);
    if (updateError) return setError(updateError.message);
    setEditingId(null);
    setEditContent('');
    await loadPosts();
  };

  const removePost = async (postId: string) => {
    if (!window.confirm('Delete this post?')) return;
    const { error: deleteError } = await deletePost(postId);
    if (deleteError) return setError(deleteError.message);
    setOpenMenuId(null);
    await loadPosts();
  };

  const changePrivacy = async (postId: string, privacy: PostPrivacy) => {
    const { error: privacyError } = await updatePostPrivacy(postId, privacy);
    if (privacyError) return setError(privacyError.message);
    setOpenMenuId(null);
    await loadPosts();
  };

  return <section>
    <h2>Feed</h2>
    {error && <p role="alert">{error}</p>}
    {posts.map((post) => {
      const isOwner = post.profile_id === profileId;
      const privacy = (post.privacy ?? 'public') as PostPrivacy;
      return <article key={post.id} style={{ position: 'relative', marginBottom: 16, padding: 16, border: '1px solid rgba(0,0,0,.12)', borderRadius: 12 }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} alt="" width={44} height={44} style={{ borderRadius: '50%', objectFit: 'cover' }} /> : <div aria-hidden="true" style={{ width: 44, height: 44, borderRadius: '50%', display: 'grid', placeItems: 'center', background: '#eee' }}>👤</div>}
          <strong>{post.profiles?.display_name ?? post.profiles?.username ?? 'User'}</strong>
          <span style={{ marginLeft: 'auto' }}>{new Date(post.created_at).toLocaleString()}</span>
          <button type="button" aria-label="Post options" onClick={() => setOpenMenuId(openMenuId === post.id ? null : post.id)}>⋯</button>
        </header>

        {openMenuId === post.id && <div role="menu" style={{ position: 'absolute', right: 16, top: 64, zIndex: 2, padding: 10, background: 'white', border: '1px solid rgba(0,0,0,.15)', borderRadius: 10 }}>
          <strong>Privacy</strong>
          {(['public', 'friends', 'private'] as PostPrivacy[]).map((value) => <button key={value} type="button" onClick={() => changePrivacy(post.id, value)}>{privacyLabels[value]}{privacy === value ? ' ✓' : ''}</button>)}
        </div>}

        {editingId === post.id ? <div>
          <textarea value={editContent} onChange={(event) => setEditContent(event.target.value)} rows={4} />
          <div><button type="button" onClick={() => void saveEdit(post.id)}>Save</button><button type="button" onClick={() => setEditingId(null)}>Cancel</button></div>
        </div> : <p>{post.content}</p>}

        <small>{privacyLabels[privacy]} · {new Date(post.created_at).toLocaleString()}</small>

        {isOwner && <footer style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
          <button type="button" onClick={() => startEdit(post)}>Edit</button>
          <button type="button" onClick={() => void removePost(post.id)}>Delete</button>
        </footer>}
      </article>;
    })}
    {!error && posts.length === 0 && <p>No posts yet.</p>}
  </section>;
}
