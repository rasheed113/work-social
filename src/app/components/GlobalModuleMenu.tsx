import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { signOut } from '../../features/auth/api/signOut';
import { accountModePath, getLastAccountMode, setLastAccountMode, type AccountMode } from '../../features/account/accountModePersistence';
import { getRegisteredAccounts, registerAccount, type RegisteredAccount } from '../../features/account/accountSessionRegistry';

interface GlobalModuleMenuProps { onNavigate: (path: string) => void; }
type ModuleId = 'social' | 'work' | 'expense' | 'diary';
const modules: Array<{ id: ModuleId; label: string; path: string }> = [
  { id: 'social', label: 'Social Media', path: '/' },
  { id: 'work', label: 'Work', path: '/work' },
  { id: 'expense', label: 'Expense Manager', path: '/expense-manager' },
  { id: 'diary', label: 'Personal Diary', path: '/work/diary' },
];
function activeModule(pathname: string): ModuleId { if (pathname.startsWith('/expense-manager')) return 'expense'; if (pathname === '/work/diary') return 'diary'; if (pathname.startsWith('/work')) return 'work'; return 'social'; }
function modeFromPath(pathname: string): AccountMode | null { if (pathname.startsWith('/work/contractor')) return 'contractor'; if (pathname.startsWith('/work')) return null; return 'social'; }
function nameOf(account: RegisteredAccount) { return account.displayName.trim() || account.email.split('@')[0] || 'Work Social account'; }

