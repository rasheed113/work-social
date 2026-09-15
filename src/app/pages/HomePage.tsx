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
    <main className="social-command-screen social-command-screen--home" style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', padding: '18px 0 112px', overflowX: 'hidden', background: 'transparent', color: '#cfe9fb' }}>
      <style>{`
        .home-page-title {
          margin: 0;
          font-size: clamp(28px, 5vw, 40px);
          line-height: 1.05;
          font-weight: 900;
          letter-spacing: -.035em;
          color: #e8f7ff;
          background: none;
          -webkit-text-fill-color: currentColor;
          text-shadow: 0 0 28px rgba(94,231,255,.09);
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
          border: 1px solid rgba(103,208,255,.22);
          border-radius: 15px;
          background: rgba(5,21,43,.72);
          color: #e8f7ff;
          font-size: 17px;
          line-height: 1;
          font-weight: 900;
          letter-spacing: .04em;
          text-transform: uppercase;
          text-shadow: none;
          box-shadow: inset 0 1px 0 rgba(190,239,255,.04);
          overflow: hidden;
        }
        .home-post-feed > section > h2::before {
          content: '';
          width: 7px;
          height: 27px;
          flex: 0 0 7px;
          border-radius: 999px;
          background: linear-gradient(180deg, #5ee7ff, #60a5fa, #8b8cff);
          box-shadow: 0 0 12px rgba(94,231,255,.22);
        }
        .home-post-feed > section > h2::after {
          content: '';
          position: absolute;
          width: 120px;
          height: 120px;
          right: -55px;
          top: -48px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(94,231,255,.08), rgba(34,193,220,0));
          pointer-events: none;
        }
        @media (max-width: 767px) {
          .home-post-feed > section > h2 { margin-bottom: 10px; padding: 9px 11px; font-size: 16px; }
        }
      `}</style>
      <div className="social-command-screen__frame" style={{ width: '100%', maxWidth: 900, minWidth: 0, margin: '0 auto', padding: '0 14px', boxSizing: 'border-box' }}>
        <header className="social-command-screen__header">
          <div className="social-command-screen__eyebrow">SOCIAL NETWORK // COMMAND INTERFACE</div>
          <div className="social-command-screen__identity">
            <div>
              <h1 className="home-page-title">Home</h1>
              <p className="social-command-screen__descriptor">Network operations and live social transmissions</p>
            </div>
          </div>
        </header>
        <section className="social-command-screen__channel" aria-label="Social transmission console">
          <div className="social-command-screen__channel-label">TRANSMISSION CONSOLE</div>
          <CreatePostForm profileId={profileId} onCreated={() => setRefreshKey((key) => key + 1)} />
        </section>
        <section className="social-command-screen__data-channel" aria-label="Public social signal feed">
          <div className="social-command-screen__channel-label">PUBLIC SIGNAL FEED</div>
          <div className="home-post-feed" style={{ marginTop: 8 }}>
            <PostFeed refreshKey={refreshKey} profileId={profileId} scope="public" />
          </div>
        </section>
      </div>
    </main>
  );
}