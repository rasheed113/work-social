import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { HomePage } from './pages/HomePage';
import { FriendsPage } from './pages/FriendsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';

type Route = 'home' | 'friends' | 'notifications' | 'profile' | 'settings';

function routeFromPath(pathname: string): Route {
  if (pathname === '/friends') return 'friends';
  if (pathname === '/notifications') return 'notifications';
  if (pathname === '/profile/settings') return 'settings';
  if (pathname === '/profile') return 'profile';
  return 'home';
}

export function navigate(path: string) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

interface RouterProps { profileId: string; }

export function Router({ profileId }: RouterProps) {
  const [route, setRoute] = useState<Route>(() => routeFromPath(window.location.pathname));

  useEffect(() => {
    const onPopState = () => setRoute(routeFromPath(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const pages: Record<Route, ReactNode> = {
    home: <HomePage profileId={profileId} />,
    friends: <FriendsPage />,
    notifications: <NotificationsPage />,
    profile: <ProfilePage profileId={profileId} />,
    settings: <SettingsPage />,
  };

  return (
    <>
      {pages[route]}
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
        <button type="button" onClick={() => navigate('/')}>🏠 <span>Home</span></button>
        <button type="button" onClick={() => navigate('/friends')}>👥 <span>Friends</span></button>
        <button type="button" onClick={() => navigate('/notifications')}>🔔 <span>Notifications</span></button>
        <button type="button" onClick={() => navigate('/profile')}>👤 <span>Profile</span></button>
      </nav>
    </>
  );
}
