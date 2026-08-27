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
        url.searchParams.delete('code');
        url.searchParams.delete('state');
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
        if (error && active) setAuthError(error.message);
      }

      const { data } = await getSession();
      if (active) {
        setSession(data.session);
        setInitializing(false);
      }
    }

    void initializeAuth();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) setSession(nextSession);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (initializing) {
    return <main className="app-shell"><div className="auth-card"><p>Signing you in…</p></div></main>;
  }

  if (!session) {
    return <main className="app-shell">
      {authError && <p role="alert">{authError}</p>}
      {showSignup
        ? <SignupForm onLogin={() => { setAuthError(null); setShowSignup(false); }} />
        : <LoginForm onSignup={() => { setAuthError(null); setShowSignup(true); }} />}
    </main>;
  }

  return <main className="app-shell" style={{ minHeight: '100vh', paddingBottom: 88 }}>
    <header className="foundation-card">
      <p className="eyebrow">Work Social</p>
    </header>
    <Router profileId={session.user.id} />
  </main>;
}
