import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase/client';
import { getSession } from '../features/auth/api/getSession';
import { LoginForm } from '../features/auth/components/LoginForm';
import { SignupForm } from '../features/auth/components/SignupForm';
import { Router } from './Router';

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
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        url.searchParams.delete('code'); url.searchParams.delete('state');
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
        if (error && active) setAuthError(error.message);
      }
      const { data } = await getSession();
      if (active) { setSession(data.session); setInitializing(false); }
    }
    void initializeAuth();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => { if (active) setSession(nextSession); });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  if (initializing) return <main className="app-shell"><div className="auth-card"><p>Signing you in…</p></div></main>;
  if (!session) return <main className="app-shell">{authError && <p role="alert">{authError}</p>}{showSignup ? <SignupForm onLogin={() => { setAuthError(null); setShowSignup(false); }} /> : <LoginForm onSignup={() => { setAuthError(null); setShowSignup(true); }} />}</main>;

  return (
    <main className="app-shell" style={{ height: '100dvh', minHeight: 0, padding: 16, paddingBottom: 88, boxSizing: 'border-box', overflow: 'hidden' }}>
      <div className="work-social-router-shell" style={{ height: '100%', minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Router profileId={session.user.id} />
      </div>
      <style>{`
        .work-social-router-shell > header { flex: 0 0 auto; position: sticky !important; top: 0 !important; }
        .work-social-router-shell > div:nth-child(2) { flex: 1 1 auto; min-height: 0 !important; min-width: 0 !important; overflow-y: auto !important; overflow-x: hidden !important; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }
        .work-social-router-shell > nav { flex: 0 0 auto; }
      `}</style>
    </main>
  );
}
