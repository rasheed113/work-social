import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../lib/supabase/client';
import { HomePage } from './pages/HomePage';
import { FriendsPage } from './pages/FriendsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { InboxPage } from './pages/InboxPage';

type Route = 'home' | 'friends' | 'notifications' | 'profile' | 'settings' | 'inbox';

function routeFromPath(pathname: string): Route {
  if (pathname === '/friends') return 'friends';
  if (pathname === '/notifications') return 'notifications';
  if (pathname === '/profile/settings') return 'settings';
  if (pathname === '/profile') return 'profile';
  if (pathname === '/inbox' || pathname === '/chat') return 'inbox';
  return 'home';
}

export function navigate(path: string) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

interface RouterProps { profileId: string; }

export function Router({ profileId }: RouterProps) {
  const [route, setRoute] = useState<Route>(() => routeFromPath(window.location.pathname));
  const [notificationUnread, setNotificationUnread] = useState(0);
  const [chatUnread, setChatUnread] = useState(0);

  const loadUnread = async () => {
    const { count, error } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('receiver_id', profileId).eq('is_read', false);
    if (!error) setNotificationUnread(count ?? 0);
  };

  const loadChatUnread = async () => {
    const { data: mine, error: memberError } = await supabase.from('conversation_members').select('conversation_id, last_read_at').eq('profile_id', profileId);
    if (memberError) return;
    const ids = (mine ?? []).map((m: any) => m.conversation_id);
    if (!ids.length) { setChatUnread(0); return; }
    const { data: incoming, error } = await supabase.from('messages').select('conversation_id, sender_id, created_at').in('conversation_id', ids).neq('sender_id', profileId);
    if (error) return;
    const readMap = new Map((mine ?? []).map((m: any) => [m.conversation_id, m.last_read_at ? new Date(m.last_read_at).getTime() : 0]));
    setChatUnread((incoming ?? []).filter((m: any) => new Date(m.created_at).getTime() > (readMap.get(m.conversation_id) ?? 0)).length);
  };

  useEffect(() => {
    const onPopState = () => setRoute(routeFromPath(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    void loadUnread();
    void loadChatUnread();
    const channel = supabase.channel(`global-badges:${profileId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `receiver_id=eq.${profileId}` }, () => void loadUnread())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => void loadChatUnread())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversation_members', filter: `profile_id=eq.${profileId}` }, () => void loadChatUnread())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [profileId]);

  useEffect(() => { if (route === 'notifications') void loadUnread(); if (route === 'inbox') void loadChatUnread(); }, [route]);

  const badge = (count: number) => count > 8 ? '9+' : String(count);
  const pages: Record<Route, ReactNode> = {
    home: <HomePage profileId={profileId} />,
    friends: <FriendsPage />,
    notifications: <NotificationsPage />,
    profile: <ProfilePage profileId={profileId} />,
    settings: <SettingsPage />,
    inbox: <InboxPage profileId={profileId} />,
  };

  return <>
    <header style={{ position: 'sticky', top: 0, zIndex: 900, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '12px 14px', border: '1px solid rgba(0,0,0,.1)', borderRadius: 14, background: 'rgba(255,255,255,.96)', backdropFilter: 'blur(12px)' }}>
      <strong style={{ marginRight: 'auto', fontSize: 18 }}>Work Social</strong>
      <button type="button" onClick={() => navigate('/inbox')} aria-label={chatUnread ? `Work Social Chat, ${chatUnread} unread` : 'Work Social Chat'} style={{ fontWeight: chatUnread ? 700 : 400, borderColor: chatUnread ? '#e53935' : undefined }}>{chatUnread > 0 ? '🔴' : '💬'} Chat{chatUnread > 0 ? ` ${badge(chatUnread)}` : ''}</button>
    </header>
    {pages[route]}
    <nav aria-label="Main navigation" style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1000, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, padding: '10px 12px calc(10px + env(safe-area-inset-bottom))', background: 'rgba(255,255,255,0.96)', borderTop: '1px solid rgba(0,0,0,0.12)', backdropFilter: 'blur(12px)' }}>
      <button type="button" onClick={() => navigate('/')}>🏠 <span>Home</span></button>
      <button type="button" onClick={() => navigate('/friends')}>👥 <span>Friends</span></button>
      <button type="button" onClick={() => navigate('/notifications')} aria-label={notificationUnread ? `Notifications, ${notificationUnread} unread` : 'Notifications'}>🔔 <span>Notifications{notificationUnread > 0 ? ` (${badge(notificationUnread)})` : ''}</span></button>
      <button type="button" onClick={() => navigate('/profile')}>👤 <span>Profile</span></button>
    </nav>
  </>;
}
