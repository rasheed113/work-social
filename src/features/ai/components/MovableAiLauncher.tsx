import { useEffect } from 'react';

const STORAGE_KEY = 'work-social-ai-launcher-position-v1';
const LAUNCHER_SIZE = 44;
const EDGE_GAP = 8;
const DRAG_THRESHOLD = 5;
const IDLE_DELAY_MS = 1800;

type SavedPosition = { left: number; top: number };

function clampPosition(left: number, top: number): SavedPosition {
  const maxLeft = Math.max(EDGE_GAP, window.innerWidth - LAUNCHER_SIZE - EDGE_GAP);
  const maxTop = Math.max(EDGE_GAP, window.innerHeight - LAUNCHER_SIZE - EDGE_GAP);
  return {
    left: Math.min(Math.max(EDGE_GAP, left), maxLeft),
    top: Math.min(Math.max(EDGE_GAP, top), maxTop),
  };
}

function readSavedPosition(): SavedPosition | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedPosition>;
    if (!Number.isFinite(parsed.left) || !Number.isFinite(parsed.top)) return null;
    return clampPosition(parsed.left!, parsed.top!);
  } catch {
    return null;
  }
}

function savePosition(position: SavedPosition) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(position)); } catch { /* storage may be unavailable */ }
}

export function MovableAiLauncher() {
  useEffect(() => {
    const launcher = document.querySelector<HTMLButtonElement>('.ws-ai-launcher');
    if (!launcher) return;

    launcher.style.touchAction = 'none';
    launcher.style.userSelect = 'none';
    launcher.style.webkitUserSelect = 'none';
    launcher.setAttribute('aria-label', 'Work Social AI');
    launcher.setAttribute('title', 'Work Social AI');

    const styleId = 'ws-ai-launcher-logo-style';
    let style = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .ws-ai-launcher.ws-ai-brand-logo {
          width: 44px !important;
          height: 44px !important;
          min-width: 44px !important;
          min-height: 44px !important;
          border-radius: 13px !important;
          overflow: hidden !important;
          position: fixed !important;
          display: grid !important;
          place-items: center !important;
          box-sizing: border-box !important;
          background: #16a34a !important;
          background-image: none !important;
          border: 1px solid rgba(255,255,255,.34) !important;
          color: transparent !important;
          font-size: 0 !important;
          opacity: .48 !important;
          transform: scale(.94) !important;
          transition: opacity .22s ease, transform .22s ease, filter .22s ease, box-shadow .22s ease !important;
          box-shadow: 0 6px 18px rgba(22,163,74,.28), inset 0 1px 0 rgba(255,255,255,.28), inset 0 -2px 5px rgba(0,0,0,.12) !important;
        }
        .ws-ai-launcher.ws-ai-brand-logo::before {
          content: 'AI' !important;
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          font-family: Inter, ui-sans-serif, system-ui, sans-serif;
          font-size: 13px !important;
          font-weight: 900;
          letter-spacing: -.06em;
          line-height: 1;
          color: #fff !important;
          text-shadow: 0 1px 2px rgba(0,0,0,.28);
          pointer-events: none;
        }
        .ws-ai-launcher.ws-ai-brand-logo::after { display: none !important; content: none !important; }
        .ws-ai-launcher.ws-ai-brand-logo > * { opacity: 0 !important; visibility: hidden !important; }
        .ws-ai-launcher.ws-ai-brand-logo.ws-ai-awake {
          opacity: 1 !important;
          transform: scale(1.08) !important;
          filter: brightness(1.06) saturate(1.05) !important;
          box-shadow: 0 8px 24px rgba(22,163,74,.42), 0 0 0 3px rgba(34,197,94,.14), inset 0 1px 0 rgba(255,255,255,.34), inset 0 -2px 5px rgba(0,0,0,.1) !important;
        }
      `;
      document.head.appendChild(style);
    }

    launcher.classList.add('ws-ai-brand-logo');
    let idleTimer: number | null = null;

    const wake = () => {
      launcher.classList.add('ws-ai-awake');
      if (idleTimer !== null) window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        launcher.classList.remove('ws-ai-awake');
        idleTimer = null;
      }, IDLE_DELAY_MS);
    };

    const saved = readSavedPosition();
    if (saved) {
      launcher.style.left = `${saved.left}px`;
      launcher.style.top = `${saved.top}px`;
      launcher.style.right = 'auto';
      launcher.style.bottom = 'auto';
    }

    let dragging = false;
    let moved = false;
    let pointerId: number | null = null;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 && event.pointerType !== 'touch') return;
      wake();
      const rect = launcher.getBoundingClientRect();
      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      startLeft = rect.left;
      startTop = rect.top;
      dragging = true;
      moved = false;
      launcher.setPointerCapture?.(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!dragging || pointerId !== event.pointerId) return;
      wake();
      const deltaX = event.clientX - startX;
      const deltaY = event.clientY - startY;
      if (!moved && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD) return;
      moved = true;
      event.preventDefault();
      const next = clampPosition(startLeft + deltaX, startTop + deltaY);
      launcher.style.left = `${next.left}px`;
      launcher.style.top = `${next.top}px`;
      launcher.style.right = 'auto';
      launcher.style.bottom = 'auto';
    };

    const finishPointer = (event: PointerEvent) => {
      if (!dragging || pointerId !== event.pointerId) return;
      wake();
      if (moved) {
        const rect = launcher.getBoundingClientRect();
        savePosition(clampPosition(rect.left, rect.top));
      }
      dragging = false;
      pointerId = null;
      try { launcher.releasePointerCapture?.(event.pointerId); } catch { /* already released */ }
    };

    const onClick = (event: MouseEvent) => {
      wake();
      if (!moved) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      moved = false;
    };

    const onResize = () => {
      const rect = launcher.getBoundingClientRect();
      const next = clampPosition(rect.left, rect.top);
      launcher.style.left = `${next.left}px`;
      launcher.style.top = `${next.top}px`;
      launcher.style.right = 'auto';
      launcher.style.bottom = 'auto';
      savePosition(next);
    };

    launcher.addEventListener('pointerdown', onPointerDown);
    launcher.addEventListener('pointermove', onPointerMove);
    launcher.addEventListener('pointerup', finishPointer);
    launcher.addEventListener('pointercancel', finishPointer);
    launcher.addEventListener('click', onClick, true);
    window.addEventListener('resize', onResize);

    return () => {
      if (idleTimer !== null) window.clearTimeout(idleTimer);
      launcher.classList.remove('ws-ai-brand-logo', 'ws-ai-awake');
      launcher.removeEventListener('pointerdown', onPointerDown);
      launcher.removeEventListener('pointermove', onPointerMove);
      launcher.removeEventListener('pointerup', finishPointer);
      launcher.removeEventListener('pointercancel', finishPointer);
      launcher.removeEventListener('click', onClick, true);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return null;
}
