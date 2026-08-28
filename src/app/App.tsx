import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase/client';
import { getSession } from '../features/auth/api/getSession';
import { LoginForm } from '../features/auth/components/LoginForm';
import { SignupForm } from '../features/auth/components/SignupForm';
import { Router } from './Router';

const AUTH_INIT_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]);
}

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [showSignup, setShowSignup] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function initializeAuth() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      const oauthError = url.searchParams.get('error_description') || url.searchParams.get('error');

      if (oauthError) {
        url.search = '';
        window.history.replaceState({}, '', `${url.pathname}${url.hash}`);
        if (active) setAuthError(oauthError);
      }

      try {
        if (code) {
          const { error } = await withTimeout(
            supabase.auth.exchangeCodeForSession(code),
            AUTH_INIT_TIMEOUT_MS,
            'Authentication is taking too long. You can continue and retry without blocking the app.',
          );
          url.searchParams.delete('code');
          url.searchParams.delete('state');
          window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
          if (error && active) setAuthError(error.message);
        }

        const { data, error } = await withTimeout(
          getSession(),
          AUTH_INIT_TIMEOUT_MS,
          'Authentication initialization timed out. The app will continue and retry in the background.',
        );

        if (!active) return;
        if (error) setAuthError(error.message);
        setSession(data.session);
      } catch (error) {
        if (active) {
          setAuthError(error instanceof Error ? error.message : 'Authentication initialization failed.');
        }
      } finally {
        if (active) setInitializing(false);
      }
    }

    void initializeAuth();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) {
        setSession(nextSession);
        setAuthError(null);
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (initializing) return <main className="app-shell"><div className="auth-card"><p>Signing you in…</p></div></main>;
  if (!session) return <main className="app-shell">{authError && <p role="alert">{authError}</p>}{showSignup ? <SignupForm onLogin={() => { setAuthError(null); setShowSignup(false); }} /> : <LoginForm onSignup={() => { setAuthError(null); setShowSignup(true); }} />}</main>;

  return (
    <main className="app-shell" style={{ height: '100dvh', minHeight: 0, padding: 0, boxSizing: 'border-box', overflow: 'hidden', width: '100%' }}>
      <div className="work-social-router-shell" style={{ height: '100%', width: '100%', maxWidth: '100%', minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Router profileId={session.user.id} />
      </div>
      <style>{`
        .work-social-router-shell > header { flex: 0 0 auto; position: sticky !important; top: 0 !important; }
        .work-social-router-shell > div:nth-child(2) { flex: 1 1 auto; min-height: 0 !important; min-width: 0 !important; width: 100% !important; max-width: 100% !important; overflow-y: auto !important; overflow-x: hidden !important; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }
        .work-social-router-shell > nav { flex: 0 0 auto; }

        /* Inbox owns its own scroll region. On mobile the fixed global nav must
           never cover the message composer; reserve the nav's real footprint in
           the page content and let only the message list scroll. */
        .work-social-router-shell > div.work-social-inbox-content {
          overflow-y: hidden !important;
          overflow-x: hidden !important;
          min-height: 0 !important;
          padding-bottom: 0 !important;
        }
        .work-social-router-shell > div.work-social-inbox-content main.premium-chat-page {
          height: 100% !important;
          min-height: 0 !important;
        }
        @media (max-width: 767px) {
          .work-social-router-shell > div.work-social-inbox-content {
            padding-bottom: calc(92px + env(safe-area-inset-bottom)) !important;
          }
          .work-social-router-shell > div.work-social-inbox-content main.premium-chat-page {
            height: 100% !important;
            min-height: 0 !important;
          }
        }
      `}</style>
    </main>
  );
}
