import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../lib/supabase/client';
import { HomePage } from './pages/HomePage';
import { FriendsPage } from './pages/FriendsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { InboxPage } from './pages/InboxPage';
import { StableInboxCallControls } from './components/StableInboxCallControls';
import { CallSpeakerEnhancer } from './components/CallSpeakerEnhancer';
import { InboxGroupMaker } from './components/InboxGroupMaker';
import { InboxGroupMenu } from './components/InboxGroupMenu';
import { BlockedUsersPage } from './pages/BlockedUsersPage';
import { GlobalModuleMenu } from './components/GlobalModuleMenu';
import { playNotificationSound, requestNotificationPermission, showBrowserNotification } from './services/notificationAudio';
import { WorkerIdentityPage } from '../features/worker/pages/WorkerIdentityPage';
import { WorkerWorkHousePage } from '../features/worker/pages/WorkerWorkHousePage';
import { WorkerWorkHistoryPage } from '../features/worker/pages/WorkerWorkHistoryPage';
import { WorkerFinancePage } from '../features/worker/pages/WorkerFinancePage';
import { WorkerSettingsPage } from '../features/worker/pages/WorkerSettingsPage';
import { WorkerNavigation } from '../features/worker/components/WorkerNavigation';
import { ContractorAccountPage } from '../features/contractor/pages/ContractorAccountPage';
import { ExpenseManagerPage } from '../features/expense-manager/pages/ExpenseManagerPage';

type Route = 'home' | 'friends' | 'notifications' | 'profile' | 'settings' | 'inbox' | 'blockedUsers' | 'publicProfile' | 'work' | 'expenseManager';

function routeFromPath(pathname: string): Route {
  if (pathname === '/expense-manager' || pathname.startsWith('/expense-manager/')) return 'expenseManager';
  if (pathname === '/work' || pathname.startsWith('/work/')) return 'work';
  if (pathname === '/friends') return 'friends';
  if (pathname === '/notifications') return 'notifications';
  if (pathname === '/profile/settings') return 'settings';
  if (pathname === '/profile') return 'profile';
  if (pathname === '/blocked-users') return 'blockedUsers';
  if (pathname.startsWith('/profile/') && pathname.length > '/profile/'.length) return 'publicProfile';
  if (pathname === '/inbox' || pathname === '/chat') return 'inbox';
  return 'home';
}

function viewedProfileId(pathname: string): string | null {
  if (!pathname.startsWith('/profile/')) return null;
  try { return decodeURIComponent(pathname.slice('/profile/'.length)) || null; } catch { return null; }
}

function locationKey() { return `${window.location.pathname}${window.location.search}`; }
export function navigate(path: string) { window.history.pushState({}, '', path); window.dispatchEvent(new PopStateEvent('popstate')); }

interface RouterProps { profileId: string; }
const notificationCopy: Record<string, string> = { message: 'You have a new message.', friend_request: 'You have a new friend request.', friend_accept: 'Your friend request was accepted.', like: 'Someone liked your post.', comment: 'Someone commented on your post.', comment_reply: 'Someone replied to your comment.', mention_post: 'You were mentioned in a post.', mention_comment: 'You were mentioned in a comment.', follow: 'Someone started following you.' };

