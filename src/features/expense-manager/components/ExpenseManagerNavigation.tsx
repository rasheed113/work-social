import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

export type ExpenseManagerSection = 'overview' | 'transactions' | 'accounts' | 'categories' | 'budgets' | 'reports';

const sections: Array<{ id: ExpenseManagerSection; label: string; path: string; icon: string }> = [
  { id: 'overview', label: 'Overview', path: '/expense-manager', icon: '⌂' },
  { id: 'transactions', label: 'Transactions', path: '/expense-manager/transactions', icon: '↕' },
  { id: 'accounts', label: 'Accounts', path: '/expense-manager/accounts', icon: '◫' },
  { id: 'categories', label: 'Categories', path: '/expense-manager/categories', icon: '◈' },
  { id: 'budgets', label: 'Budgets', path: '/expense-manager/budgets', icon: '◎' },
  { id: 'reports', label: 'Reports', path: '/expense-manager/reports', icon: '▥' },
];

function sectionFromPath(pathname: string): ExpenseManagerSection {
  const match = sections.find((section) => section.path === pathname);
  return match?.id ?? 'overview';
}

interface ExpenseManagerNavigationProps {
  pathname: string;
  onNavigate: (path: string) => void;
}

export function ExpenseManagerNavigation({ pathname, onNavigate }: ExpenseManagerNavigationProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const activeSection = sectionFromPath(pathname);
  const mobilePrimary = sections.slice(0, 2);
  const mobileAccount = sections[2];
  const mobileMore = sections.slice(3);

  useEffect(() => {
    if (!moreOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!moreRef.current?.contains(event.target as Node)) setMoreOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [moreOpen]);

  const navigate = (path: string) => {
    setMoreOpen(false);
    onNavigate(path);
  };

  const handleMoreKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setMoreOpen(false);
      window.requestAnimationFrame(() => moreButtonRef.current?.focus());
    }
  };

  return (
    <nav className="expense-manager-navigation" aria-label="Expense Manager navigation">
      <style>{`
        .expense-manager-navigation{position:sticky;top:0;z-index:40;width:100%;box-sizing:border-box;padding:0 10px 7px}
        .expense-manager-navigation__shell{width:100%;box-sizing:border-box;border:1px solid rgba(148,163,184,.16);border-radius:12px;background:rgba(255,255,255,.96);box-shadow:0 4px 12px rgba(15,23,42,.06),inset 0 1px 0 rgba(255,255,255,.9);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
        .expense-manager-navigation__desktop{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:3px;padding:3px}
        .expense-manager-navigation__item{min-width:0;min-height:40px;display:flex;align-items:center;justify-content:center;gap:5px;padding:0 7px;border:1px solid transparent;border-radius:9px;background:transparent;color:#475569;font:inherit;font-size:12px;font-weight:800;cursor:pointer;touch-action:manipulation;transition:background .16s ease,border-color .16s ease,color .16s ease,transform .16s ease,box-shadow .16s ease}
        .expense-manager-navigation__item:hover{background:rgba(59,130,246,.055);border-color:rgba(59,130,246,.1)}
        .expense-manager-navigation__item:focus-visible,.expense-manager-navigation__more-button:focus-visible,.expense-manager-navigation__quick-add:focus-visible{outline:2px solid rgba(37,99,235,.55);outline-offset:2px}
        .expense-manager-navigation__item[data-active="true"]{background:rgba(37,99,235,.08);border-color:rgba(37,99,235,.13);color:#172033}
        .expense-manager-navigation__icon{font-size:14px;line-height:1;font-weight:900;flex:0 0 auto}
        .expense-manager-navigation__item > span:last-child,.expense-manager-navigation__more-button > span:last-child{min-width:0;white-space:nowrap;word-break:normal;overflow-wrap:normal}
        .expense-manager-navigation__mobile{display:none}
        .expense-manager-navigation__mobile-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) 46px minmax(0,1fr) minmax(0,1fr);align-items:stretch;gap:2px;padding:3px}
        .expense-manager-navigation__more-wrap{position:relative;min-width:0}
        .expense-manager-navigation__more-button{width:100%;min-width:0;min-height:40px;display:flex;align-items:center;justify-content:center;gap:3px;padding:0 2px;border:1px solid transparent;border-radius:9px;background:transparent;color:#475569;font:inherit;font-size:10px;font-weight:800;cursor:pointer;touch-action:manipulation}
        .expense-manager-navigation__more-button[data-active="true"]{background:rgba(37,99,235,.08);border-color:rgba(37,99,235,.13);color:#172033}
        .expense-manager-navigation__more-panel{position:absolute;right:0;bottom:calc(100% + 8px);width:min(230px,calc(100vw - 20px));max-height:min(65dvh,340px);overflow:auto;padding:6px;border:1px solid rgba(148,163,184,.2);border-radius:12px;background:rgba(255,255,255,.98);box-shadow:0 12px 26px rgba(15,23,42,.13);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}
        .expense-manager-navigation__more-item{width:100%;min-height:40px;display:flex;align-items:center;gap:8px;padding:0 9px;border:1px solid transparent;border-radius:9px;background:transparent;color:#334155;text-align:left;font:inherit;font-size:12px;font-weight:800;cursor:pointer;touch-action:manipulation}
        .expense-manager-navigation__more-item:hover{background:rgba(59,130,246,.06);border-color:rgba(59,130,246,.1)}
        .expense-manager-navigation__more-item[data-active="true"]{background:rgba(37,99,235,.09);color:#172033}
        .expense-manager-navigation__quick-add{width:46px;min-width:46px;min-height:46px;align-self:center;border:1px solid rgba(37,99,235,.2);border-radius:999px;background:linear-gradient(145deg,#2563eb,#4f46e5);color:#fff;font:inherit;font-size:20px;font-weight:900;box-shadow:0 6px 14px rgba(37,99,235,.2);cursor:pointer;touch-action:manipulation}
        @media(max-width:767px){
          .expense-manager-navigation{position:fixed;left:0;right:0;bottom:0;top:auto;z-index:1000;padding:5px 7px max(5px,env(safe-area-inset-bottom));background:transparent;pointer-events:none}
          .expense-manager-navigation__shell{max-width:520px;margin:0 auto;pointer-events:auto;border:1px solid rgba(148,163,184,.24);border-radius:18px;background:linear-gradient(180deg,rgba(255,255,255,.98),rgba(241,245,249,.97));box-shadow:0 10px 28px rgba(15,23,42,.16),0 2px 6px rgba(15,23,42,.08),inset 0 1px 0 rgba(255,255,255,.98);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}
          .expense-manager-navigation__desktop{display:none}.expense-manager-navigation__mobile{display:block}
          .expense-manager-navigation__mobile-grid{grid-template-columns:repeat(5,minmax(0,1fr));gap:3px;padding:4px;min-height:52px}
          .expense-manager-navigation__item,.expense-manager-navigation__more-button{position:relative;min-height:44px;height:44px;flex-direction:column;gap:2px;padding:3px 1px;font-size:8.5px;line-height:1;font-weight:850;letter-spacing:-.01em;border:1px solid transparent;border-radius:12px;color:#64748b;text-shadow:0 1px 0 rgba(255,255,255,.9);transition:all .16s ease}
          .expense-manager-navigation__item[data-active="true"],.expense-manager-navigation__more-button[data-active="true"]{color:#1d4ed8;background:linear-gradient(180deg,rgba(239,246,255,.98),rgba(219,234,254,.9));border-color:rgba(59,130,246,.2);box-shadow:inset 0 1px 0 rgba(255,255,255,.95),0 2px 5px rgba(37,99,235,.1)}
          .expense-manager-navigation__item[data-active="true"]::after,.expense-manager-navigation__more-button[data-active="true"]::after{content:"";position:absolute;left:50%;bottom:2px;width:18px;height:2px;transform:translateX(-50%);border-radius:999px;background:#2563eb;box-shadow:0 1px 2px rgba(37,99,235,.3)}
          .expense-manager-navigation__item > span:last-child,.expense-manager-navigation__more-button > span:last-child{display:block;font-size:8.5px;line-height:1;letter-spacing:-.015em;text-shadow:0 1px 0 rgba(255,255,255,.95),0 1px 1px rgba(15,23,42,.12)}
          .expense-manager-navigation__icon{font-size:14px;line-height:1;font-weight:900;text-shadow:0 1px 1px rgba(15,23,42,.18)}
          .expense-manager-navigation__quick-add{width:40px;min-width:40px;height:40px;min-height:40px;align-self:center;border:1px solid rgba(255,255,255,.65);background:linear-gradient(145deg,#2563eb 0%,#4338ca 55%,#312e81 100%);font-size:19px;line-height:1;box-shadow:inset 0 1px 1px rgba(255,255,255,.42),inset 0 -2px 3px rgba(15,23,42,.22),0 4px 9px rgba(37,99,235,.28);text-shadow:0 2px 1px rgba(15,23,42,.25)}
          .expense-manager-navigation__quick-add:active,.expense-manager-navigation__item:active,.expense-manager-navigation__more-button:active{transform:translateY(1px)}
        }
        @media(max-width:340px){
          .expense-manager-navigation{padding-left:4px;padding-right:4px}
          .expense-manager-navigation__mobile-grid{min-height:50px;gap:2px;padding:3px}
          .expense-manager-navigation__item,.expense-manager-navigation__more-button{height:42px;min-height:42px;border-radius:10px;font-size:8px}
          .expense-manager-navigation__item > span:last-child,.expense-manager-navigation__more-button > span:last-child{font-size:8px}
          .expense-manager-navigation__icon{font-size:13px}
          .expense-manager-navigation__quick-add{width:38px;min-width:38px;height:38px;min-height:38px;font-size:18px}
        }
        @media(min-width:768px){.expense-manager-navigation__mobile-grid{display:none}}
      `}</style>
      <div className="expense-manager-navigation__shell">
        <div className="expense-manager-navigation__desktop">
          {sections.map((section) => {
            const active = section.id === activeSection;
            return <button key={section.id} type="button" className="expense-manager-navigation__item" data-active={active} aria-current={active ? 'page' : undefined} onClick={() => navigate(section.path)}><span className="expense-manager-navigation__icon" aria-hidden="true">{section.icon}</span><span>{section.label}</span></button>;
          })}
        </div>
        <div className="expense-manager-navigation__mobile">
          <div className="expense-manager-navigation__mobile-grid">
            {mobilePrimary.map((section) => {
              const active = section.id === activeSection;
              return <button key={section.id} type="button" className="expense-manager-navigation__item" data-active={active} aria-current={active ? 'page' : undefined} onClick={() => navigate(section.path)}><span className="expense-manager-navigation__icon" aria-hidden="true">{section.icon}</span><span>{section.label}</span></button>;
            })}
            <button type="button" className="expense-manager-navigation__quick-add" aria-label="Add transaction" onClick={() => navigate('/expense-manager/transactions?intent=add')}>+</button>
            {mobileAccount && (() => {
              const active = mobileAccount.id === activeSection;
              return <button key={mobileAccount.id} type="button" className="expense-manager-navigation__item" data-active={active} aria-current={active ? 'page' : undefined} onClick={() => navigate(mobileAccount.path)}><span className="expense-manager-navigation__icon" aria-hidden="true">{mobileAccount.icon}</span><span>{mobileAccount.label}</span></button>;
            })()}
            <div ref={moreRef} className="expense-manager-navigation__more-wrap" onKeyDown={handleMoreKeyDown}>
              <button ref={moreButtonRef} type="button" className="expense-manager-navigation__more-button" data-active={moreOpen || mobileMore.some((section) => section.id === activeSection)} aria-expanded={moreOpen} aria-haspopup="menu" aria-controls="expense-manager-more-menu" onClick={() => setMoreOpen((value) => !value)}><span className="expense-manager-navigation__icon" aria-hidden="true">⋯</span><span>More</span></button>
              {moreOpen && <div id="expense-manager-more-menu" className="expense-manager-navigation__more-panel" role="menu" aria-label="More Expense Manager sections">{mobileMore.map((section) => <button key={section.id} type="button" role="menuitem" className="expense-manager-navigation__more-item" data-active={section.id === activeSection} aria-current={section.id === activeSection ? 'page' : undefined} onClick={() => navigate(section.path)}><span className="expense-manager-navigation__icon" aria-hidden="true">{section.icon}</span><span>{section.label}</span></button>)}</div>}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
