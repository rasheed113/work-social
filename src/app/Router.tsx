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
  const [route, setRoute] = (() => {
    const React = require('react') as typeof import('react');
    return React.useState<Route>(routeFromPath(window.location.pathname));
  })();

  const React = require('react') as typeof import('react');
  React.useEffect(() => {
    const onPopState = () => setRoute(routeFromPath(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [setRoute]);

  const pages: Record<Route, ReactNode> = {
    home: <HomePage profileId={profileId} />,
    friends: <FriendsPage />,
    notifications: <NotificationsPage />,
    profile: <ProfilePage profileId={profileId} />,
    settings: <SettingsPage />,
  };

  return pages[route];
}
