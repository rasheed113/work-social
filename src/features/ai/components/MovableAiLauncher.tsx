import { useEffect } from 'react';

const STORAGE_KEY = 'work-social-ai-launcher-position-v1';
const LAUNCHER_SIZE = 38;
const EDGE_GAP = 8;
const DRAG_THRESHOLD = 5;
const IDLE_DELAY_MS = 1800;

type SavedPosition = { left: number; top: number };

function clampPosition(left: number, top: number): SavedPosition {
  const maxLeft = Math.max(EDGE_GAP, window.innerWidth - LAUNCHER_SIZE - EDGE_GAP);
  const maxTop = Math.max(EDGE_GAP, window.innerHeight - LAUNCHER_SIZE - EDGE_GAP);
  return { left: Math.min(Math.max(EDGE_GAP, left), maxLeft), top: Math.min(Math.max(EDGE_GAP, top), maxTop) };
}
function readSavedPosition(): SavedPosition | null {
  try { const raw = window.localStorage.getItem(STORAGE_KEY); if (!raw) return null; const parsed = JSON.parse(raw) as Partial<SavedPosition>; if (!Number.isFinite(parsed.left) || !Number.isFinite(parsed.top)) return null; return clampPosition(parsed.left!, parsed.top!); } catch { return null; }
}
function savePosition(position: SavedPosition) { try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(position)); } catch { /* storage may be unavailable */ } }

