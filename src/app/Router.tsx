import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../lib/supabase/client';
import { HomePage } from './pages/HomePage';
import { FriendsPage } from './pages/FriendsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { InboxPage } from './pages/InboxPage';
import { BlockedUsersPage } from './pages/BlockedUsersPage';

type Route = 'home' | 'friends' | 'notifications' | 'profile' | 'settings' | 'inbox' | 'blockedUsers' | 'publicProfile';
function routeFromPath(pathname: string): Route {
  if (pathname === '/friends') return 'friends';
  if (pathname === '/notifications') return 'notifications';
  if (pathname === '/profile/settings') return 'settings';
  if (pathname === '/profile') return 'profile';
  if (pathname === '/blocked-users') return 'blockedUsers';
  if (pathname.startsWith('/profile/') && pathname.length > '/profile/'.length) return 'publicProfile';
  if (pathname === '/inbox' || pathname === '/chat') return 'inbox';
  return 'home';
}
function viewedProfileId(pathname: string) {
  if (!pathname.startsWith('/profile/')) return null;
  const id = pathname.slice('/profile/'.length);
  try { return decodeURIComponent(id) || null; } catch { return null; }
}
export function navigate(path: string) { window.history.pushState({}, '', path); window.dispatchEvent(new PopStateEvent('popstate')); }
interface RouterProps { profileId: string; }
export function Router({ profileId }: RouterProps) {
  const [route, setRoute] = useState<Route>(() => routeFromPath(window.location.pathname));
  const [notificationUnread, setNotificationUnread] = useState(0);
  const [chatUnread, setChatUnread] = useState(0);
  const loadUnread = async () => { const { count, error } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('receiver_id', profileId).eq('is_read', false); if (!error) setNotificationUnread(count ?? 0); };
  const loadChatUnread = async () => { const { data: mine, error: memberError } = await supabase.from('conversation_members').select('conversation_id, last_read_at').eq('profile_id', profileId); if (memberError) return; const ids = (mine ?? []).map((m: any) => m.conversation_id); if (!ids.length) { setChatUnread(0); return; } const { data: incoming, error } = await supabase.from('messages').select('conversation_id, sender_id, created_at').in('conversation_id', ids).neq('sender_id', profileId); if (error) return; const readMap = new Map((mine ?? []).map((m: any) => [m.conversation_id, m.last_read_at ? new Date(m.last_read_at).getTime() : 0])); setChatUnread((incoming ?? []).filter((m: any) => new Date(m.created_at).getTime() > (readMap.get(m.conversation_id) ?? 0)).length); };
  useEffect(() => { const onPopState = () => setRoute(routeFromPath(window.location.pathname)); window.addEventListener('popstate', onPopState); return () => window.removeEventListener('popstate', onPopState); }, []);
  useEffect(() => { const openPostAuthor = async (event: MouseEvent) => { const target = event.target as HTMLElement | null; if (!target || target.closest('button, a, input, textarea, video')) return; const article = target.closest('article'); const header = target.closest('article header'); if (!article || !header) return; const author = header.querySelector('strong'); const avatar = header.querySelector('img'); if (!author || !(target === author || author.contains(target) || target === avatar || avatar?.contains(target))) return; const displayName = author.textContent?.trim(); const avatarUrl = avatar?.getAttribute('src'); if (!displayName && !avatarUrl) return; let authorId: string | null = null; if (avatarUrl) { const { data } = await supabase.from('profiles').select('id').eq('avatar_url', avatarUrl).maybeSingle(); authorId = data?.id ?? null; } if (!authorId && displayName) { const { data } = await supabase.from('profiles').select('id').eq('display_name', displayName).limit(1).maybeSingle(); authorId = data?.id ?? null; } if (authorId) navigate(`/profile/${encodeURIComponent(authorId)}`); }; const markAuthorClickable = (event: MouseEvent) => { const target = event.target as HTMLElement | null; const article = target?.closest('article'); const header = target?.closest('article header'); if (!article || !header) return; const author = header.querySelector('strong') as HTMLElement | null; const avatar = header.querySelector('img') as HTMLElement | null; if (author) author.style.cursor = 'pointer'; if (avatar) avatar.style.cursor = 'pointer'; }; document.addEventListener('click', openPostAuthor); document.addEventListener('mouseover', markAuthorClickable); return () => { document.removeEventListener('click', openPostAuthor); document.removeEventListener('mouseover', markAuthorClickable); }; }, []);
  useEffect(() => { void loadUnread(); void loadChatUnread(); const channel = supabase.channel(`global-badges:${profileId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `receiver_id=eq.${profileId}` }, () => void loadUnread()).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => void loadChatUnread()).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversation_members', filter: `profile_id=eq.${profileId}` }, () => void loadChatUnread()).subscribe(); return () => { void supabase.removeChannel(channel); }; }, [profileId]);
  useEffect(() => { if (route === 'notifications') void loadUnread(); if (route === 'inbox') void loadChatUnread(); }, [route]);
  const badge = (count: number) => count > 8 ? '9+' : String(count);
  const publicId = viewedProfileId(window.location.pathname);
  const pages: Record<Route, ReactNode> = { home: <HomePage profileId={profileId} />, friends: <FriendsPage />, notifications: <NotificationsPage />, profile: <ProfilePage profileId={profileId} />, settings: <SettingsPage />, inbox: <InboxPage profileId={profileId} />, blockedUsers: <BlockedUsersPage />, publicProfile: publicId ? <ProfilePage profileId={publicId} viewerId={profileId} /> : <ProfilePage profileId={profileId} /> };
  const navItems: { route: Route; path: string; icon: string; label: string; count?: number }[] = [
    { route: 'home', path: '/', icon: '⌂', label: 'Home' },
    { route: 'friends', path: '/friends', icon: '♧', label: 'Friends' },
    { route: 'notifications', path: '/notifications', icon: '♢', label: 'Activity', count: notificationUnread },
    { route: 'profile', path: '/profile', icon: '◉', label: 'Profile' },
  ];
  return <><header style={{ position: 'sticky', top: 0, zIndex: 900, width: '100%', maxWidth: '100%', margin: 0, marginBottom: 18, padding: '9px 10px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 7, minHeight: 64, borderBottom: '1px solid rgba(255,255,255,.16)', background: 'linear-gradient(135deg, #111827 0%, #18243a 48%, #24144a 100%)', boxShadow: '0 10px 28px rgba(15,23,42,.28), inset 0 1px 0 rgba(255,255,255,.12)', overflow: 'visible' }}>
    <button type="button" onClick={() => navigate('/')} aria-label="Work Social home" style={{ flex: '1 1 auto', minWidth: 0, maxWidth: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: 0, border: 0, background: 'transparent', color: '#fff', cursor: 'pointer', textAlign: 'left', overflow: 'hidden' }}>
      <span aria-hidden="true" style={{ position: 'relative', width: 40, height: 40, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 12, background: 'linear-gradient(145deg, #67e8f9 0%, #3b82f6 42%, #8b5cf6 100%)', boxShadow: 'inset 0 2px 2px rgba(255,255,255,.42), inset 0 -5px 8px rgba(30,41,59,.28), 0 7px 18px rgba(59,130,246,.38)', transform: 'perspective(80px) rotateX(4deg)' }}>
        <span style={{ width: 20, height: 20, borderRadius: 7, background: 'rgba(255,255,255,.96)', boxShadow: '0 3px 7px rgba(15,23,42,.32)' }} />
        <span style={{ position: 'absolute', width: 8, height: 8, borderRadius: '50%', background: '#fbbf24', right: 5, top: 5, boxShadow: '0 0 10px rgba(251,191,36,.85)' }} />
      </span>
      <span style={{ minWidth: 0, overflow: 'hidden', lineHeight: 1.05 }}><strong style={{ display: 'block', fontSize: 18, letterSpacing: '.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: '0 2px 0 rgba(0,0,0,.28), 0 5px 16px rgba(56,189,248,.22)' }}>Work Social</strong><small style={{ display: 'block', marginTop: 3, color: 'rgba(255,255,255,.62)', fontSize: 8, fontWeight: 700, letterSpacing: '.14em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textTransform: 'uppercase' }}>Connect · Share · Work</small></span>
    </button>
    <button type="button" onClick={() => navigate('/inbox')} aria-label={chatUnread ? `Work Social Chat, ${chatUnread} unread` : 'Work Social Chat'} style={{ flex: '0 0 auto', marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, minWidth: 0, minHeight: 40, padding: '0 10px', border: '1px solid rgba(255,255,255,.28)', borderRadius: 13, color: '#fff', fontWeight: 800, fontSize: 13, letterSpacing: '.01em', cursor: 'pointer', whiteSpace: 'nowrap', background: chatUnread ? 'linear-gradient(145deg, #f43f5e, #db2777)' : 'linear-gradient(145deg, #06b6d4, #2563eb 52%, #7c3aed)', boxShadow: chatUnread ? 'inset 0 2px 2px rgba(255,255,255,.28), inset 0 -4px 8px rgba(127,29,29,.24), 0 7px 20px rgba(244,63,94,.34)' : 'inset 0 2px 2px rgba(255,255,255,.32), inset 0 -4px 8px rgba(30,64,175,.28), 0 7px 20px rgba(37,99,235,.32)', transform: 'translateY(0)' }}>{chatUnread > 0 ? '🔴' : '💬'} <span>Chat</span>{chatUnread > 0 && <b style={{ minWidth: 19, height: 19, padding: '0 4px', display: 'inline-grid', placeItems: 'center', borderRadius: 999, background: 'rgba(255,255,255,.94)', color: '#be123c', fontSize: 10 }}>{badge(chatUnread)}</b>}</button>
  </header><div style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', paddingBottom: 92, overflowX: 'clip' }}>{pages[route]}</div><nav aria-label="Main navigation" style={{ position: 'fixed', left: 10, right: 10, bottom: 'calc(10px + env(safe-area-inset-bottom))', zIndex: 1000, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 7, padding: 8, boxSizing: 'border-box', maxWidth: 'calc(100vw - 20px)', background: 'linear-gradient(145deg, rgba(15,23,42,.97), rgba(30,41,59,.96) 52%, rgba(49,46,129,.96))', border: '1px solid rgba(255,255,255,.16)', borderRadius: 22, boxShadow: '0 16px 38px rgba(15,23,42,.34), inset 0 1px 0 rgba(255,255,255,.16)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)' }}>
    {navItems.map((item) => { const active = route === item.route || (item.route === 'profile' && route === 'publicProfile'); return <button key={item.route} type="button" onClick={() => navigate(item.path)} aria-current={active ? 'page' : undefined} style={{ position: 'relative', minWidth: 0, minHeight: 58, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, padding: '6px 4px', border: active ? '1px solid rgba(125,211,252,.55)' : '1px solid transparent', borderRadius: 16, color: active ? '#fff' : 'rgba(255,255,255,.66)', background: active ? 'linear-gradient(145deg, rgba(14,165,233,.42), rgba(99,102,241,.5))' : 'transparent', boxShadow: active ? 'inset 0 2px 2px rgba(255,255,255,.16), inset 0 -4px 8px rgba(15,23,42,.22), 0 5px 15px rgba(56,189,248,.18)' : 'none', transform: active ? 'translateY(-2px)' : 'translateY(0)', cursor: 'pointer', transition: 'transform .18s ease, background .18s ease, color .18s ease, box-shadow .18s ease' }}>
      <span aria-hidden="true" style={{ width: 30, height: 30, display: 'grid', placeItems: 'center', borderRadius: 10, fontSize: 22, lineHeight: 1, background: active ? 'linear-gradient(145deg, rgba(255,255,255,.28), rgba(255,255,255,.06))' : 'rgba(255,255,255,.05)', boxShadow: active ? 'inset 0 2px 2px rgba(255,255,255,.2), 0 4px 10px rgba(0,0,0,.18)' : 'inset 0 1px 1px rgba(255,255,255,.07)' }}>{item.icon}</span>
      <span style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10, fontWeight: active ? 900 : 700, letterSpacing: '.01em' }}>{item.label}</span>
      {!!item.count && <b style={{ position: 'absolute', top: 4, right: 10, minWidth: 18, height: 18, padding: '0 4px', boxSizing: 'border-box', display: 'grid', placeItems: 'center', borderRadius: 999, background: 'linear-gradient(145deg, #fb7185, #db2777)', color: '#fff', fontSize: 9, boxShadow: '0 3px 9px rgba(219,39,119,.4)' }}>{badge(item.count)}</b>}
    </button>; })}
  </nav></>;
}
