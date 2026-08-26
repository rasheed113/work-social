import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase/client';
import { getSession } from '../features/auth/api/getSession';
import { signOut } from '../features/auth/api/signOut';
import { LoginForm } from '../features/auth/components/LoginForm';
import { SignupForm } from '../features/auth/components/SignupForm';
import { Router, navigate } from './Router';

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
    <header className="foundation-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <p className="eyebrow">Work Social</p>
      <button type="button" onClick={() => void signOut()}>Sign out</button>
    </header>

    <Router profileId={session.user.id} />

    <nav
      aria-label="Main navigation"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 8,
        padding: '10px 12px calc(10px + env(safe-area-inset-bottom))',
        background: 'rgba(255,255,255,0.96)',
        borderTop: '1px solid rgba(0,0,0,0.12)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <button type="button" onClick={() => navigate('/')}>🏠<span>Home</span></button>
      <button type="button" onClick={() => navigate('/friends')}>👥<span>Friends</span></button>
      <button type="button" onClick={() => navigate('/notifications')}>🔔<span>Notifications</span></button>
      <button type="button" onClick={() => navigate('/profile')}>👤<span>Profile</span></button>
    </nav>
  </main>;
}