export function MovableAiLauncher() {
  useEffect(() => {
    const launcher = document.querySelector<HTMLButtonElement>('.ws-ai-launcher');
    if (!launcher) return;
    launcher.style.touchAction = 'none'; launcher.style.userSelect = 'none'; launcher.style.webkitUserSelect = 'none';
    launcher.setAttribute('aria-label', 'Work Social AI'); launcher.setAttribute('title', 'Work Social AI');

    const styleId = 'ws-ai-launcher-logo-style';
    let style = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style'); style.id = styleId;
      style.textContent = `
        .ws-ai-launcher.ws-ai-brand-logo{width:38px!important;height:38px!important;min-width:38px!important;min-height:38px!important;border-radius:11px!important;overflow:hidden!important;position:fixed!important;display:grid!important;place-items:center!important;box-sizing:border-box!important;background:#16a34a!important;background-image:none!important;border:1px solid rgba(255,255,255,.34)!important;color:transparent!important;font-size:0!important;opacity:.48!important;transform:scale(.94)!important;transition:opacity .22s ease,transform .22s ease,filter .22s ease,box-shadow .22s ease!important;box-shadow:0 5px 15px rgba(22,163,74,.28),inset 0 1px 0 rgba(255,255,255,.28),inset 0 -2px 5px rgba(0,0,0,.12)!important}
        .ws-ai-launcher.ws-ai-brand-logo::before{content:'AI'!important;position:absolute;inset:0;display:grid;place-items:center;font-family:Inter,ui-sans-serif,system-ui,sans-serif;font-size:12px!important;font-weight:900;letter-spacing:-.06em;line-height:1;color:#fff!important;text-shadow:0 1px 2px rgba(0,0,0,.28);pointer-events:none}
        .ws-ai-launcher.ws-ai-brand-logo::after{display:none!important;content:none!important}.ws-ai-launcher.ws-ai-brand-logo>*{opacity:0!important;visibility:hidden!important}
        .ws-ai-launcher.ws-ai-brand-logo.ws-ai-awake{opacity:1!important;transform:scale(1.08)!important;filter:brightness(1.06) saturate(1.05)!important;box-shadow:0 7px 20px rgba(22,163,74,.42),0 0 0 3px rgba(34,197,94,.14),inset 0 1px 0 rgba(255,255,255,.34),inset 0 -2px 5px rgba(0,0,0,.1)!important}

        .ws-ai-panel{border:1px solid rgba(134,239,172,.20)!important;border-radius:26px!important;background:linear-gradient(145deg,rgba(7,20,14,.985),rgba(10,25,19,.98) 48%,rgba(8,15,14,.99))!important;box-shadow:0 32px 90px rgba(0,0,0,.58),0 10px 35px rgba(22,163,74,.10),inset 0 1px 0 rgba(255,255,255,.10),inset 0 -1px 0 rgba(0,0,0,.38)!important;backdrop-filter:blur(24px)!important;-webkit-backdrop-filter:blur(24px)!important}
        .ws-ai-panel::before{content:'';position:absolute;inset:0;pointer-events:none;border-radius:inherit;background:radial-gradient(circle at 78% 0%,rgba(74,222,128,.12),transparent 34%),radial-gradient(circle at 0% 100%,rgba(34,197,94,.07),transparent 30%);z-index:0}
        .ws-ai-main,.ws-ai-history,.ws-ai-header,.ws-ai-messages,.ws-ai-composer{position:relative;z-index:1}
        .ws-ai-history{border-right:1px solid rgba(134,239,172,.12)!important;background:rgba(2,12,8,.34)!important}
        .ws-ai-history-title{color:#86efac!important}.ws-ai-new{border-color:rgba(74,222,128,.24)!important;background:linear-gradient(145deg,rgba(22,163,74,.22),rgba(21,128,61,.10))!important;color:#dcfce7!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 6px 16px rgba(0,0,0,.12)!important}.ws-ai-conversation{border-color:transparent!important}.ws-ai-conversation:hover{background:rgba(74,222,128,.07)!important}.ws-ai-conversation.active{background:linear-gradient(145deg,rgba(22,163,74,.22),rgba(21,128,61,.10))!important;border-color:rgba(74,222,128,.20)!important;color:#fff!important}
        .ws-ai-header{padding:14px 17px!important;border-bottom-color:rgba(134,239,172,.12)!important;background:linear-gradient(180deg,rgba(255,255,255,.025),transparent)!important}.ws-ai-orb{width:38px!important;height:38px!important;flex-basis:38px!important;border-radius:12px!important;background:#16a34a!important;box-shadow:0 8px 22px rgba(22,163,74,.30),inset 0 1px 0 rgba(255,255,255,.34),inset 0 -3px 6px rgba(0,0,0,.18)!important;font-size:15px!important}.ws-ai-header-title{letter-spacing:-.02em!important}.ws-ai-header-sub{color:#86a995!important}.ws-ai-close{transition:transform .18s ease,background .18s ease,color .18s ease!important}.ws-ai-close:hover{transform:scale(1.06)!important;background:rgba(74,222,128,.09)!important;color:#dcfce7!important}
        .ws-ai-messages{padding:20px 18px!important;gap:13px!important;background:radial-gradient(circle at 50% 0%,rgba(34,197,94,.035),transparent 42%)!important}.ws-ai-welcome{padding:34px 22px!important}.ws-ai-welcome h2{letter-spacing:-.03em!important}.ws-ai-welcome p{color:#8da59a!important}
        .ws-ai-message-row{max-width:min(78%,700px)!important;gap:5px!important}.ws-ai-bubble{padding:11px 14px!important;border-radius:17px!important;font-size:13px!important;line-height:1.58!important;box-shadow:0 8px 22px rgba(0,0,0,.12),inset 0 1px 0 rgba(255,255,255,.055)!important}.ws-ai-bubble.user{background:linear-gradient(145deg,#16a34a,#15803d)!important;border:1px solid rgba(134,239,172,.20)!important;border-bottom-right-radius:5px!important;box-shadow:0 10px 24px rgba(22,163,74,.20),inset 0 1px 0 rgba(255,255,255,.20),inset 0 -2px 5px rgba(0,0,0,.12)!important}.ws-ai-bubble.assistant{background:linear-gradient(145deg,rgba(255,255,255,.085),rgba(255,255,255,.045))!important;border:1px solid rgba(255,255,255,.10)!important;border-bottom-left-radius:5px!important;box-shadow:0 9px 24px rgba(0,0,0,.18),inset 0 1px 0 rgba(255,255,255,.08),inset 0 -2px 7px rgba(0,0,0,.10)!important}
        .ws-ai-speaker{border-color:rgba(134,239,172,.12)!important;background:rgba(255,255,255,.035)!important}.ws-ai-speaker:hover,.ws-ai-speaker.playing{color:#dcfce7!important;border-color:rgba(74,222,128,.34)!important;background:rgba(22,163,74,.12)!important;box-shadow:0 5px 14px rgba(22,163,74,.12)!important}
        .ws-ai-action{padding:13px!important;border-color:rgba(250,204,21,.30)!important;border-radius:16px!important;background:linear-gradient(145deg,rgba(120,53,15,.22),rgba(120,53,15,.10))!important;box-shadow:0 10px 24px rgba(0,0,0,.16),inset 0 1px 0 rgba(255,255,255,.06)!important}.ws-ai-confirm{background:linear-gradient(145deg,#ca8a04,#a16207)!important;box-shadow:0 7px 16px rgba(161,98,7,.22),inset 0 1px 0 rgba(255,255,255,.18)!important}
        .ws-ai-error{border-color:rgba(248,113,113,.28)!important;background:linear-gradient(145deg,rgba(127,29,29,.24),rgba(69,10,10,.16))!important;box-shadow:0 8px 20px rgba(0,0,0,.14)!important}
        .ws-ai-composer{padding:12px 13px!important;border-top-color:rgba(134,239,172,.12)!important;background:linear-gradient(180deg,rgba(3,13,9,.86),rgba(2,9,6,.98))!important}.ws-ai-input-wrap{padding:4px!important;border-color:rgba(134,239,172,.14)!important;border-radius:17px!important;background:rgba(255,255,255,.055)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.055),0 7px 20px rgba(0,0,0,.12)!important}.ws-ai-input-wrap:focus-within{border-color:rgba(74,222,128,.48)!important;box-shadow:0 0 0 3px rgba(34,197,94,.10),0 8px 22px rgba(0,0,0,.16)!important}.ws-ai-input{padding:8px 9px!important}.ws-ai-voice{border-radius:12px!important}.ws-ai-voice:hover{background:rgba(74,222,128,.08)!important}.ws-ai-send{width:44px!important;min-width:44px!important;flex-basis:44px!important;border-radius:14px!important;background:linear-gradient(145deg,#16a34a,#15803d)!important;box-shadow:0 9px 20px rgba(22,163,74,.22),inset 0 1px 0 rgba(255,255,255,.20),inset 0 -2px 5px rgba(0,0,0,.12)!important;transition:transform .16s ease,filter .16s ease,box-shadow .16s ease!important}.ws-ai-send:hover:not(:disabled){transform:translateY(-1px);filter:brightness(1.06)!important;box-shadow:0 12px 24px rgba(22,163,74,.28),inset 0 1px 0 rgba(255,255,255,.20)!important}.ws-ai-voice-status{border-color:rgba(74,222,128,.22)!important;background:rgba(5,20,13,.96)!important;color:#dcfce7!important;box-shadow:0 10px 24px rgba(0,0,0,.30)!important}
        .ws-ai-loading{color:#86a995!important}.ws-ai-dot{color:#86efac!important}
        @media(max-width:680px){.ws-ai-panel{right:8px!important;bottom:142px!important;width:calc(100vw - 16px)!important;height:calc(100dvh - 165px)!important;border-radius:22px!important}.ws-ai-messages{padding:16px 12px!important}.ws-ai-message-row{max-width:90%!important}.ws-ai-composer{padding:9px!important}}
      `;
      document.head.appendChild(style);
    }

    launcher.classList.add('ws-ai-brand-logo');
    let idleTimer: number | null = null;
    const wake = () => { launcher.classList.add('ws-ai-awake'); if (idleTimer !== null) window.clearTimeout(idleTimer); idleTimer = window.setTimeout(() => { launcher.classList.remove('ws-ai-awake'); idleTimer = null; }, IDLE_DELAY_MS); };
    const saved = readSavedPosition();
    if (saved) { launcher.style.left = `${saved.left}px`; launcher.style.top = `${saved.top}px`; launcher.style.right = 'auto'; launcher.style.bottom = 'auto'; }

    let dragging = false; let moved = false; let pointerId: number | null = null; let startX = 0; let startY = 0; let startLeft = 0; let startTop = 0;
    const onPointerDown = (event: PointerEvent) => { if (event.button !== 0 && event.pointerType !== 'touch') return; wake(); const rect = launcher.getBoundingClientRect(); pointerId = event.pointerId; startX = event.clientX; startY = event.clientY; startLeft = rect.left; startTop = rect.top; dragging = true; moved = false; launcher.setPointerCapture?.(event.pointerId); };
    const onPointerMove = (event: PointerEvent) => { if (!dragging || pointerId !== event.pointerId) return; wake(); const deltaX = event.clientX - startX; const deltaY = event.clientY - startY; if (!moved && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD) return; moved = true; event.preventDefault(); const next = clampPosition(startLeft + deltaX, startTop + deltaY); launcher.style.left = `${next.left}px`; launcher.style.top = `${next.top}px`; launcher.style.right = 'auto'; launcher.style.bottom = 'auto'; };
    const finishPointer = (event: PointerEvent) => { if (!dragging || pointerId !== event.pointerId) return; wake(); if (moved) { const rect = launcher.getBoundingClientRect(); savePosition(clampPosition(rect.left, rect.top)); } dragging = false; pointerId = null; try { launcher.releasePointerCapture?.(event.pointerId); } catch { /* already released */ } };
    const onClick = (event: MouseEvent) => { wake(); if (!moved) return; event.preventDefault(); event.stopImmediatePropagation(); moved = false; };
    const onResize = () => { const rect = launcher.getBoundingClientRect(); const next = clampPosition(rect.left, rect.top); launcher.style.left = `${next.left}px`; launcher.style.top = `${next.top}px`; launcher.style.right = 'auto'; launcher.style.bottom = 'auto'; savePosition(next); };
    launcher.addEventListener('pointerdown', onPointerDown); launcher.addEventListener('pointermove', onPointerMove); launcher.addEventListener('pointerup', finishPointer); launcher.addEventListener('pointercancel', finishPointer); launcher.addEventListener('click', onClick, true); window.addEventListener('resize', onResize);
    return () => { if (idleTimer !== null) window.clearTimeout(idleTimer); launcher.classList.remove('ws-ai-brand-logo', 'ws-ai-awake'); launcher.removeEventListener('pointerdown', onPointerDown); launcher.removeEventListener('pointermove', onPointerMove); launcher.removeEventListener('pointerup', finishPointer); launcher.removeEventListener('pointercancel', finishPointer); launcher.removeEventListener('click', onClick, true); window.removeEventListener('resize', onResize); };
  }, []);
  return null;
}
