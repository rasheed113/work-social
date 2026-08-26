import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase/client';
import { getSession } from '../features/auth/api/getSession';
import { signOut } from '../features/auth/api/signOut';
import { LoginForm } from '../features/auth/components/LoginForm';
import { SignupForm } from '../features/auth/components/SignupForm';
import { HomePage } from './pages/HomePage';
import { FriendsPage } from './pages/FriendsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';

type Page = 'home' | 'friends' | 'notifications' | 'profile' | 'settings';

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [showSignup, setShowSignup] = useState(false);
  const [page, setPage] = useState<Page>('home');

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

  function renderPage() {
    switch (page) {
      case 'friends': return <FriendsPage />;
      case 'notifications': return <NotificationsPage />;
      case 'profile': return <ProfilePage profileId={session.user.id} />;
      case 'settings': return <SettingsPage />;
      default: return <HomePage profileId={session.user.id} />;
    }
  }

  return <main className="app-shell">
    <header className="foundation-card">
      <p className="eyebrow">Work Social</p>
      <nav aria-label="Main navigation">
        <button type="button" onClick={() => setPage('home')}>🏠 Home</button>
        <button type="button" onClick={() => setPage('friends')}>👥 Friends</button>
        <button type="button" onClick={() => setPage('notifications')}>🔔 Notifications</button>
        <button type="button" onClick={() => setPage('profile')}>👤 Profile</button>
      </nav>
      <button type="button" onClick={() => setPage('settings')}>⚙️ Settings</button>
      <button type="button" onClick={() => void signOut()}>Sign out</button>
    </header>
    {renderPage()}
  </main>;
}
