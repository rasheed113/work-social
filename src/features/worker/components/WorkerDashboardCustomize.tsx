import { useEffect, useMemo, useRef, useState } from 'react';
import { getWorkerDashboardPreference, saveWorkerDashboardPreference } from '../api/workerDashboardPreferences';

export interface DashboardCardOption {
  id: string;
  label: string;
  description?: string;
}

interface WorkerDashboardCustomizeProps {
  workerProfileId: string;
  cards: DashboardCardOption[];
  onLayoutChange: (order: string[], hidden: string[]) => void;
}

const LONG_PRESS_MS = 620;
const MOVE_CANCEL_PX = 10;

export function WorkerDashboardCustomize({ workerProfileId, cards, onLayoutChange }: WorkerDashboardCustomizeProps) {
  const defaultOrder = useMemo(() => cards.map(card => card.id), [cards]);
  const [open, setOpen] = useState(false);
  const [draftOrder, setDraftOrder] = useState(defaultOrder);
  const [draftHidden, setDraftHidden] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const timerRef = useRef<number | null>(null);
  const pressStartRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef<{ id: string; pointerId: number } | null>(null);

  const clearPress = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  useEffect(() => {
    if (!workerProfileId) return;
    let active = true;
    void (async () => {
      const result = await getWorkerDashboardPreference(workerProfileId);
      if (!active) return;
      const savedOrder = result.data?.card_order ?? [];
      const savedHidden = result.data?.hidden_cards ?? [];
      const normalized = [...savedOrder.filter(id => defaultOrder.includes(id)), ...defaultOrder.filter(id => !savedOrder.includes(id))];
      const normalizedHidden = savedHidden.filter(id => defaultOrder.includes(id));
      setDraftOrder(normalized);
      setDraftHidden(normalizedHidden);
      onLayoutChange(normalized, normalizedHidden);
    })();
    return () => { active = false; };
  }, [workerProfileId, defaultOrder.join('|')]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (open || event.button !== 0 && event.pointerType === 'mouse') return;
      if (window.location.pathname !== '/work') return;
      const target = event.target as Element | null;
      if (!target?.closest('main')) return;
      pressStartRef.current = { x: event.clientX, y: event.clientY };
      clearPress();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        setStatus('Drag cards up or down. Tap Hide to remove a card.');
        setOpen(true);
      }, LONG_PRESS_MS);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (timerRef.current === null) return;
      const dx = event.clientX - pressStartRef.current.x;
      const dy = event.clientY - pressStartRef.current.y;
      if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) clearPress();
    };
    const onPointerUp = () => clearPress();
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('pointercancel', onPointerUp, { passive: true });
    return () => {
      clearPress();
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [open]);

  const moveCard = (id: string, targetIndex: number) => {
    setDraftOrder(current => {
      const from = current.indexOf(id);
      if (from < 0 || targetIndex < 0 || targetIndex >= current.length || from === targetIndex) return current;
      const next = [...current];
      const [item] = next.splice(from, 1);
      next.splice(targetIndex, 0, item);
      return next;
    });
  };

  const handleDragStart = (id: string, event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    dragRef.current = { id, pointerId: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleDragMove = (id: string, event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || dragRef.current.id !== id || dragRef.current.pointerId !== event.pointerId) return;
    const elements = Array.from(document.querySelectorAll<HTMLElement>('[data-dashboard-card-id]'));
    const target = elements.find(element => {
      if (element.dataset.dashboardCardId === id) return false;
      const rect = element.getBoundingClientRect();
      return event.clientY >= rect.top && event.clientY <= rect.bottom;
    });
    if (!target?.dataset.dashboardCardId) return;
    const targetIndex = draftOrder.indexOf(target.dataset.dashboardCardId);
    if (targetIndex >= 0) moveCard(id, targetIndex);
  };

  const handleDragEnd = async (id: string, event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || dragRef.current.id !== id || dragRef.current.pointerId !== event.pointerId) return;
    dragRef.current = null;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* already released */ }
    await persist(draftOrder, draftHidden, false);
  };

  const toggleHidden = async (id: string) => {
    const nextHidden = draftHidden.includes(id) ? draftHidden.filter(item => item !== id) : [...draftHidden, id];
    setDraftHidden(nextHidden);
    await persist(draftOrder, nextHidden, false);
  };

  const persist = async (order: string[], hidden: string[], closeAfterSave: boolean) => {
    if (!workerProfileId || saving) return;
    setSaving(true);
    const result = await saveWorkerDashboardPreference(workerProfileId, order, hidden);
    setSaving(false);
    if (result.error) { setStatus(result.error.message); return; }
    onLayoutChange(order, hidden);
    setStatus('Saved');
    if (closeAfterSave) setOpen(false);
    window.setTimeout(() => setStatus(current => current === 'Saved' ? '' : current), 900);
  };

  const reset = async () => {
    setDraftOrder(defaultOrder);
    setDraftHidden([]);
    await persist(defaultOrder, [], false);
  };

  const cardMap = new Map(cards.map(card => [card.id, card]));

  return <>
    <div
      aria-hidden="true"
      style={{ position: 'fixed', right: 10, bottom: 84, zIndex: 20, pointerEvents: 'none', padding: '6px 9px', borderRadius: 999, color: '#64748b', background: 'rgba(255,255,255,.76)', border: '1px solid rgba(148,163,184,.14)', boxShadow: '0 5px 14px rgba(15,23,42,.05)', fontSize: 9, fontWeight: 800, opacity: .78 }}
    >Long press to customize
    </div>

    {open && <div role="dialog" aria-modal="true" aria-label="Arrange dashboard cards" style={{ position: 'fixed', zIndex: 1000, inset: 0, overflow: 'auto', padding: 'max(14px, env(safe-area-inset-top)) 12px max(100px, calc(18px + env(safe-area-inset-bottom)))', background: 'radial-gradient(circle at 12% 0%,rgba(99,102,241,.12),transparent 28%),radial-gradient(circle at 95% 30%,rgba(20,184,166,.10),transparent 30%),linear-gradient(180deg,#f8fafc,#e9eef5)' }}>
      <style>{`@keyframes hangingCard{0%{transform:rotate(-.55deg) translateY(0)}50%{transform:rotate(.55deg) translateY(1px)}100%{transform:rotate(-.55deg) translateY(0)}}.dash-hanging{transform-origin:50% 0;animation:hangingCard 2.8s ease-in-out infinite}.dash-hanging:nth-child(2n){animation-delay:-.9s}.dash-hanging:nth-child(3n){animation-delay:-1.6s}.dash-hanging__grip{position:absolute;top:-7px;left:50%;width:9px;height:9px;border-radius:50%;transform:translateX(-50%);background:linear-gradient(145deg,#fff,#94a3b8);box-shadow:0 2px 5px rgba(15,23,42,.22),inset 0 1px 0 #fff}.dash-hanging__line{position:absolute;top:0;left:50%;width:1px;height:8px;background:linear-gradient(#64748b,rgba(100,116,139,0));transform:translateX(-50%)}.dash-drag{touch-action:none;user-select:none;-webkit-user-select:none}.dash-drag:active{cursor:grabbing}.dash-hidden{opacity:.58;filter:saturate(.65)}`}</style>
      <header style={{ position: 'sticky', top: 0, zIndex: 3, padding: '8px 2px 12px', background: 'rgba(248,250,252,.88)', backdropFilter: 'blur(14px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div><div style={{ fontSize: 9, fontWeight: 950, letterSpacing: '.14em', color: '#6366f1', textTransform: 'uppercase' }}>Dashboard Edit Mode</div><h2 style={{ margin: '4px 0 3px', color: '#0f172a', fontSize: 24, letterSpacing: '-.04em' }}>Arrange your cards</h2><p style={{ margin: 0, color: '#64748b', fontSize: 11, lineHeight: 1.4 }}>Press and drag a card up or down. Hidden cards stay here so you can bring them back.</p></div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close dashboard editor" style={{ flex: '0 0 auto', width: 38, height: 38, borderRadius: 12, border: '1px solid rgba(148,163,184,.2)', background: 'linear-gradient(145deg,#fff,#eef2f7)', color: '#334155', fontSize: 21, fontWeight: 700, cursor: 'pointer', boxShadow: '0 7px 15px rgba(15,23,42,.08),inset 0 1px 0 #fff' }}>×</button>
        </div>
        <div style={{ marginTop: 9, display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}><span style={{ padding: '5px 8px', borderRadius: 999, background: '#fff', border: '1px solid #e2e8f0', color: '#475569', fontSize: 9, fontWeight: 900 }}>☝ Long press</span><span style={{ padding: '5px 8px', borderRadius: 999, background: '#fff', border: '1px solid #e2e8f0', color: '#475569', fontSize: 9, fontWeight: 900 }}>↕ Drag</span><span style={{ padding: '5px 8px', borderRadius: 999, background: '#fff', border: '1px solid #e2e8f0', color: '#475569', fontSize: 9, fontWeight: 900 }}>◉ Hide / Unhide</span></div>
      </header>

      <section style={{ width: 'min(100%, 760px)', margin: '0 auto', display: 'grid', gap: 13 }}>
        {draftOrder.map((id, index) => {
          const card = cardMap.get(id); if (!card) return null;
          const hidden = draftHidden.includes(id);
          return <div key={id} data-dashboard-card-id={id} className={`dash-hanging dash-drag${hidden ? ' dash-hidden' : ''}`} onPointerDown={event => handleDragStart(id, event)} onPointerMove={event => handleDragMove(id, event)} onPointerUp={event => void handleDragEnd(id, event)} style={{ position: 'relative', paddingTop: 8 }}>
            <span className="dash-hanging__line" aria-hidden="true" /><span className="dash-hanging__grip" aria-hidden="true" />
            <article style={{ position: 'relative', minHeight: 76, display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center', padding: '13px 13px 12px', border: `1px solid ${hidden ? '#cbd5e1' : 'rgba(99,102,241,.20)'}`, borderRadius: 17, background: hidden ? 'linear-gradient(145deg,#f8fafc,#eef2f7)' : 'linear-gradient(145deg,rgba(255,255,255,.99),rgba(245,247,255,.98))', boxShadow: hidden ? '0 8px 16px rgba(15,23,42,.05)' : '0 15px 28px rgba(15,23,42,.09),0 3px 7px rgba(79,70,229,.07),inset 0 1px 0 #fff', cursor: 'grab' }}>
              <div style={{ minWidth: 0 }}><div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ width: 24, height: 24, display: 'grid', placeItems: 'center', flex: '0 0 auto', borderRadius: 8, background: hidden ? '#e2e8f0' : 'linear-gradient(145deg,#eef2ff,#dbeafe)', color: hidden ? '#64748b' : '#4f46e5', fontSize: 10, fontWeight: 950 }}>{index + 1}</span><strong style={{ color: '#172033', fontSize: 13, letterSpacing: '-.01em' }}>{card.label}</strong></div><p style={{ margin: '6px 0 0 31px', color: '#64748b', fontSize: 10, lineHeight: 1.35 }}>{card.description ?? 'Dashboard card'}{hidden ? ' · Hidden' : ''}</p></div>
              <button type="button" disabled={saving} onPointerDown={event => event.stopPropagation()} onClick={() => void toggleHidden(id)} style={{ minWidth: 78, minHeight: 34, padding: '0 10px', borderRadius: 10, border: hidden ? '1px solid #cbd5e1' : '1px solid rgba(16,185,129,.20)', background: hidden ? '#fff' : 'linear-gradient(145deg,#ecfdf5,#d1fae5)', color: hidden ? '#475569' : '#047857', font: 'inherit', fontSize: 10, fontWeight: 950, cursor: 'pointer', boxShadow: '0 5px 10px rgba(15,23,42,.05),inset 0 1px 0 #fff' }}>{hidden ? '↗ Unhide' : '− Hide'}</button>
            </article>
          </div>;
        })}
      </section>

      <footer style={{ position: 'fixed', zIndex: 4, left: 0, right: 0, bottom: 0, padding: '10px 12px max(10px, env(safe-area-inset-bottom))', background: 'rgba(248,250,252,.92)', backdropFilter: 'blur(16px)', borderTop: '1px solid rgba(148,163,184,.16)' }}>
        <div style={{ width: 'min(100%, 760px)', margin: '0 auto', display: 'flex', gap: 8 }}><button type="button" disabled={saving} onClick={() => void reset()} style={{ minHeight: 40, padding: '0 13px', borderRadius: 11, border: '1px solid #cbd5e1', background: '#fff', color: '#475569', font: 'inherit', fontSize: 10, fontWeight: 900, cursor: 'pointer' }}>Reset</button><button type="button" onClick={() => setOpen(false)} style={{ flex: 1, minHeight: 40, border: 0, borderRadius: 11, background: 'linear-gradient(145deg,#4f46e5,#2563eb)', color: '#fff', font: 'inherit', fontSize: 11, fontWeight: 950, cursor: 'pointer', boxShadow: '0 9px 17px rgba(79,70,229,.20)' }}>Done</button></div>
        {status && <div role="status" style={{ width: 'min(100%, 760px)', margin: '7px auto 0', textAlign: 'center', color: '#64748b', fontSize: 9, fontWeight: 850 }}>{status}</div>}
      </footer>
    </div>}
  </>;
}