export function Router({ profileId }: RouterProps) {
  const [route, setRoute] = useState<Route>(() => routeFromPath(window.location.pathname));
  const [locationVersion, setLocationVersion] = useState(() => locationKey());
  const [notificationUnread, setNotificationUnread] = useState(0), [chatUnread, setChatUnread] = useState(0);
  const seenNotificationIdsRef = useRef(new Set<string>());
  const loadUnread = async () => { const { count, error } = await supabase.from('notifications').select('id',{count:'exact',head:true}).eq('receiver_id',profileId).eq('is_read',false); if(!error)setNotificationUnread(count??0); };
  const loadChatUnread = async () => { const { data: mine, error: memberError } = await supabase.from('conversation_members').select('conversation_id,last_read_at').eq('profile_id',profileId); if(memberError)return; const ids=(mine??[]).map((member:{conversation_id:string})=>member.conversation_id); if(!ids.length){setChatUnread(0);return;} const { data: incoming, error }=await supabase.from('messages').select('conversation_id,sender_id,created_at').in('conversation_id',ids).neq('sender_id',profileId); if(error)return; const readMap=new Map((mine??[]).map((member:{conversation_id:string;last_read_at:string|null})=>[member.conversation_id,member.last_read_at?new Date(member.last_read_at).getTime():0])); setChatUnread((incoming??[]).filter((message:{conversation_id:string;created_at:string})=>new Date(message.created_at).getTime()>(readMap.get(message.conversation_id)??0)).length); };
  useEffect(()=>{const sync=()=>{setRoute(routeFromPath(window.location.pathname));setLocationVersion(locationKey())};window.addEventListener('popstate',sync);const timer=window.setInterval(()=>{const next=locationKey();if(next!==locationVersion){setLocationVersion(next);setRoute(routeFromPath(window.location.pathname));}},200);return()=>{window.removeEventListener('popstate',sync);window.clearInterval(timer)}},[locationVersion]);
  useEffect(()=>{let active=true;const onUserInteraction=()=>{if(!active||typeof Notification==='undefined'||Notification.permission!=='default'||localStorage.getItem('work-social:notification-permission-requested')==='1')return;localStorage.setItem('work-social:notification-permission-requested','1');void requestNotificationPermission();};window.addEventListener('pointerdown',onUserInteraction,{once:true});window.addEventListener('keydown',onUserInteraction,{once:true});return()=>{active=false;window.removeEventListener('pointerdown',onUserInteraction);window.removeEventListener('keydown',onUserInteraction)}},[]);
  useEffect(()=>{void loadUnread();void loadChatUnread();const channel=supabase.channel(`global-badges:${profileId}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'notifications',filter:`receiver_id=eq.${profileId}`},payload=>{const row=payload.new as {id?:string;type?:string;receiver_id?:string};if(row.receiver_id!==profileId||!row.id||seenNotificationIdsRef.current.has(row.id))return;seenNotificationIdsRef.current.add(row.id);playNotificationSound();showBrowserNotification('Work Social',notificationCopy[row.type??'']??'You have a new notification.',`notification:${row.id}`);void loadUnread();}).on('postgres_changes',{event:'UPDATE',schema:'public',table:'notifications',filter:`receiver_id=eq.${profileId}`},()=>void loadUnread()).on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},()=>void loadChatUnread()).on('postgres_changes',{event:'UPDATE',schema:'public',table:'conversation_members'},()=>void loadChatUnread()).subscribe();return()=>{void supabase.removeChannel(channel)}},[profileId]);
  useEffect(()=>{if(route==='notifications')void loadUnread();if(route==='inbox')void loadChatUnread()},[route]);

  const badge=(count:number)=>count>8?'9+':String(count);
  const publicId=viewedProfileId(window.location.pathname);
  const pathname=window.location.pathname;
  const inboxPage:ReactNode=(<><InboxPage profileId={profileId}/><InboxGroupMaker profileId={profileId}/><InboxGroupMenu profileId={profileId}/><CallSpeakerEnhancer /></>);
  const workPage:ReactNode=pathname==='/work/identity'
    ?<WorkerIdentityPage profileId={profileId}/>
    :pathname==='/work/finance'
      ?<WorkerFinancePage/>
      :pathname==='/work/settings/team-joining'
        ?<WorkerSettingsPage teamJoining/>
        :pathname==='/work/settings'
          ?<WorkerSettingsPage/>
          :pathname==='/work/contractor'
            ?<ContractorAccountPage/>
            :pathname==='/work/history'
              ?<WorkerWorkHistoryPage/>
              :<WorkerWorkHousePage/>;
  const pages:Record<Route,ReactNode>={
    home:<HomePage profileId={profileId}/>,
    friends:<FriendsPage/>,
    notifications:<NotificationsPage/>,
    profile:<ProfilePage profileId={profileId}/>,
    settings:<SettingsPage/>,
    inbox:inboxPage,
    blockedUsers:<BlockedUsersPage/>,
    publicProfile:publicId?<ProfilePage profileId={publicId} viewerId={profileId}/>:<ProfilePage profileId={profileId}/>,
    work:workPage,
    expenseManager:<ExpenseManagerPage pathname={pathname} onNavigate={navigate}/>,
  };
  const navItems=[{route:'home' as Route,path:'/',icon:'⌂',label:'Home'},{route:'friends' as Route,path:'/friends',icon:'♧',label:'Friends'},{route:'notifications' as Route,path:'/notifications',icon:'♢',label:'Activity',count:notificationUnread},{route:'profile' as Route,path:'/profile',icon:'◉',label:'Profile'}];

  return <>
    <header className="ws-main-header">
      <button type="button" className="ws-main-header__brand" onClick={()=>navigate('/')} aria-label="Work Social home"><span className="ws-main-header__logo" aria-hidden="true">WS</span><span className="ws-main-header__brand-copy"><strong className="ws-main-header__title">Work Social</strong><span className="ws-main-header__tagline">Your Social Work Space</span></span></button>
      <button type="button" className="ws-main-header__chat" onClick={()=>navigate('/inbox')}>💬 Chat {chatUnread>0&&<b className="ws-main-header__badge">{badge(chatUnread)}</b>}</button>
      <GlobalModuleMenu onNavigate={navigate}/>
    </header>
    <div className={route==='inbox'?'work-social-page-content work-social-inbox-content':'work-social-page-content'} style={{width:'100%',boxSizing:'border-box',paddingBottom:route==='inbox'?0:92,overflowX:'clip'}}>{pages[route]}</div>
    <StableInboxCallControls key={profileId} profileId={profileId}/>
    {route==='work'?<WorkerNavigation/>:route==='expenseManager'?null:<nav className="ws-bottom-nav" aria-label="Main navigation">{navItems.map(item=>{const active=route===item.route||(item.route==='profile'&&route==='publicProfile');return <button key={item.route} className="ws-bottom-nav__item" type="button" onClick={()=>navigate(item.path)} aria-current={active?'page':undefined}><span className="ws-bottom-nav__icon">{item.icon}</span><span className="ws-bottom-nav__label">{item.label}</span>{!!item.count&&<b className="ws-bottom-nav__badge">{badge(item.count)}</b>}</button>})}</nav>}
  </>;
}
