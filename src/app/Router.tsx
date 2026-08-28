import { useEffect, useState } from 'react';
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
function viewedProfileId(pathname: string): string | null {
  if (!pathname.startsWith('/profile/')) return null;
  try { return decodeURIComponent(pathname.slice('/profile/'.length)) || null; } catch { return null; }
}
function locationKey() { return `${window.location.pathname}${window.location.search}`; }
export function navigate(path: string) { window.history.pushState({}, '', path); window.dispatchEvent(new PopStateEvent('popstate')); }
interface RouterProps { profileId: string; }
export function Router({ profileId }: RouterProps) {
  const [route, setRoute] = useState<Route>(() => routeFromPath(window.location.pathname));
  const [locationVersion, setLocationVersion] = useState(() => locationKey());
  const [notificationUnread, setNotificationUnread] = useState(0), [chatUnread, setChatUnread] = useState(0);
  const loadUnread = async () => { const { count, error } = await supabase.from('notifications').select('id',{count:'exact',head:true}).eq('receiver_id',profileId).eq('is_read',false); if(!error)setNotificationUnread(count??0); };
  const loadChatUnread = async () => { const { data: mine, error: memberError } = await supabase.from('conversation_members').select('conversation_id,last_read_at').eq('profile_id',profileId); if(memberError)return; const ids=(mine??[]).map((member:{conversation_id:string})=>member.conversation_id); if(!ids.length){setChatUnread(0);return;} const { data: incoming, error }=await supabase.from('messages').select('conversation_id,sender_id,created_at').in('conversation_id',ids).neq('sender_id',profileId); if(error)return; const readMap=new Map((mine??[]).map((member:{conversation_id:string;last_read_at:string|null})=>[member.conversation_id,member.last_read_at?new Date(member.last_read_at).getTime():0])); setChatUnread((incoming??[]).filter((message:{conversation_id:string;created_at:string})=>new Date(message.created_at).getTime()>(readMap.get(message.conversation_id)??0)).length); };
  useEffect(()=>{const sync=()=>{setRoute(routeFromPath(window.location.pathname));setLocationVersion(locationKey())};window.addEventListener('popstate',sync);const timer=window.setInterval(()=>{const next=locationKey();if(next!==locationVersion){setLocationVersion(next);setRoute(routeFromPath(window.location.pathname));}},200);return()=>{window.removeEventListener('popstate',sync);window.clearInterval(timer)}},[locationVersion]);
  useEffect(()=>{void loadUnread();void loadChatUnread();const channel=supabase.channel(`global-badges:${profileId}`).on('postgres_changes',{event:'*',schema:'public',table:'notifications'},()=>void loadUnread()).on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},()=>void loadChatUnread()).on('postgres_changes',{event:'UPDATE',schema:'public',table:'conversation_members'},()=>void loadChatUnread()).subscribe();return()=>{void supabase.removeChannel(channel)}},[profileId]);
  useEffect(()=>{if(route==='notifications')void loadUnread();if(route==='inbox')void loadChatUnread()},[route]);
  const badge=(count:number)=>count>8?'9+':String(count); const publicId=viewedProfileId(window.location.pathname);
  const inboxPage:ReactNode=(<><InboxPage profileId={profileId}/><InboxGroupMaker profileId={profileId}/><StableInboxCallControls profileId={profileId}/><CallSpeakerEnhancer /></>);
  const pages:Record<Route,ReactNode>={home:<HomePage profileId={profileId}/>,friends:<FriendsPage/>,notifications:<NotificationsPage/>,profile:<ProfilePage profileId={profileId}/>,settings:<SettingsPage/>,inbox:inboxPage,blockedUsers:<BlockedUsersPage/>,publicProfile:publicId?<ProfilePage profileId={publicId} viewerId={profileId}/>:<ProfilePage profileId={profileId}/>};
  const navItems=[{route:'home' as Route,path:'/',icon:'⌂',label:'Home'},{route:'friends' as Route,path:'/friends',icon:'♧',label:'Friends'},{route:'notifications' as Route,path:'/notifications',icon:'♢',label:'Activity',count:notificationUnread},{route:'profile' as Route,path:'/profile',icon:'◉',label:'Profile'}];
  return <><header style={{position:'sticky',top:0,zIndex:900,width:'100%',marginBottom:18,padding:'9px 10px',boxSizing:'border-box',display:'flex',alignItems:'center',minHeight:64,background:'linear-gradient(135deg,#111827,#18243a 48%,#24144a)',boxShadow:'0 10px 28px rgba(15,23,42,.28)'}}><button type="button" onClick={()=>navigate('/')} style={{display:'flex',alignItems:'center',gap:9,padding:0,border:0,background:'transparent',color:'#fff',cursor:'pointer'}}><span style={{width:40,height:40,display:'grid',placeItems:'center',borderRadius:12,background:'linear-gradient(145deg,#67e8f9,#3b82f6 42%,#8b5cf6)',fontSize:20}}>W</span><strong style={{fontSize:18}}>Work Social</strong></button><button type="button" onClick={()=>navigate('/inbox')} style={{marginLeft:'auto',minHeight:40,padding:'0 12px',border:'1px solid rgba(255,255,255,.28)',borderRadius:13,color:'#fff',background:'linear-gradient(145deg,#06b6d4,#2563eb 52%,#7c3aed)',fontWeight:800,cursor:'pointer'}}>💬 Chat {chatUnread>0&&<b style={{marginLeft:5}}>{badge(chatUnread)}</b>}</button></header><div style={{width:'100%',boxSizing:'border-box',paddingBottom:92,overflowX:'clip'}}>{pages[route]}</div><nav aria-label="Main navigation" style={{position:'fixed',left:10,right:10,bottom:'calc(10px + env(safe-area-inset-bottom))',zIndex:1000,display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:7,padding:8,background:'linear-gradient(145deg,rgba(15,23,42,.97),rgba(30,41,59,.96),rgba(49,46,129,.96))',border:'1px solid rgba(255,255,255,.16)',borderRadius:22,boxShadow:'0 16px 38px rgba(15,23,42,.34)'}}>{navItems.map(item=>{const active=route===item.route||(item.route==='profile'&&route==='publicProfile');return <button key={item.route} type="button" onClick={()=>navigate(item.path)} aria-current={active?'page':undefined} style={{position:'relative',minHeight:56,border:active?'1px solid rgba(125,211,252,.55)':'1px solid transparent',borderRadius:16,color:'#fff',background:active?'rgba(59,130,246,.35)':'transparent',cursor:'pointer'}}><span style={{display:'block',fontSize:20}}>{item.icon}</span><span style={{fontSize:10,fontWeight:800}}>{item.label}</span>{!!item.count&&<b style={{position:'absolute',top:4,right:8,minWidth:18,borderRadius:999,background:'#db2777',color:'#fff',fontSize:9}}>{badge(item.count)}</b>}</button>})}</nav></>;
}