export function GlobalModuleMenu({ onNavigate }: GlobalModuleMenuProps) {
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accounts, setAccounts] = useState<RegisteredAccount[]>([]);
  const [switching, setSwitching] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const currentModule = activeModule(window.location.pathname);

  const syncAccount = async () => {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session?.user) return;
    const id = session.user.id;
    setProfileId(id);
    const { data: profile } = await supabase.from('profiles').select('display_name,avatar_url').eq('id', id).maybeSingle<{ display_name: string | null; avatar_url: string | null }>();
    registerAccount({ id, email: session.user.email ?? '', displayName: profile?.display_name ?? session.user.user_metadata?.display_name ?? session.user.email?.split('@')[0] ?? 'Work Social account', avatarUrl: profile?.avatar_url ?? null, session });
    setAccounts(getRegisteredAccounts());
  };

  useEffect(() => { void syncAccount(); }, []);
  useEffect(() => { if (open) void syncAccount(); }, [open]);
  useEffect(() => {
    if (!open && !accountOpen) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) { setOpen(false); setAccountOpen(false); }
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open, accountOpen]);

  const closeAll = () => { setOpen(false); setAccountOpen(false); };
  const openAccountSwitcher = () => { setOpen(false); setAccountOpen(true); setAccounts(getRegisteredAccounts()); };

  const selectAccount = async (account: RegisteredAccount) => {
    if (switching) return;
    if (account.id === profileId) { closeAll(); return; }
    setSwitching(true);
    const { error } = await supabase.auth.setSession({ access_token: account.session.access_token, refresh_token: account.session.refresh_token });
    if (error) { setSwitching(false); return; }
    const fresh = (await supabase.auth.getSession()).data.session;
    registerAccount({ ...account, session: fresh ?? account.session });
    setProfileId(account.id);
    const mode = getLastAccountMode(account.id) ?? 'social';
    setSwitching(false);
    closeAll();
    onNavigate(accountModePath(mode));
  };

  const currentMode = profileId ? (modeFromPath(window.location.pathname) ?? getLastAccountMode(profileId) ?? 'social') : 'social';
  const logout = async () => {
    if (signingOut) return;
    if (profileId) setLastAccountMode(profileId, currentMode);
    setSigningOut(true);
    const { error } = await signOut();
    if (error) setSigningOut(false);
  };

  return <div ref={rootRef} className="ws-global-menu-wrap">
    <style>{`.ws-global-menu-wrap{position:relative;z-index:1002;flex:0 0 auto}.ws-menu-trigger{width:40px;height:40px;display:grid;place-items:center;padding:0;border:1px solid rgba(255,255,255,.2);border-radius:13px;color:#fff;background:linear-gradient(145deg,rgba(109,93,252,.9),rgba(37,99,235,.92) 54%,rgba(34,193,220,.88));box-shadow:inset 0 1px 1px rgba(255,255,255,.2),0 8px 18px rgba(79,70,229,.2);cursor:pointer}.ws-menu-trigger svg{width:19px;height:19px}.ws-workspace-panel,.ws-account-panel{position:absolute;border:1px solid rgba(255,255,255,.15);border-radius:20px;background:linear-gradient(145deg,rgba(10,18,34,.99),rgba(30,41,59,.98) 55%,rgba(49,46,129,.97));box-shadow:0 24px 55px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.12);backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px)}.ws-workspace-panel{top:49px;right:0;width:min(320px,calc(100vw - 16px));padding:10px}.ws-account-panel{position:fixed;top:78px;right:18px;width:min(360px,calc(100vw - 24px));padding:12px;z-index:1100}.ws-head{display:flex;align-items:center;gap:10px;padding:7px 8px 10px;color:#fff}.ws-head-copy{flex:1;min-width:0}.ws-title{display:block;font-size:13px;font-weight:950}.ws-sub{display:block;margin-top:3px;font-size:9px;font-weight:750;letter-spacing:.08em;text-transform:uppercase;color:rgba(186,230,253,.7)}.ws-actions{display:flex;gap:6px}.ws-icon{width:34px;height:34px;display:grid;place-items:center;border:1px solid rgba(125,211,252,.2);border-radius:10px;background:rgba(59,130,246,.18);color:#dbeafe;font-size:19px;cursor:pointer}.ws-icon.logout{color:#f87171;background:rgba(127,29,29,.35);border-color:rgba(248,113,113,.25)}.ws-divider{height:1px;background:rgba(255,255,255,.1);margin:0 2px 6px}.ws-module{width:100%;min-height:42px;display:flex;align-items:center;gap:10px;padding:0 10px;border:1px solid transparent;border-radius:12px;background:transparent;color:#e2e8f0;text-align:left;cursor:pointer}.ws-module:hover{background:rgba(255,255,255,.07)}.ws-module[data-active=true]{background:rgba(59,130,246,.22);border-color:rgba(125,211,252,.18);color:#fff}.ws-dot{width:8px;height:8px;border-radius:50%;background:rgba(148,163,184,.55)}.ws-module[data-active=true] .ws-dot{background:#7dd3fc;box-shadow:0 0 12px rgba(125,211,252,.35)}.ws-label{flex:1;font-size:12px;font-weight:850}.ws-check{color:#7dd3fc;font-weight:950}.ws-tree{display:grid;gap:8px}.ws-account{width:100%;display:flex;align-items:center;gap:10px;padding:10px;border:1px solid rgba(255,255,255,.1);border-radius:15px;background:rgba(15,23,42,.4);color:#fff;text-align:left;cursor:pointer}.ws-account:hover{border-color:rgba(125,211,252,.3);background:rgba(59,130,246,.16);transform:translateY(-1px)}.ws-avatar{width:42px;height:42px;display:grid;place-items:center;flex:0 0 42px;border-radius:13px;overflow:hidden;background:linear-gradient(145deg,rgba(125,211,252,.28),rgba(129,140,248,.24));font-weight:950}.ws-avatar img{width:100%;height:100%;object-fit:cover}.ws-copy{min-width:0;flex:1}.ws-name{display:block;font-size:12px;font-weight:950}.ws-email{display:block;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:rgba(226,232,240,.62);font-size:9px}.ws-arrow{color:#7dd3fc;font-size:19px}.ws-pill{font-size:8px;font-weight:950;letter-spacing:.08em;text-transform:uppercase;color:#7dd3fc}.ws-close{border:0;background:transparent;color:#7dd3fc;font-size:18px;font-weight:900;cursor:pointer}.ws-switching{text-align:center;padding:16px 8px;color:rgba(226,232,240,.7);font-size:9px}@media(max-width:430px){.ws-menu-trigger{width:36px;height:36px}.ws-icon{width:32px;height:32px}.ws-workspace-panel{width:min(320px,calc(100vw - 12px))}.ws-account-panel{top:66px;right:6px;width:min(320px,calc(100vw - 12px))}}`}</style>
    <button type="button" className="ws-menu-trigger" aria-label="Open Work Social menu" aria-expanded={open} onClick={() => setOpen(value => !value)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></svg></button>
    {open && <div className="ws-workspace-panel" role="menu"><div className="ws-head"><div className="ws-head-copy"><span className="ws-title">Work Social</span><span className="ws-sub">Switch workspace</span></div><div className="ws-actions"><button type="button" className="ws-icon" aria-label="Switch account" title="Switch account" onClick={openAccountSwitcher}>⇄</button><button type="button" className="ws-icon logout" aria-label="Logout" title="Logout" disabled={signingOut} onClick={() => void logout()}>⎋</button></div></div><div className="ws-divider"/>{modules.map(module => <button key={module.id} type="button" className="ws-module" data-active={currentModule === module.id} onClick={() => { closeAll(); onNavigate(module.path); }}><span className="ws-dot"/><span className="ws-label">{module.label}</span>{currentModule === module.id && <span className="ws-check">✓</span>}</button>)}</div>}
    {accountOpen && <section className="ws-account-panel" aria-label="Switch Account"><div className="ws-head"><div className="ws-head-copy"><span className="ws-title">Switch Account</span><span className="ws-sub">Select a signed-in account</span></div><button type="button" className="ws-close" aria-label="Close account switcher" onClick={closeAll}>×</button></div>{switching ? <div className="ws-switching">Switching account…</div> : accounts.length === 0 ? <div className="ws-switching">No other signed-in account is registered on this browser yet.</div> : <div className="ws-tree">{accounts.map(account => <button key={account.id} type="button" className="ws-account" onClick={() => void selectAccount(account)} disabled={switching}><span className="ws-avatar">{account.avatarUrl ? <img src={account.avatarUrl} alt="" /> : nameOf(account).charAt(0).toUpperCase()}</span><span className="ws-copy"><span className="ws-name">{nameOf(account)}</span><span className="ws-email">{account.email}</span></span>{account.id === profileId ? <span className="ws-pill">Current</span> : <span className="ws-arrow">›</span>}</button>)}</div>}</section>}
  </div>;
}
