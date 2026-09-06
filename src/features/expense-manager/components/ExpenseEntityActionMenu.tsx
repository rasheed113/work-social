import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface ExpenseEntityAction {
  label: string;
  onSelect: () => void | Promise<void>;
  destructive?: boolean;
  disabled?: boolean;
}

interface Props {
  label: string;
  actions: ExpenseEntityAction[];
}

export function ExpenseEntityActionMenu({ label, actions }: Props) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const positionMenu = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(210, window.innerWidth - 20);
    const estimatedHeight = Math.min(48 * actions.length + 12, 260);
    const gap = 6;
    const left = Math.max(10, Math.min(rect.right - width, window.innerWidth - width - 10));
    const openUp = rect.bottom + gap + estimatedHeight > window.innerHeight && rect.top > estimatedHeight + gap;
    const top = openUp ? Math.max(10, rect.top - estimatedHeight - gap) : Math.min(window.innerHeight - estimatedHeight - 10, rect.bottom + gap);
    setPosition({ top, left });
  };

  useLayoutEffect(() => {
    if (!open) return;
    positionMenu();
    const onViewportChange = () => positionMenu();
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);
    return () => {
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
    };
  }, [open, actions.length]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const menu = open ? createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={label}
      style={{
        position: 'fixed', top: position.top, left: position.left, width: 'min(210px, calc(100vw - 20px))', zIndex: 1600,
        padding: 6, boxSizing: 'border-box', border: '1px solid rgba(148,163,184,.2)', borderRadius: 14,
        background: 'rgba(255,255,255,.98)', boxShadow: '0 18px 42px rgba(15,23,42,.18), 0 2px 8px rgba(15,23,42,.08)',
      }}
    >
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          role="menuitem"
          disabled={action.disabled}
          onClick={() => {
            setOpen(false);
            void action.onSelect();
          }}
          style={{
            width: '100%', minHeight: 42, display: 'flex', alignItems: 'center', padding: '0 11px',
            border: 0, borderRadius: 10, background: 'transparent', color: action.destructive ? '#b91c1c' : '#334155',
            font: 'inherit', fontSize: 11, fontWeight: 850, textAlign: 'left', cursor: action.disabled ? 'wait' : 'pointer',
            opacity: action.disabled ? .55 : 1,
          }}
          onMouseDown={(event) => event.preventDefault()}
        >
          {action.label}
        </button>
      ))}
    </div>,
    document.body,
  ) : null;

  return <>
    <button
      ref={triggerRef}
      type="button"
      aria-label={label}
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={() => setOpen((value) => !value)}
      style={{
        width: 36, height: 36, flex: '0 0 36px', display: 'grid', placeItems: 'center',
        border: '1px solid rgba(148,163,184,.18)', borderRadius: 11, background: '#fff', color: '#475569',
        font: 'inherit', fontSize: 18, lineHeight: 1, fontWeight: 950, cursor: 'pointer',
      }}
    >
      <span aria-hidden="true">⋮</span>
    </button>
    {menu}
  </>;
}
