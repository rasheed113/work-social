import { useEffect, useState } from 'react';
import { CreatePostForm } from '../../features/posts/components/CreatePostForm';
import { PostFeed } from '../../features/posts/components/PostFeed';
import { supabase } from '../../lib/supabase/client';

interface HomePageProps { profileId: string; }

type NotificationTarget = { postId: string | null; commentId: string | null };

function readNotificationTarget(): NotificationTarget {
  const params = new URLSearchParams(window.location.search);
  let postId = params.get('post');
  let commentId = params.get('comment');
  if ((!postId || !commentId) && window.sessionStorage) {
    try {
      const stored = JSON.parse(window.sessionStorage.getItem('work-social:notification-target') ?? 'null') as { postId?: string | null; commentId?: string | null } | null;
      postId ??= stored?.postId ?? null;
      commentId ??= stored?.commentId ?? null;
    } catch {
      // Ignore malformed stale target state.
    }
  }
  return { postId, commentId };
}

async function focusNotificationTarget(target: NotificationTarget) {
  if (!target.postId) return;

  const { data: post } = await supabase.from('posts').select('id, content').eq('id', target.postId).maybeSingle();
  const { data: comment } = target.commentId
    ? await supabase.from('post_comments').select('id, content, created_at, profile_id').eq('id', target.commentId).maybeSingle()
    : { data: null };
  const profileId = comment?.profile_id;
  const { data: commentProfile } = profileId
    ? await supabase.from('profiles').select('display_name, username').eq('id', profileId).maybeSingle()
    : { data: null };

  const findAndFocus = () => {
    const postText = (post?.content ?? '').trim();
    const candidates = Array.from(document.querySelectorAll('article'));
    const article = candidates.find((node) => {
      if (!postText) return false;
      const text = node.textContent ?? '';
      return text.includes(postText);
    });
    if (!article) return false;

    article.scrollIntoView({ behavior: 'smooth', block: 'start' });
    article.setAttribute('data-notification-target', 'post');

    if (!target.commentId || !comment?.content) return true;

    const buttons = Array.from(article.querySelectorAll('button'));
    const commentsButton = buttons.find((button) => /comments/i.test(button.textContent ?? ''));
    if (commentsButton && !/close comments/i.test(commentsButton.textContent ?? '')) commentsButton.click();

    const commentText = comment.content.trim();
    const authorText = (commentProfile?.display_name ?? commentProfile?.username ?? '').trim();
    const timeText = comment.created_at ? new Date(comment.created_at).toLocaleString() : '';
    const commentNodes = Array.from(article.querySelectorAll('div')).filter((node) => {
      const text = (node.textContent ?? '').trim();
      if (!text.includes(commentText)) return false;
      if (authorText && !text.includes(authorText)) return false;
      return !timeText || text.includes(timeText);
    });
    const targetNode = commentNodes.sort((a, b) => a.textContent!.length - b.textContent!.length)[0];
    if (targetNode) {
      targetNode.setAttribute('data-notification-target', 'comment');
      targetNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return true;
  };

  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (findAndFocus()) {
      window.history.replaceState({}, '', `/?post=${encodeURIComponent(target.postId)}${target.commentId ? `&comment=${encodeURIComponent(target.commentId)}` : ''}`);
      window.sessionStorage.removeItem('work-social:notification-target');
      return;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 150));
  }
}

export function HomePage({ profileId }: HomePageProps) {
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const target = readNotificationTarget();
    if (!target.postId) return;
    void focusNotificationTarget(target);
  }, []);

  return (
    <main style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', padding: '18px 0 112px', overflowX: 'hidden' }}>
      <div style={{ width: '100%', maxWidth: 900, minWidth: 0, margin: '0 auto', padding: '0 14px', boxSizing: 'border-box' }}>
        <header style={{ marginBottom: 16, padding: '4px 4px 2px' }}>
          <h1 style={{ margin: 0, fontSize: 'clamp(28px, 5vw, 40px)', lineHeight: 1.05, fontWeight: 900, letterSpacing: '-.035em', color: '#17202a', textShadow: '0 2px 0 rgba(255,255,255,.9), 0 7px 18px rgba(23,32,42,.12)' }}>Home</h1>
          <div style={{ width: 54, height: 5, marginTop: 9, borderRadius: 999, background: 'linear-gradient(90deg, #6d5dfc, #22c1dc, #ff5ca8)', boxShadow: '0 5px 14px rgba(109,93,252,.28)' }} />
        </header>
        <CreatePostForm profileId={profileId} onCreated={() => setRefreshKey((key) => key + 1)} />
        <div style={{ marginTop: 18 }}>
          <PostFeed refreshKey={refreshKey} profileId={profileId} scope="public" />
        </div>
      </div>
    </main>
  );
}
