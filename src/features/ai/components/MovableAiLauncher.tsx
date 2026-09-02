import { useEffect } from 'react';

const STORAGE_KEY = 'work-social-ai-launcher-position-v1';
const LAUNCHER_SIZE = 58;
const EDGE_GAP = 8;
const DRAG_THRESHOLD = 5;

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
      if (moved) {
        const rect = launcher.getBoundingClientRect();
        savePosition(clampPosition(rect.left, rect.top));
      }
      dragging = false;
      pointerId = null;
      try { launcher.releasePointerCapture?.(event.pointerId); } catch { /* already released */ }
    };

    const onClick = (event: MouseEvent) => {
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
