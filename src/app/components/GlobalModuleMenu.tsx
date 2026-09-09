import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { signOut } from '../../features/auth/api/signOut';
import { accountModePath, getLastAccountMode, setLastAccountMode, type AccountMode } from '../../features/account/accountModePersistence';

interface GlobalModuleMenuProps { onNavigate: (path: string) => void; }
type ModuleId = 'social' | 'work' | 'expense' | 'diary';
type AvailableAccount = { mode: AccountMode; title: string; description: string; icon: string };

const modules: Array<{ id: ModuleId; label: string; path: string }> = [
  { id: 'social', label: 'Social Media', path: '/' },
  { id: 'work', label: 'Work', path: '/work' },
  { id: 'expense', label: 'Expense Manager', path: '/expense-manager' },
  { id: 'diary', label: 'Personal Diary', path: '/work/diary' },
];

function activeModule(pathname: string): ModuleId {
  if (pathname === '/expense-manager' || pathname.startsWith('/expense-manager/')) return 'expense';
  if (pathname === '/work/diary') return 'diary';
  if (pathname === '/work' || pathname.startsWith('/work/')) return 'work';
  return 'social';
}

function modeFromPath(pathname: string): AccountMode | null {
  if (pathname === '/work/contractor' || pathname.startsWith('/work/contractor/')) return 'contractor';
  if (pathname === '/work' || pathname.startsWith('/work/')) return null;
  return 'social';
}

