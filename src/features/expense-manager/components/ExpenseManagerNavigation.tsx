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
  const mobilePrimary = sections.slice(0, 3);
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
        .expense-manager-navigation{position:sticky;top:0;z-index:40;width:100%;box-sizing:border-box;padding:0 10px 10px}
        .expense-manager-navigation__shell{width:100%;box-sizing:border-box;border:1px solid rgba(148,163,184,.16);border-radius:18px;background:linear-gradient(145deg,rgba(255,255,255,.96),rgba(248,250,252,.94));box-shadow:0 10px 26px rgba(15,23,42,.08),inset 0 1px 0 rgba(255,255,255,.9);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}
        .expense-manager-navigation__desktop{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:5px;padding:6px}
        .expense-manager-navigation__item{min-width:0;min-height:48px;display:flex;align-items:center;justify-content:center;gap:7px;padding:0 9px;border:1px solid transparent;border-radius:13px;background:transparent;color:#475569;font:inherit;font-size:12px;font-weight:850;cursor:pointer;touch-action:manipulation;transition:background .16s ease,border-color .16s ease,transform .16s ease,color .16s ease}
        .expense-manager-navigation__item:hover{background:rgba(59,130,246,.055);border-color:rgba(59,130,246,.1);transform:translateY(-1px)}
        .expense-manager-navigation__item:focus-visible,.expense-manager-navigation__more-button:focus-visible,.expense-manager-navigation__quick-add:focus-visible{outline:2px solid rgba(37,99,235,.55);outline-offset:2px}
        .expense-manager-navigation__item[data-active="true"]{background:linear-gradient(135deg,rgba(37,99,235,.12),rgba(20,184,166,.08));border-color:rgba(37,99,235,.16);color:#172033;box-shadow:inset 0 1px 0 rgba(255,255,255,.8)}
        .expense-manager-navigation__icon{font-size:16px;line-height:1;font-weight:900;flex:0 0 auto}
        .expense-manager-navigation__item > span:last-child,.expense-manager-navigation__more-button > span:last-child{white-space:nowrap;word-break:normal;overflow-wrap:normal}
        .expense-manager-navigation__mobile{display:none}
        .expense-manager-navigation__mobile-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px;padding:6px}
        .expense-manager-navigation__more-wrap{position:relative;min-width:0}
        .expense-manager-navigation__more-button{width:100%;min-height:48px;display:flex;align-items:center;justify-content:center;gap:5px;padding:0 5px;border:1px solid transparent;border-radius:13px;background:transparent;color:#475569;font:inherit;font-size:11px;font-weight:850;cursor:pointer;touch-action:manipulation}
        .expense-manager-navigation__more-button[data-active="true"]{background:linear-gradient(135deg,rgba(37,99,235,.12),rgba(20,184,166,.08));border-color:rgba(37,99,235,.16);color:#172033}
        .expense-manager-navigation__more-panel{position:absolute;right:0;bottom:calc(100% + 8px);width:min(230px,calc(100vw - 28px));max-height:min(70dvh,360px);overflow:auto;padding:7px;border:1px solid rgba(148,163,184,.2);border-radius:15px;background:rgba(255,255,255,.98);box-shadow:0 16px 36px rgba(15,23,42,.16);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}
        .expense-manager-navigation__more-item{width:100%;min-height:44px;display:flex;align-items:center;gap:9px;padding:0 10px;border:1px solid transparent;border-radius:11px;background:transparent;color:#334155;text-align:left;font:inherit;font-size:12px;font-weight:800;cursor:pointer;touch-action:manipulation}
        .expense-manager-navigation__more-item:hover{background:rgba(59,130,246,.06);border-color:rgba(59,130,246,.1)}
        .expense-manager-navigation__more-item[data-active="true"]{background:rgba(37,99,235,.09);color:#172033}
        .expense-manager-navigation__quick-add{position:relative;min-height:48px;border:1px solid rgba(37,99,235,.22);border-radius:13px;background:linear-gradient(145deg,#2563eb,#4f46e5);color:#fff;font:inherit;font-size:16px;font-weight:950;box-shadow:0 8px 16px rgba(37,99,235,.18);cursor:pointer;touch-action:manipulation}
        @media (max-width:767px){.expense-manager-navigation{padding:0 8px 8px}.expense-manager-navigation__desktop{display:none}.expense-manager-navigation__mobile{display:block}.expense-manager-navigation__mobile-grid{grid-template-columns:minmax(0,1fr) minmax(0,1.35fr) 48px minmax(0,1fr) minmax(0,.8fr)}.expense-manager-navigation__item{flex-direction:column;gap:2px;padding:4px 2px}.expense-manager-navigation__item > span:last-child{display:block;width:max-content;max-width:none;min-width:max-content;overflow:visible}.expense-manager-navigation__more-button{flex-direction:column;gap:2px;padding:4px 2px}.expense-manager-navigation__more-button > span:last-child{display:block;width:max-content;max-width:none;min-width:max-content;overflow:visible}.expense-manager-navigation__quick-add{min-width:48px}}
        @media (max-width:380px){.expense-manager-navigation__mobile-grid{gap:3px;padding:5px}.expense-manager-navigation__item,.expense-manager-navigation__more-button,.expense-manager-navigation__quick-add{min-height:46px;font-size:10px}.expense-manager-navigation__icon{font-size:14px}.expense-manager-navigation__more-panel{width:min(220px,calc(100vw - 20px))}}
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
