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
    <style>{`\
      .ws-main-header{position:sticky;top:0;z-index:900;width:100%;max-width:100%;min-width:0;margin:0 0 18px;padding:9px 10px;box-sizing:border-box;display:flex;align-items:center;gap:10px;min-height:64px;overflow:visible;background:linear-gradient(145deg,rgba(10,18,32,.96),rgba(25,35,55,.93) 52%,rgba(45,35,82,.92));border:1px solid rgba(255,255,255,.12);border-top-color:rgba(255,255,255,.2);border-radius:0 0 18px 18px;box-shadow:0 12px 30px rgba(15,23,42,.22),inset 0 1px 0 rgba(255,255,255,.09);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}\
      .ws-main-header::before{content:'';position:absolute;inset:0;pointer-events:none;background:linear-gradient(110deg,rgba(255,255,255,.07),transparent 34%,rgba(255,255,255,.025) 72%,transparent);opacity:.9}\
      .ws-main-header__brand,.ws-main-header__chat{position:relative;z-index:1}\
      .ws-main-header__brand{display:flex;align-items:center;gap:10px;min-width:0;flex:1 1 auto;padding:3px 4px 3px 2px;border:0;border-radius:14px;background:transparent;color:#fff;cursor:pointer;text-align:left;transition:background .18s ease,transform .18s ease}\
      .ws-main-header__brand:hover{background:rgba(255,255,255,.05)}\
      .ws-main-header__brand:active{transform:translateY(1px)}\
      .ws-main-header__logo{position:relative;width:40px;height:40px;flex:0 0 40px;display:grid;place-items:center;box-sizing:border-box;border:1px solid rgba(255,255,255,.24);border-radius:13px;background:linear-gradient(145deg,#8ff3ff 0%,#3b82f6 45%,#6d3fe8 100%);box-shadow:inset 0 1px 1px rgba(255,255,255,.38),inset 0 -2px 4px rgba(30,41,59,.2),0 7px 15px rgba(37,99,235,.25);font-size:18px;line-height:1;font-weight:950;letter-spacing:-.08em;text-shadow:0 1px 0 rgba(255,255,255,.45),0 2px 3px rgba(15,23,42,.38)}\
      .ws-main-header__logo::after{content:'';position:absolute;inset:1px;border-radius:12px;pointer-events:none;background:linear-gradient(145deg,rgba(255,255,255,.28),transparent 42%);mix-blend-mode:screen}\
      .ws-main-header__brand-copy{min-width:0;display:flex;flex-direction:column;justify-content:center;gap:2px;overflow:hidden}\
      .ws-main-header__title{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:18px;line-height:1.05;font-weight:900;letter-spacing:-.035em;color:#f8fafc;text-shadow:0 1px 0 rgba(255,255,255,.08),0 2px 7px rgba(0,0,0,.28)}\
      .ws-main-header__tagline{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:8px;line-height:1.2;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:rgba(186,230,253,.82);text-shadow:0 1px 4px rgba(0,0,0,.28)}\
      .ws-main-header__chat{margin-left:0;min-width:0;min-height:40px;flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:0 13px;box-sizing:border-box;border:1px solid rgba(255,255,255,.2);border-radius:13px;color:#fff;background:linear-gradient(145deg,rgba(6,182,212,.9),rgba(37,99,235,.92) 54%,rgba(124,58,237,.9));box-shadow:inset 0 1px 1px rgba(255,255,255,.2),0 8px 18px rgba(37,99,235,.2);font-weight:800;cursor:pointer;white-space:nowrap;transition:transform .18s ease,box-shadow .18s ease,filter .18s ease}\
      .ws-main-header__chat:hover{filter:brightness(1.05);box-shadow:inset 0 1px 1px rgba(255,255,255,.22),0 10px 22px rgba(37,99,235,.26)}\
      .ws-main-header__chat:active{transform:translateY(1px);box-shadow:inset 0 2px 4px rgba(0,0,0,.18),0 5px 12px rgba(37,99,235,.18)}\
      .ws-main-header__brand:focus-visible,.ws-main-header__chat:focus-visible{outline:2px solid rgba(125,211,252,.9);outline-offset:2px}\
      .ws-main-header__badge{display:inline-grid;place-items:center;min-width:20px;height:20px;padding:0 5px;box-sizing:border-box;border:1px solid rgba(255,255,255,.22);border-radius:999px;background:rgba(15,23,42,.3);font-size:10px;line-height:1;font-weight:900}\
      @media (max-width:420px){.ws-main-header{padding-left:8px;padding-right:8px;gap:7px}.ws-main-header__brand{gap:8px}.ws-main-header__logo{width:38px;height:38px;flex-basis:38px;font-size:17px}.ws-main-header__title{font-size:16px}.ws-main-header__tagline{font-size:7px;letter-spacing:.1em}.ws-main-header__chat{padding:0 10px;font-size:13px}.ws-main-header__badge{min-width:18px;height:18px}}\
      @media (max-width:340px){.ws-main-header{gap:4px}.ws-main-header__brand{gap:5px;padding-left:0;padding-right:0}.ws-main-header__logo{width:34px;height:34px;flex-basis:34px;font-size:15px}.ws-main-header__title{font-size:13px}.ws-main-header__tagline{font-size:5px;letter-spacing:.065em}.ws-main-header__chat{padding:0 6px;font-size:11px;gap:3px}}\
    `}</style>
    <header className="ws-main-header">
      <button type="button" className="ws-main-header__brand" onClick={()=>navigate('/')} aria-label="Work Social home"><span className="ws-main-header__logo" aria-hidden="true">WS</span><span className="ws-main-header__brand-copy"><strong className="ws-main-header__title">Work Social</strong><span className="ws-main-header__tagline">Your Social Work Space</span></span></button>
      <button type="button" className="ws-main-header__chat" onClick={()=>navigate('/inbox')}>💬 Chat {chatUnread>0&&<b className="ws-main-header__badge">{badge(chatUnread)}</b>}</button>
      <GlobalModuleMenu onNavigate={navigate}/>
    </header>
    <div className={route==='inbox'?'work-social-page-content work-social-inbox-content':'work-social-page-content'} style={{width:'100%',boxSizing:'border-box',paddingBottom:route==='inbox'?0:92,overflowX:'clip'}}>{pages[route]}</div>
    <StableInboxCallControls key={profileId} profileId={profileId}/>
    {route==='work'?<WorkerNavigation/>:route==='expenseManager'?null:<nav aria-label="Main navigation" style={{position:'fixed',left:10,right:10,bottom:'0px',zIndex:1000,display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:7,padding:8,paddingBottom:'max(8px, env(safe-area-inset-bottom))',background:'linear-gradient(145deg,rgba(15,23,42,.97),rgba(30,41,59,.96),rgba(49,46,129,.96))',border:'1px solid rgba(255,255,255,.16)',borderRadius:'22px 22px 0 0',boxShadow:'0 -8px 24px rgba(15,23,42,.22)'}}>{navItems.map(item=>{const active=route===item.route||(item.route==='profile'&&route==='publicProfile');return <button key={item.route} type="button" onClick={()=>navigate(item.path)} aria-current={active?'page':undefined} style={{position:'relative',minHeight:48,border:active?'1px solid rgba(125,211,252,.55)':'1px solid transparent',borderRadius:13,color:'#fff',background:active?'rgba(59,130,246,.35)':'transparent',cursor:'pointer'}}><span style={{display:'block',fontSize:18}}>{item.icon}</span><span style={{fontSize:9,fontWeight:800}}>{item.label}</span>{!!item.count&&<b style={{position:'absolute',top:3,right:8,minWidth:18,borderRadius:999,background:'#db2777',color:'#fff',fontSize:9}}>{badge(item.count)}</b>}</button>})}</nav>}
  </>;
}
