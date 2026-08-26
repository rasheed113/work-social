import { useEffect, useState } from 'react';
import { listPosts } from '../api/listPosts';

interface PostFeedProps { refreshKey: number; }

export function PostFeed({ refreshKey }: PostFeedProps) {
  const [posts, setPosts] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listPosts().then(({ data, error: loadError }) => {
      if (!active) return;
      if (loadError) setError(loadError.message);
      else setPosts(data ?? []);
    });
    return () => { active = false; };
  }, [refreshKey]);

  return <section>
    <h2>Feed</h2>
    {error && <p role="alert">{error}</p>}
    {posts.map((post) => <article key={post.id}><strong>{post.profiles?.display_name ?? post.profiles?.username ?? 'User'}</strong><p>{post.content}</p><small>{new Date(post.created_at).toLocaleString()}</small></article>)}
    {!error && posts.length === 0 && <p>No posts yet.</p>}
  </section>;
}
