import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase/client';
import { getSession } from '../features/auth/api/getSession';
import { LoginForm } from '../features/auth/components/LoginForm';
import { SignupForm } from '../features/auth/components/SignupForm';
import { WorkSocialAiAssistant } from '../features/ai/components/WorkSocialAiAssistantWithMode';
import { MovableAiLauncher } from '../features/ai/components/MovableAiLauncher';
import { accountModePath, getLastAccountMode } from '../features/account/accountModePersistence';
import { Router, navigate } from './Router';
import { WorkSocialPremiumLoader } from './components/WorkSocialPremiumLoader';

const AUTH_INIT_TIMEOUT_MS = 8000;
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> { return Promise.race([promise, new Promise<T>((_, reject) => { window.setTimeout(() => reject(new Error(message)), timeoutMs); })]); }

function restoreLastAccountMode(profileId: string) {
  const mode = getLastAccountMode(profileId);
  if (!mode) return;
  const target = accountModePath(mode);
  if (target === '/' || window.location.pathname !== '/') return;
  navigate(target);
}

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [showSignup, setShowSignup] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    async function initializeAuth() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      const oauthError = url.searchParams.get('error_description') || url.searchParams.get('error');
      if (oauthError) { url.search = ''; window.history.replaceState({}, '', `${url.pathname}${url.hash}`); if (active) setAuthError(oauthError); }
      try {
        if (code) {
          const { error } = await withTimeout(supabase.auth.exchangeCodeForSession(code), AUTH_INIT_TIMEOUT_MS, 'Authentication is taking too long. You can continue and retry without blocking the app.');
          url.searchParams.delete('code'); url.searchParams.delete('state'); window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`); if (error && active) setAuthError(error.message);
        }
        const { data, error } = await withTimeout(getSession(), AUTH_INIT_TIMEOUT_MS, 'Authentication initialization timed out. The app will continue and retry in the background.');
        if (!active) return; if (error) setAuthError(error.message); setSession(data.session);
        if (data.session) window.setTimeout(() => restoreLastAccountMode(data.session!.user.id), 0);
      } catch (error) { if (active) setAuthError(error instanceof Error ? error.message : 'Authentication initialization failed.'); }
      finally { if (active) setInitializing(false); }
    }
    void initializeAuth();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => { if (active) { setSession(nextSession); setAuthError(null); if (nextSession) window.setTimeout(() => restoreLastAccountMode(nextSession.user.id), 0); } });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    const classifyPage = () => {
      const path = window.location.pathname.toLowerCase();
      const page = path.startsWith('/notifications') ? 'notifications'
        : path.startsWith('/chat') || path.startsWith('/inbox') ? 'chat'
        : path.startsWith('/friends') ? 'friends'
        : path.startsWith('/profile') ? 'profile'
        : path.startsWith('/settings') ? 'settings'
        : path.startsWith('/work/finance') ? 'finance'
        : path.startsWith('/expense-manager') ? 'expense-manager'
        : path.startsWith('/contractor') ? 'contractor'
        : 'social';
      document.body.dataset.wsPage = page;
    };
    classifyPage();
    window.addEventListener('popstate', classifyPage);
    const observer = new MutationObserver(classifyPage);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      window.removeEventListener('popstate', classifyPage);
      observer.disconnect();
      delete document.body.dataset.wsPage;
    };
  }, []);
  if (initializing) return <WorkSocialPremiumLoader title="Opening Work Social" message="Checking your secure session and preparing your workspace." status="Securing your workspace" />;
  if (!session) return <main className="app-shell auth-screen" style={{ background: 'radial-gradient(circle at 15% 15%, rgba(109,93,252,.20), transparent 32%), radial-gradient(circle at 88% 85%, rgba(34,193,220,.16), transparent 30%), linear-gradient(135deg, #080b16 0%, #11162a 48%, #09151b 100%)', minHeight: '100dvh', width: '100%', padding: '24px', boxSizing: 'border-box', position: 'relative', overflowX: 'hidden' }}>{authError && <p role="alert">{authError}</p>}{showSignup ? <SignupForm onLogin={() => { setAuthError(null); setShowSignup(false); }} /> : <LoginForm onSignup={() => { setAuthError(null); setShowSignup(true); }} />}<style>{`.auth-screen::before{content:'';position:fixed;inset:0;pointer-events:none;background:linear-gradient(115deg,transparent 0%,rgba(255,255,255,.035) 48%,transparent 62%);}.auth-screen>.ws-auth-card{position:relative;z-index:1;}.auth-screen>[role=alert]{position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:5;width:min(calc(100% - 32px),438px);margin:0;padding:11px 14px;border:1px solid rgba(248,113,113,.28);border-radius:13px;background:rgba(45,16,25,.88);color:#fecaca;box-shadow:0 14px 34px rgba(0,0,0,.28);backdrop-filter:blur(14px);}`}</style></main>;
  return <main className="app-shell" style={{ height: '100dvh', minHeight: 0, padding: 0, boxSizing: 'border-box', overflow: 'hidden', width: '100%' }}>
    <div className="work-social-router-shell" style={{ height: '100%', width: '100%', maxWidth: '100%', minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}><div className="ws-cosmic-atmosphere" aria-hidden="true"><span className="ws-cosmic-orb ws-cosmic-orb-a" /><span className="ws-cosmic-orb ws-cosmic-orb-b" /><span className="ws-cosmic-orb ws-cosmic-orb-c" /><span className="ws-cosmic-orb ws-cosmic-orb-d" /><span className="ws-cosmic-core" /><span className="ws-cosmic-star-layer ws-cosmic-star-layer-a" /><span className="ws-cosmic-star-layer ws-cosmic-star-layer-b" /><span className="ws-cosmic-star-layer ws-cosmic-star-layer-c" /><span className="ws-cosmic-dust" /><span className="ws-cosmic-streaks" /><span className="ws-living-star-field" aria-hidden="true"><span key={0} className="ws-living-star" style={{'--ws-x':'11%','--ws-y':'7%','--ws-size':'1px','--ws-duration':'9s','--ws-delay':'0s'} as CSSProperties}} /><span key={1} className="ws-living-star" style={{'--ws-x':'48%','--ws-y':'68%','--ws-size':'1.2px','--ws-duration':'11s','--ws-delay':'-7s'} as CSSProperties}} /><span key={2} className="ws-living-star" style={{'--ws-x':'85%','--ws-y':'36%','--ws-size':'1.5px','--ws-duration':'13s','--ws-delay':'-1s'} as CSSProperties}} /><span key={3} className="ws-living-star" style={{'--ws-x':'25%','--ws-y':'4%','--ws-size':'1.8px','--ws-duration':'15s','--ws-delay':'-6s'} as CSSProperties}} /><span key={4} className="ws-living-star" style={{'--ws-x':'62%','--ws-y':'65%','--ws-size':'2.2px','--ws-duration':'17s','--ws-delay':'-11s'} as CSSProperties}} /><span key={5} className="ws-living-star" style={{'--ws-x':'2%','--ws-y':'33%','--ws-size':'1px','--ws-duration':'19s','--ws-delay':'-16s'} as CSSProperties}} /><span key={6} className="ws-living-star" style={{'--ws-x':'39%','--ws-y':'1%','--ws-size':'1.2px','--ws-duration':'21s','--ws-delay':'0s'} as CSSProperties}} /><span key={7} className="ws-living-star" style={{'--ws-x':'76%','--ws-y':'62%','--ws-size':'1.5px','--ws-duration':'23s','--ws-delay':'-3s'} as CSSProperties}} /><span key={8} className="ws-living-star" style={{'--ws-x':'16%','--ws-y':'30%','--ws-size':'1.8px','--ws-duration':'9s','--ws-delay':'-2s'} as CSSProperties}} /><span key={9} className="ws-living-star" style={{'--ws-x':'53%','--ws-y':'91%','--ws-size':'2.2px','--ws-duration':'11s','--ws-delay':'-8s'} as CSSProperties}} /><span key={10} className="ws-living-star" style={{'--ws-x':'90%','--ws-y':'59%','--ws-size':'1px','--ws-duration':'13s','--ws-delay':'-5s'} as CSSProperties}} /><span key={11} className="ws-living-star" style={{'--ws-x':'30%','--ws-y':'27%','--ws-size':'1.2px','--ws-duration':'15s','--ws-delay':'-2s'} as CSSProperties}} /><span key={12} className="ws-living-star" style={{'--ws-x':'67%','--ws-y':'88%','--ws-size':'1.5px','--ws-duration':'17s','--ws-delay':'-16s'} as CSSProperties}} /><span key={13} className="ws-living-star" style={{'--ws-x':'7%','--ws-y':'56%','--ws-size':'1.8px','--ws-duration':'19s','--ws-delay':'-15s'} as CSSProperties}} /><span key={14} className="ws-living-star" style={{'--ws-x':'44%','--ws-y':'24%','--ws-size':'2.2px','--ws-duration':'21s','--ws-delay':'-14s'} as CSSProperties}} /><span key={15} className="ws-living-star" style={{'--ws-x':'81%','--ws-y':'85%','--ws-size':'1px','--ws-duration':'23s','--ws-delay':'-13s'} as CSSProperties}} /><span key={16} className="ws-living-star" style={{'--ws-x':'21%','--ws-y':'53%','--ws-size':'1.2px','--ws-duration':'9s','--ws-delay':'-4s'} as CSSProperties}} /><span key={17} className="ws-living-star" style={{'--ws-x':'58%','--ws-y':'21%','--ws-size':'1.5px','--ws-duration':'11s','--ws-delay':'-9s'} as CSSProperties}} /><span key={18} className="ws-living-star" style={{'--ws-x':'95%','--ws-y':'82%','--ws-size':'1.8px','--ws-duration':'13s','--ws-delay':'-9s'} as CSSProperties}} /><span key={19} className="ws-living-star" style={{'--ws-x':'35%','--ws-y':'50%','--ws-size':'2.2px','--ws-duration':'15s','--ws-delay':'-13s'} as CSSProperties}} /><span key={20} className="ws-living-star" style={{'--ws-x':'72%','--ws-y':'18%','--ws-size':'1px','--ws-duration':'17s','--ws-delay':'-4s'} as CSSProperties}} /><span key={21} className="ws-living-star" style={{'--ws-x':'12%','--ws-y':'79%','--ws-size':'1.2px','--ws-duration':'19s','--ws-delay':'-14s'} as CSSProperties}} /><span key={22} className="ws-living-star" style={{'--ws-x':'49%','--ws-y':'47%','--ws-size':'1.5px','--ws-duration':'21s','--ws-delay':'-7s'} as CSSProperties}} /><span key={23} className="ws-living-star" style={{'--ws-x':'86%','--ws-y':'15%','--ws-size':'1.8px','--ws-duration':'23s','--ws-delay':'0s'} as CSSProperties}} /><span key={24} className="ws-living-star" style={{'--ws-x':'26%','--ws-y':'76%','--ws-size':'2.2px','--ws-duration':'9s','--ws-delay':'-6s'} as CSSProperties}} /><span key={25} className="ws-living-star" style={{'--ws-x':'63%','--ws-y':'44%','--ws-size':'1px','--ws-duration':'11s','--ws-delay':'-10s'} as CSSProperties}} /><span key={26} className="ws-living-star" style={{'--ws-x':'3%','--ws-y':'12%','--ws-size':'1.2px','--ws-duration':'13s','--ws-delay':'0s'} as CSSProperties}} /><span key={27} className="ws-living-star" style={{'--ws-x':'40%','--ws-y':'73%','--ws-size':'1.5px','--ws-duration':'15s','--ws-delay':'-9s'} as CSSProperties}} /><span key={28} className="ws-living-star" style={{'--ws-x':'77%','--ws-y':'41%','--ws-size':'1.8px','--ws-duration':'17s','--ws-delay':'-9s'} as CSSProperties}} /><span key={29} className="ws-living-star" style={{'--ws-x':'17%','--ws-y':'9%','--ws-size':'2.2px','--ws-duration':'19s','--ws-delay':'-13s'} as CSSProperties}} /><span key={30} className="ws-living-star" style={{'--ws-x':'54%','--ws-y':'70%','--ws-size':'1px','--ws-duration':'21s','--ws-delay':'0s'} as CSSProperties}} /><span key={31} className="ws-living-star" style={{'--ws-x':'91%','--ws-y':'38%','--ws-size':'1.2px','--ws-duration':'23s','--ws-delay':'-10s'} as CSSProperties}} /><span key={32} className="ws-living-star" style={{'--ws-x':'31%','--ws-y':'6%','--ws-size':'1.5px','--ws-duration':'9s','--ws-delay':'-8s'} as CSSProperties}} /><span key={33} className="ws-living-star" style={{'--ws-x':'68%','--ws-y':'67%','--ws-size':'1.8px','--ws-duration':'11s','--ws-delay':'0s'} as CSSProperties}} /><span key={34} className="ws-living-star" style={{'--ws-x':'8%','--ws-y':'35%','--ws-size':'2.2px','--ws-duration':'13s','--ws-delay':'-4s'} as CSSProperties}} /><span key={35} className="ws-living-star" style={{'--ws-x':'45%','--ws-y':'3%','--ws-size':'1px','--ws-duration':'15s','--ws-delay':'-5s'} as CSSProperties}} /><span key={36} className="ws-living-star" style={{'--ws-x':'82%','--ws-y':'64%','--ws-size':'1.2px','--ws-duration':'17s','--ws-delay':'-14s'} as CSSProperties}} /><span key={37} className="ws-living-star" style={{'--ws-x':'22%','--ws-y':'32%','--ws-size':'1.5px','--ws-duration':'19s','--ws-delay':'-12s'} as CSSProperties}} /><span key={38} className="ws-living-star" style={{'--ws-x':'59%','--ws-y':'0%','--ws-size':'1.8px','--ws-duration':'21s','--ws-delay':'-14s'} as CSSProperties}} /><span key={39} className="ws-living-star" style={{'--ws-x':'96%','--ws-y':'61%','--ws-size':'2.2px','--ws-duration':'23s','--ws-delay':'-20s'} as CSSProperties}} /><span key={40} className="ws-living-star" style={{'--ws-x':'36%','--ws-y':'29%','--ws-size':'1px','--ws-duration':'9s','--ws-delay':'-1s'} as CSSProperties}} /><span key={41} className="ws-living-star" style={{'--ws-x':'73%','--ws-y':'90%','--ws-size':'1.2px','--ws-duration':'11s','--ws-delay':'-1s'} as CSSProperties}} /><span key={42} className="ws-living-star" style={{'--ws-x':'13%','--ws-y':'58%','--ws-size':'1.5px','--ws-duration':'13s','--ws-delay':'-8s'} as CSSProperties}} /><span key={43} className="ws-living-star" style={{'--ws-x':'50%','--ws-y':'26%','--ws-size':'1.8px','--ws-duration':'15s','--ws-delay':'-1s'} as CSSProperties}} /><span key={44} className="ws-living-star" style={{'--ws-x':'87%','--ws-y':'87%','--ws-size':'2.2px','--ws-duration':'17s','--ws-delay':'-2s'} as CSSProperties}} /><span key={45} className="ws-living-star" style={{'--ws-x':'27%','--ws-y':'55%','--ws-size':'1px','--ws-duration':'19s','--ws-delay':'-11s'} as CSSProperties}} /><span key={46} className="ws-living-star" style={{'--ws-x':'64%','--ws-y':'23%','--ws-size':'1.2px','--ws-duration':'21s','--ws-delay':'-7s'} as CSSProperties}} /><span key={47} className="ws-living-star" style={{'--ws-x':'4%','--ws-y':'84%','--ws-size':'1.5px','--ws-duration':'23s','--ws-delay':'-7s'} as CSSProperties}} /><span key={48} className="ws-living-star" style={{'--ws-x':'41%','--ws-y':'52%','--ws-size':'1.8px','--ws-duration':'9s','--ws-delay':'-3s'} as CSSProperties}} /><span key={49} className="ws-living-star" style={{'--ws-x':'78%','--ws-y':'20%','--ws-size':'2.2px','--ws-duration':'11s','--ws-delay':'-2s'} as CSSProperties}} /><span key={50} className="ws-living-star" style={{'--ws-x':'18%','--ws-y':'81%','--ws-size':'1px','--ws-duration':'13s','--ws-delay':'-12s'} as CSSProperties}} /><span key={51} className="ws-living-star" style={{'--ws-x':'55%','--ws-y':'49%','--ws-size':'1.2px','--ws-duration':'15s','--ws-delay':'-12s'} as CSSProperties}} /><span key={52} className="ws-living-star" style={{'--ws-x':'92%','--ws-y':'17%','--ws-size':'1.5px','--ws-duration':'17s','--ws-delay':'-7s'} as CSSProperties}} /><span key={53} className="ws-living-star" style={{'--ws-x':'32%','--ws-y':'78%','--ws-size':'1.8px','--ws-duration':'19s','--ws-delay':'-10s'} as CSSProperties}} /><span key={54} className="ws-living-star" style={{'--ws-x':'69%','--ws-y':'46%','--ws-size':'2.2px','--ws-duration':'21s','--ws-delay':'0s'} as CSSProperties}} /><span key={55} className="ws-living-star" style={{'--ws-x':'9%','--ws-y':'14%','--ws-size':'1px','--ws-duration':'23s','--ws-delay':'-17s'} as CSSProperties}} /></span><span className="ws-cosmic-vignette" /></div>
      <Router profileId={session.user.id} />
    </div>
    <WorkSocialAiAssistant profileId={session.user.id} />
    <MovableAiLauncher />
    <style>{`.work-social-router-shell > header{flex:0 0 auto;position:sticky!important;top:0!important}.work-social-router-shell > div.work-social-page-content{flex:1 1 auto;min-height:0!important;min-width:0!important;width:100%!important;max-width:100%!important;overflow-y:auto!important;overflow-x:hidden!important;overscroll-behavior:none;touch-action:pan-y;scroll-behavior:auto;-webkit-overflow-scrolling:touch}.work-social-router-shell > nav{flex:0 0 auto}.work-social-router-shell > div.work-social-inbox-content{overflow-y:hidden!important;overflow-x:hidden!important;min-height:0!important;padding-bottom:0!important}.work-social-router-shell > div.work-social-inbox-content main.premium-chat-page{height:100%!important;min-height:0!important}@media(max-width:767px){.work-social-router-shell > div.work-social-inbox-content{padding-bottom:calc(92px + env(safe-area-inset-bottom))!important}.work-social-router-shell > div.work-social-inbox-content main.premium-chat-page{height:100%!important}}`}</style>
  </main>;
}
