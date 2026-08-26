import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase/client';
import { getSession } from '../features/auth/api/getSession';
import { signOut } from '../features/auth/api/signOut';
import { LoginForm } from '../features/auth/components/LoginForm';
import { SignupForm } from '../features/auth/components/SignupForm';
import { ProfilePanel } from '../features/profile/components/ProfilePanel';
import { CreatePostForm } from '../features/posts/components/CreatePostForm';
import { PostFeed } from '../features/posts/components/PostFeed';

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [showSignup, setShowSignup] = useState(false);
  const [feedRefreshKey, setFeedRefreshKey] = useState(0);

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
    <section className="foundation-card">
      <p className="eyebrow">Phase 1 · Authentication</p>
      <h1>Authenticated</h1>
      <p>{session.user.email}</p>
      <button onClick={() => void signOut()}>Sign out</button>
    </section>
    <ProfilePanel profileId={session.user.id} />
    <CreatePostForm profileId={session.user.id} onCreated={() => setFeedRefreshKey((key) => key + 1)} />
    <PostFeed refreshKey={feedRefreshKey} />
  </main>;
}
