import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

interface GlobalModuleMenuProps {
  onNavigate: (path: string) => void;
}

type ModuleId = 'social' | 'work' | 'expense' | 'diary';

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

export function GlobalModuleMenu({ onNavigate }: GlobalModuleMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const currentModule = activeModule(window.location.pathname);

  const closeMenu = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) window.requestAnimationFrame(() => menuButtonRef.current?.focus());
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) closeMenu();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    window.requestAnimationFrame(() => itemRefs.current[0]?.focus());
  }, [open]);

  const moveFocus = (index: number) => {
    const count = modules.length;
    itemRefs.current[(index + count) % count]?.focus();
  };

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const itemIndex = itemRefs.current.findIndex((item) => item === target);
    if (itemIndex < 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveFocus(itemIndex + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveFocus(itemIndex - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      moveFocus(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      moveFocus(modules.length - 1);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu(true);
    }
  };

  const selectModule = (path: string) => {
    closeMenu();
    onNavigate(path);
  };

  return (
    <div ref={rootRef} className="ws-main-header__menu-wrap">
      <style>{`
        .ws-main-header__menu-wrap{position:relative;z-index:1002;flex:0 0 auto}
        .ws-main-header__menu{position:relative;min-width:40px;min-height:40px;width:40px;flex:0 0 40px;display:inline-flex;align-items:center;justify-content:center;padding:0;box-sizing:border-box;border:1px solid rgba(255,255,255,.2);border-radius:13px;color:#fff;background:linear-gradient(145deg,rgba(109,93,252,.9),rgba(37,99,235,.92) 54%,rgba(34,193,220,.88));box-shadow:inset 0 1px 1px rgba(255,255,255,.2),0 8px 18px rgba(79,70,229,.2);cursor:pointer;transition:transform .18s ease,box-shadow .18s ease,filter .18s ease}
        .ws-main-header__menu:hover{filter:brightness(1.05);box-shadow:inset 0 1px 1px rgba(255,255,255,.22),0 10px 22px rgba(79,70,229,.26)}
        .ws-main-header__menu:active{transform:translateY(1px);box-shadow:inset 0 2px 4px rgba(0,0,0,.18),0 5px 12px rgba(79,70,229,.18)}
        .ws-main-header__menu:focus-visible{outline:2px solid rgba(125,211,252,.9);outline-offset:2px}
        .ws-main-header__menu-icon{width:19px;height:19px;display:block}
        .ws-main-header__menu-panel{position:absolute;top:calc(100% + 9px);right:0;width:min(290px,calc(100vw - 20px));padding:8px;box-sizing:border-box;border:1px solid rgba(255,255,255,.16);border-radius:17px;background:linear-gradient(145deg,rgba(15,23,42,.98),rgba(30,41,59,.97) 55%,rgba(49,46,129,.96));box-shadow:0 18px 42px rgba(15,23,42,.28),inset 0 1px 0 rgba(255,255,255,.11);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)}
        .ws-main-header__menu-heading{padding:7px 9px 9px;color:#fff}
        .ws-main-header__menu-title{display:block;font-size:13px;line-height:1.15;font-weight:900;letter-spacing:-.01em}
        .ws-main-header__menu-subtitle{display:block;margin-top:3px;font-size:9px;line-height:1.2;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(186,230,253,.75)}
        .ws-main-header__menu-divider{height:1px;margin:0 2px 6px;background:rgba(255,255,255,.1)}
        .ws-main-header__menu-item{width:100%;min-height:42px;display:flex;align-items:center;gap:10px;padding:0 10px;border:1px solid transparent;border-radius:12px;background:transparent;color:#e2e8f0;text-align:left;font:inherit;cursor:pointer;transition:background .16s ease,border-color .16s ease,transform .16s ease}
        .ws-main-header__menu-item:hover{background:rgba(255,255,255,.075);border-color:rgba(255,255,255,.08);transform:translateX(1px)}
        .ws-main-header__menu-item:focus-visible{outline:2px solid rgba(125,211,252,.9);outline-offset:-2px}
        .ws-main-header__menu-item[data-active="true"]{background:linear-gradient(135deg,rgba(59,130,246,.28),rgba(124,58,237,.22));border-color:rgba(125,211,252,.2);color:#fff}
        .ws-main-header__menu-dot{width:8px;height:8px;flex:0 0 8px;border-radius:50%;background:rgba(148,163,184,.55);box-shadow:0 0 0 4px rgba(148,163,184,.06)}
        .ws-main-header__menu-item[data-active="true"] .ws-main-header__menu-dot{background:#7dd3fc;box-shadow:0 0 0 4px rgba(125,211,252,.1),0 0 12px rgba(125,211,252,.35)}
        .ws-main-header__menu-label{flex:1;font-size:12px;line-height:1.2;font-weight:850}
        .ws-main-header__menu-check{font-size:13px;font-weight:950;color:#7dd3fc}
        .work-social-router-shell:has(nav[aria-label="Worker navigation"]) .ws-main-header__menu{min-height:38px;height:38px;width:38px;flex-basis:38px;padding:0;border:1px solid rgba(71,85,105,.15);border-radius:11px;color:#334155;background:linear-gradient(145deg,#fff 0%,#f5f8fb 58%,#edf4f5 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,1),inset 0 -1px 0 rgba(100,116,139,.08),0 2px 0 rgba(255,255,255,.95),0 5px 10px rgba(15,23,42,.055);text-shadow:0 1px 0 #fff}
        .work-social-router-shell:has(nav[aria-label="Worker navigation"]) .ws-main-header__menu:hover{filter:none;transform:translateY(-1px);box-shadow:inset 0 1px 0 rgba(255,255,255,1),0 3px 0 rgba(255,255,255,.96),0 8px 14px rgba(15,23,42,.075)}
        .work-social-router-shell:has(nav[aria-label="Worker navigation"]) .ws-main-header__menu:active{transform:translateY(1px);box-shadow:inset 0 2px 4px rgba(15,23,42,.08),0 1px 0 rgba(255,255,255,.95)}
        .work-social-router-shell:has(nav[aria-label="Worker navigation"]) .ws-main-header__menu:focus-visible{outline:2px solid rgba(59,130,246,.65);outline-offset:2px}
        .work-social-router-shell:has(nav[aria-label="Worker navigation"]) .ws-main-header__menu-panel{background:linear-gradient(145deg,rgba(255,255,255,.995),rgba(247,250,253,.99) 58%,rgba(239,248,249,.985));border-color:rgba(71,85,105,.14);box-shadow:0 18px 38px rgba(15,23,42,.14),inset 0 1px 0 #fff;color:#172033}
        .work-social-router-shell:has(nav[aria-label="Worker navigation"]) .ws-main-header__menu-heading{color:#172033}
        .work-social-router-shell:has(nav[aria-label="Worker navigation"]) .ws-main-header__menu-subtitle{color:#527083}
        .work-social-router-shell:has(nav[aria-label="Worker navigation"]) .ws-main-header__menu-divider{background:rgba(71,85,105,.1)}
        .work-social-router-shell:has(nav[aria-label="Worker navigation"]) .ws-main-header__menu-item{color:#334155}
        .work-social-router-shell:has(nav[aria-label="Worker navigation"]) .ws-main-header__menu-item:hover{background:rgba(59,130,246,.045);border-color:rgba(59,130,246,.1)}
        .work-social-router-shell:has(nav[aria-label="Worker navigation"]) .ws-main-header__menu-item[data-active="true"]{background:linear-gradient(135deg,rgba(59,130,246,.09),rgba(20,184,166,.06));border-color:rgba(59,130,246,.14);color:#172033}
        @media (max-width:430px){.ws-main-header__menu{min-width:36px;min-height:36px;width:36px;flex-basis:36px;border-radius:11px}.ws-main-header__menu-icon{width:18px;height:18px}.ws-main-header__menu-panel{top:calc(100% + 7px);width:min(280px,calc(100vw - 16px));right:-1px}}
        @media (max-width:340px){.ws-main-header__menu{min-width:34px;min-height:34px;width:34px;flex-basis:34px;border-radius:10px}.ws-main-header__menu-panel{width:calc(100vw - 14px);right:-1px}}
      `}</style>
      <button
        ref={menuButtonRef}
        type="button"
        className="ws-main-header__menu"
        aria-label="Open Work Social menu"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls="work-social-global-module-menu"
        onClick={() => setOpen((value) => !value)}
      >
        <svg className="ws-main-header__menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 7h16" />
          <path d="M4 12h16" />
          <path d="M4 17h16" />
        </svg>
      </button>
      {open && (
        <div id="work-social-global-module-menu" className="ws-main-header__menu-panel" role="menu" aria-label="Work Social modules" onKeyDown={handleMenuKeyDown}>
          <div className="ws-main-header__menu-heading">
            <span className="ws-main-header__menu-title">Work Social</span>
            <span className="ws-main-header__menu-subtitle">Switch workspace</span>
          </div>
          <div className="ws-main-header__menu-divider" />
          {modules.map((module, index) => {
            const active = module.id === currentModule;
            return (
              <button
                key={module.id}
                ref={(element) => { itemRefs.current[index] = element; }}
                type="button"
                role="menuitem"
                className="ws-main-header__menu-item"
                data-active={active}
                aria-current={active ? 'page' : undefined}
                onClick={() => selectModule(module.path)}
              >
                <span className="ws-main-header__menu-dot" aria-hidden="true" />
                <span className="ws-main-header__menu-label">{module.label}</span>
                {active && <span className="ws-main-header__menu-check" aria-hidden="true">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
