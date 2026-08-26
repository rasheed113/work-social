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

  return <main className="app-shell">
    <header className="foundation-card">
      <p className="eyebrow">Work Social</p>
      <nav aria-label="Main navigation">
        <button type="button" onClick={() => navigate('/')}>🏠 Home</button>
        <button type="button" onClick={() => navigate('/friends')}>👥 Friends</button>
        <button type="button" onClick={() => navigate('/notifications')}>🔔 Notifications</button>
        <button type="button" onClick={() => navigate('/profile')}>👤 Profile</button>
      </nav>
      <button type="button" onClick={() => navigate('/profile/settings')}>⚙️ Settings</button>
      <button type="button" onClick={() => void signOut()}>Sign out</button>
    </header>
    <Router profileId={session.user.id} />
  </main>;
}