export function GlobalModuleMenu({ onNavigate }: GlobalModuleMenuProps) {
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accounts, setAccounts] = useState<AvailableAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const currentModule = activeModule(window.location.pathname);

  const closeMenu = () => { setOpen(false); setAccountOpen(false); };

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data }) => { if (active) setProfileId(data.user?.id ?? null); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!open || !profileId) return;
    let active = true;
    setAccountsLoading(true);
    const load = async () => {
      const [workerResult, contractorResult] = await Promise.all([
        supabase.from('worker_profiles').select('worker_type').eq('profile_id', profileId).maybeSingle<{ worker_type: 'salary_person' | 'contract' }>(),
        supabase.from('contractor_accounts').select('profile_id').eq('profile_id', profileId).maybeSingle<{ profile_id: string }>(),
      ]);
      if (!active) return;
      const next: AvailableAccount[] = [{ mode: 'social', title: 'Social Media', description: 'Your Work Social community', icon: '◎' }];
      if (workerResult.data?.worker_type === 'salary_person') next.push({ mode: 'salary_person', title: 'Salary Person', description: 'Salary, attendance & finance workspace', icon: '▣' });
      else if (workerResult.data?.worker_type === 'contract') next.push({ mode: 'contract', title: 'Contract Worker', description: 'Work-per-job & contract workspace', icon: '◇' });
      if (contractorResult.data) next.push({ mode: 'contractor', title: 'Contractor', description: 'Contractor teams & work management', icon: '♛' });
      setAccounts(next);
      setAccountsLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [open, profileId]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) closeMenu(); };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const selectModule = (path: string) => { closeMenu(); onNavigate(path); };
  const selectAccount = (mode: AccountMode) => {
    if (!profileId || signingOut) return;
    setLastAccountMode(profileId, mode);
    closeMenu();
    onNavigate(accountModePath(mode));
  };
  const currentAccountMode = profileId ? (modeFromPath(window.location.pathname) ?? getLastAccountMode(profileId) ?? 'social') : 'social';
  const handleLogout = async () => {
    if (signingOut) return;
    if (profileId) setLastAccountMode(profileId, currentAccountMode);
    setSigningOut(true);
    const { error } = await signOut();
    if (error) setSigningOut(false);
  };

  return (
    <div ref={rootRef} className="ws-main-header__menu-wrap">
      <style>{`
        .ws-main-header__menu-wrap{position:relative;z-index:1002;flex:0 0 auto}
        .ws-main-header__menu{position:relative;min-width:40px;min-height:40px;width:40px;display:inline-flex;align-items:center;justify-content:center;padding:0;border:1px solid rgba(255,255,255,.2);border-radius:13px;color:#fff;background:linear-gradient(145deg,rgba(109,93,252,.9),rgba(37,99,235,.92) 54%,rgba(34,193,220,.88));box-shadow:inset 0 1px 1px rgba(255,255,255,.2),0 8px 18px rgba(79,70,229,.2);cursor:pointer}
        .ws-main-header__menu-icon{width:19px;height:19px;display:block}
        .ws-main-header__menu-panel{position:absolute;top:calc(100% + 9px);right:0;width:min(310px,calc(100vw - 20px));padding:8px;box-sizing:border-box;border:1px solid rgba(255,255,255,.16);border-radius:18px;background:linear-gradient(145deg,rgba(15,23,42,.99),rgba(30,41,59,.98) 55%,rgba(49,46,129,.97));box-shadow:0 18px 42px rgba(15,23,42,.3),inset 0 1px 0 rgba(255,255,255,.11);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)}
        .ws-main-header__menu-heading{display:flex;align-items:center;gap:10px;padding:7px 8px 9px;color:#fff}
        .ws-main-header__menu-heading-copy{min-width:0;flex:1}
        .ws-main-header__menu-title{display:block;font-size:13px;line-height:1.15;font-weight:900}
        .ws-main-header__menu-subtitle{display:block;margin-top:3px;font-size:9px;line-height:1.2;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(186,230,253,.75)}
        .ws-header-actions{display:flex;align-items:center;gap:6px;flex:0 0 auto}
        .ws-header-icon-action{width:34px;height:34px;display:grid;place-items:center;padding:0;border:1px solid rgba(125,211,252,.2);border-radius:10px;background:linear-gradient(145deg,rgba(59,130,246,.2),rgba(124,58,237,.18));color:#dbeafe;box-shadow:inset 0 1px 0 rgba(255,255,255,.1),0 5px 12px rgba(15,23,42,.18);cursor:pointer;transition:transform .16s ease,filter .16s ease,border-color .16s ease}
        .ws-header-icon-action:hover{transform:translateY(-1px);filter:brightness(1.1);border-color:rgba(125,211,252,.38)}
        .ws-header-icon-action:focus-visible{outline:2px solid rgba(125,211,252,.9);outline-offset:2px}
        .ws-header-icon-action.account{font-size:19px}
        .ws-header-icon-action.logout{color:#f87171;border-color:rgba(248,113,113,.25);background:linear-gradient(145deg,rgba(127,29,29,.42),rgba(153,27,27,.22))}
        .ws-header-icon-action.logout:hover{color:#fecaca;border-color:rgba(248,113,113,.48);background:linear-gradient(145deg,rgba(185,28,28,.55),rgba(153,27,27,.3))}
        .ws-main-header__menu-divider{height:1px;margin:0 2px 6px;background:rgba(255,255,255,.1)}
        .ws-main-header__menu-item{width:100%;min-height:42px;display:flex;align-items:center;gap:10px;padding:0 10px;border:1px solid transparent;border-radius:12px;background:transparent;color:#e2e8f0;text-align:left;font:inherit;cursor:pointer}
        .ws-main-header__menu-item:hover{background:rgba(255,255,255,.075);border-color:rgba(255,255,255,.08)}
        .ws-main-header__menu-item[data-active="true"]{background:linear-gradient(135deg,rgba(59,130,246,.28),rgba(124,58,237,.22));border-color:rgba(125,211,252,.2);color:#fff}
        .ws-main-header__menu-dot{width:8px;height:8px;flex:0 0 8px;border-radius:50%;background:rgba(148,163,184,.55);box-shadow:0 0 0 4px rgba(148,163,184,.06)}
        .ws-main-header__menu-item[data-active="true"] .ws-main-header__menu-dot{background:#7dd3fc;box-shadow:0 0 0 4px rgba(125,211,252,.1),0 0 12px rgba(125,211,252,.35)}
        .ws-main-header__menu-label{flex:1;font-size:12px;line-height:1.2;font-weight:850}
        .ws-main-header__menu-check{font-size:13px;font-weight:950;color:#7dd3fc}
        .ws-account-list{display:grid;gap:6px;margin-top:8px}
        .ws-account-option{width:100%;min-height:52px;display:flex;align-items:center;gap:9px;padding:7px 8px;border:1px solid rgba(255,255,255,.09);border-radius:12px;background:rgba(15,23,42,.32);color:#fff;text-align:left;cursor:pointer}
        .ws-account-option:hover{background:rgba(255,255,255,.08);border-color:rgba(125,211,252,.2)}
        .ws-account-option[data-current="true"]{border-color:rgba(125,211,252,.3);background:linear-gradient(135deg,rgba(59,130,246,.22),rgba(124,58,237,.16))}
        .ws-account-icon{width:31px;height:31px;display:grid;place-items:center;flex:0 0 31px;border-radius:10px;background:linear-gradient(145deg,rgba(125,211,252,.22),rgba(129,140,248,.2));border:1px solid rgba(255,255,255,.12);font-size:14px}
        .ws-account-copy{min-width:0;flex:1}.ws-account-name{display:block;font-size:11px;font-weight:900}.ws-account-description{display:block;margin-top:2px;color:rgba(226,232,240,.62);font-size:8.5px;line-height:1.25}.ws-account-current{font-size:9px;font-weight:950;color:#7dd3fc}
        .ws-main-header__menu-loading{padding:9px 8px;color:rgba(226,232,240,.62);font-size:9px}
        .work-social-router-shell:has(nav[aria-label="Worker navigation"]) .ws-main-header__menu{min-height:38px;height:38px;width:38px;border-radius:11px;color:#334155;background:linear-gradient(145deg,#fff 0%,#f5f8fb 58%,#edf4f5 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,1),0 5px 10px rgba(15,23,42,.055)}
        .work-social-router-shell:has(nav[aria-label="Worker navigation"]) .ws-main-header__menu-panel{background:linear-gradient(145deg,rgba(255,255,255,.995),rgba(247,250,253,.99) 58%,rgba(239,248,249,.985));border-color:rgba(71,85,105,.14);box-shadow:0 18px 38px rgba(15,23,42,.14),inset 0 1px 0 #fff;color:#172033}
        .work-social-router-shell:has(nav[aria-label="Worker navigation"]) .ws-main-header__menu-heading{color:#172033}.work-social-router-shell:has(nav[aria-label="Worker navigation"]) .ws-main-header__menu-subtitle{color:#527083}.work-social-router-shell:has(nav[aria-label="Worker navigation"]) .ws-main-header__menu-divider{background:rgba(71,85,105,.1)}.work-social-router-shell:has(nav[aria-label="Worker navigation"]) .ws-main-header__menu-item{color:#334155}.work-social-router-shell:has(nav[aria-label="Worker navigation"]) .ws-main-header__menu-item:hover{background:rgba(59,130,246,.045);border-color:rgba(59,130,246,.1)}.work-social-router-shell:has(nav[aria-label="Worker navigation"]) .ws-main-header__menu-item[data-active="true"]{background:linear-gradient(135deg,rgba(59,130,246,.09),rgba(20,184,166,.06));border-color:rgba(59,130,246,.14);color:#172033}.work-social-router-shell:has(nav[aria-label="Worker navigation"]) .ws-header-icon-action{color:#334155;background:linear-gradient(145deg,#fff,#f1f5f9);border-color:rgba(71,85,105,.12);box-shadow:inset 0 1px 0 #fff,0 4px 10px rgba(15,23,42,.08)}.work-social-router-shell:has(nav[aria-label="Worker navigation"]) .ws-header-icon-action.logout{color:#b91c1c;background:linear-gradient(145deg,#fff1f2,#fff);border-color:rgba(220,38,38,.16)}
        @media (max-width:430px){.ws-main-header__menu{min-width:36px;min-height:36px;width:36px}.ws-header-icon-action{width:32px;height:32px}.ws-main-header__menu-panel{width:min(300px,calc(100vw - 16px));right:-1px}}
      `}</style>
      <button ref={menuButtonRef} type="button" className="ws-main-header__menu" aria-label="Open Work Social menu" aria-expanded={open} aria-haspopup="menu" aria-controls="work-social-global-module-menu" onClick={() => setOpen((value) => !value)}>
        <svg className="ws-main-header__menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></svg>
      </button>
      {open && <div id="work-social-global-module-menu" className="ws-main-header__menu-panel" role="menu" aria-label="Work Social modules">
        <div className="ws-main-header__menu-heading">
          <div className="ws-main-header__menu-heading-copy"><span className="ws-main-header__menu-title">Work Social</span><span className="ws-main-header__menu-subtitle">Switch workspace</span></div>
          <div className="ws-header-actions">
            <button type="button" className="ws-header-icon-action account" aria-label="Switch account" title="Switch account" aria-expanded={accountOpen} onClick={() => setAccountOpen((value) => !value)}>⇄</button>
            <button type="button" className="ws-header-icon-action logout" aria-label="Logout" title="Logout" disabled={signingOut} onClick={() => void handleLogout()}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M21 19V5a2 2 0 0 0-2-2h-6"/></svg>
            </button>
          </div>
        </div>
        <div className="ws-main-header__menu-divider" />
        {modules.map((module) => { const active = module.id === currentModule; return <button key={module.id} type="button" role="menuitem" className="ws-main-header__menu-item" data-active={active} aria-current={active ? 'page' : undefined} onClick={() => selectModule(module.path)}><span className="ws-main-header__menu-dot" aria-hidden="true"/><span className="ws-main-header__menu-label">{module.label}</span>{active && <span className="ws-main-header__menu-check" aria-hidden="true">✓</span>}</button>; })}
        {accountOpen && <div className="ws-account-list" aria-label="Available accounts">
          {accountsLoading && <div className="ws-main-header__menu-loading">Loading your available accounts…</div>}
          {!accountsLoading && accounts.map((account) => { const current = account.mode === currentAccountMode; return <button key={account.mode} type="button" className="ws-account-option" data-current={current} role="menuitem" onClick={() => selectAccount(account.mode)}><span className="ws-account-icon" aria-hidden="true">{account.icon}</span><span className="ws-account-copy"><span className="ws-account-name">{account.title}</span><span className="ws-account-description">{account.description}</span></span>{current && <span className="ws-account-current" aria-label="Current account">✓</span>}</button>; })}
        </div>}
      </div>}
    </div>
  );
}
