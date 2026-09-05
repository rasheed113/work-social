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
  const mobileMore = sections.slice(2);

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
        .expense-manager-navigation__item{min-width:0;min-height:40px;display:flex;align-items:center;justify-content:center;gap:5px;padding:0 7px;border:1px solid transparent;border-radius:9px;background:transparent;color:#475569;font:inherit;font-size:12px;font-weight:800;cursor:pointer;touch-action:manipulation;transition:background .16s ease,border-color .16s ease,color .16s ease}
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
          .expense-manager-navigation{position:fixed;left:0;right:0;bottom:0;top:auto;z-index:1000;padding:6px 8px max(6px,env(safe-area-inset-bottom));background:rgba(248,250,252,.92);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}
          .expense-manager-navigation__shell{max-width:680px;margin:0 auto;border-radius:16px;box-shadow:0 8px 24px rgba(15,23,42,.12),inset 0 1px 0 rgba(255,255,255,.95)}
          .expense-manager-navigation__desktop{display:none}.expense-manager-navigation__mobile{display:block}
          .expense-manager-navigation__mobile-grid{grid-template-columns:repeat(5,minmax(0,1fr));gap:1px;padding:3px;min-height:54px}
          .expense-manager-navigation__item,.expense-manager-navigation__more-button{min-height:48px;height:48px;flex-direction:column;gap:3px;padding:3px 1px;font-size:9px;line-height:1.05;font-weight:850}
          .expense-manager-navigation__icon{font-size:15px;line-height:1}
          .expense-manager-navigation__quick-add{width:44px;min-width:44px;height:44px;min-height:44px;font-size:20px}
        }
        @media(max-width:340px){.expense-manager-navigation{padding-left:5px;padding-right:5px}.expense-manager-navigation__mobile-grid{min-height:52px}.expense-manager-navigation__item,.expense-manager-navigation__more-button{height:46px;min-height:46px;font-size:8.5px}.expense-manager-navigation__icon{font-size:14px}.expense-manager-navigation__quick-add{width:42px;min-width:42px;height:42px;min-height:42px}}
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
