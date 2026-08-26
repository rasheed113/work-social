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

  useEffect(() => {
    getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => listener.subscription.unsubscribe();
  }, []);

  if (!session) {
    return <main className="app-shell">{showSignup
      ? <SignupForm onLogin={() => setShowSignup(false)} />
      : <LoginForm onSignup={() => setShowSignup(true)} />}</main>;
  }

  return <main className="app-shell" style={{ minHeight: '100vh', paddingBottom: 88 }}>
    <header className="foundation-card">
      <p className="eyebrow">Work Social</p>
    </header>
    <Router profileId={session.user.id} />
  </main>;
}
