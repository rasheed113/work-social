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
      <style>{`
        .home-page-title {
          margin: 0;
          font-size: clamp(28px, 5vw, 40px);
          line-height: 1.05;
          font-weight: 900;
          letter-spacing: -.035em;
          color: transparent;
          background: linear-gradient(135deg, #6d5dfc 0%, #22c1dc 48%, #ff5ca8 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          text-shadow: 0 3px 0 rgba(255,255,255,.8), 0 7px 18px rgba(79,70,229,.16);
        }
        .home-post-feed > section > h2 {
          position: relative;
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 0 0 12px;
          padding: 10px 13px;
          min-height: 42px;
          box-sizing: border-box;
          border: 1px solid rgba(99,102,241,.14);
          border-radius: 15px;
          background: linear-gradient(145deg, rgba(255,255,255,.98), rgba(241,245,255,.94));
          color: #17202a;
          font-size: 17px;
          line-height: 1;
          font-weight: 900;
          letter-spacing: -.02em;
          text-shadow: 0 1px 0 rgba(255,255,255,.95), 0 3px 9px rgba(23,32,42,.08);
          box-shadow: 0 7px 18px rgba(15,23,42,.07), inset 0 1px 0 rgba(255,255,255,.95);
          overflow: hidden;
        }
        .home-post-feed > section > h2::before {
          content: '';
          width: 7px;
          height: 27px;
          flex: 0 0 7px;
          border-radius: 999px;
          background: linear-gradient(180deg, #22c1dc, #6d5dfc, #ff5ca8);
          box-shadow: 0 4px 10px rgba(109,93,252,.24);
        }
        .home-post-feed > section > h2::after {
          content: '';
          position: absolute;
          width: 120px;
          height: 120px;
          right: -55px;
          top: -48px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(109,93,252,.13), rgba(34,193,220,0));
          pointer-events: none;
        }
        @media (max-width: 767px) {
          .home-post-feed > section > h2 { margin-bottom: 10px; padding: 9px 11px; font-size: 16px; }
        }
      `}</style>
      <div style={{ width: '100%', maxWidth: 900, minWidth: 0, margin: '0 auto', padding: '0 14px', boxSizing: 'border-box' }}>
        <header style={{ marginBottom: 16, padding: '4px 4px 2px' }}>
          <h1 className="home-page-title">Home</h1>
        </header>
        <CreatePostForm profileId={profileId} onCreated={() => setRefreshKey((key) => key + 1)} />
        <div className="home-post-feed" style={{ marginTop: 18 }}>
          <PostFeed refreshKey={refreshKey} profileId={profileId} scope="public" />
        </div>
      </div>
    </main>
  );
}
