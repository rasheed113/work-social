import { useEffect, useMemo, useState } from 'react';
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

export function WorkerDashboardCustomize({ workerProfileId, cards, onLayoutChange }: WorkerDashboardCustomizeProps) {
  const defaultOrder = useMemo(() => cards.map(card => card.id), [cards]);
  const [open, setOpen] = useState(false);
  const [draftOrder, setDraftOrder] = useState(defaultOrder);
  const [draftHidden, setDraftHidden] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

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

  const move = (id: string, direction: -1 | 1) => {
    setDraftOrder(current => {
      const index = current.indexOf(id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const toggleHidden = (id: string) => {
    setDraftHidden(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  };

  const save = async () => {
    if (!workerProfileId) return;
    setSaving(true); setStatus('');
    const result = await saveWorkerDashboardPreference(workerProfileId, draftOrder, draftHidden);
    setSaving(false);
    if (result.error) { setStatus(result.error.message); return; }
    onLayoutChange(draftOrder, draftHidden);
    setStatus('Dashboard layout saved.');
    window.setTimeout(() => setStatus(''), 1600);
    setOpen(false);
  };

  const reset = async () => {
    if (!workerProfileId) return;
    setDraftOrder(defaultOrder);
    setDraftHidden([]);
    setSaving(true); setStatus('');
    const result = await saveWorkerDashboardPreference(workerProfileId, defaultOrder, []);
    setSaving(false);
    if (result.error) { setStatus(result.error.message); return; }
    onLayoutChange(defaultOrder, []);
    setStatus('Default layout restored.');
    window.setTimeout(() => setStatus(''), 1600);
  };

  const cardMap = new Map(cards.map(card => [card.id, card]));

  return <>
    <button type="button" aria-label="Customize dashboard" onClick={() => setOpen(true)} style={{ minHeight: 34, padding: '0 10px', borderRadius: 10, border: '1px solid rgba(99,102,241,.2)', background: 'linear-gradient(145deg,#fff,#f5f3ff)', color: '#4f46e5', font: 'inherit', fontSize: 11, fontWeight: 950, cursor: 'pointer', boxShadow: '0 5px 10px rgba(79,70,229,.08), inset 0 1px 0 #fff', whiteSpace: 'nowrap' }}>✦ Customize</button>
    {open && <div role="dialog" aria-modal="true" aria-label="Customize Dashboard" onMouseDown={event => { if (event.currentTarget === event.target) setOpen(false); }} style={{ position: 'fixed', zIndex: 1000, inset: 0, display: 'grid', placeItems: 'center', padding: 14, background: 'rgba(15,23,42,.48)', backdropFilter: 'blur(8px)' }}>
      <section style={{ width: 'min(100%, 520px)', maxHeight: 'min(86vh,680px)', overflow: 'auto', border: '1px solid rgba(255,255,255,.5)', borderRadius: 22, background: 'linear-gradient(145deg,rgba(255,255,255,.99),rgba(246,248,255,.98))', boxShadow: '0 28px 70px rgba(15,23,42,.24), inset 0 1px 0 #fff', padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
          <div><div style={{ color: '#6366f1', fontSize: 10, fontWeight: 950, letterSpacing: '.12em', textTransform: 'uppercase' }}>Dashboard</div><h2 style={{ margin: '5px 0 3px', fontSize: 24, letterSpacing: '-.035em' }}>Customize cards</h2><p style={{ margin: 0, color: '#64748b', fontSize: 12, lineHeight: 1.45 }}>Move cards up or down and hide cards you do not need.</p></div>
          <button type="button" onClick={() => setOpen(false)} style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', fontWeight: 900, cursor: 'pointer' }} aria-label="Close">×</button>
        </div>
        <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>
          {draftOrder.map((id, index) => { const card = cardMap.get(id); if (!card) return null; const hidden = draftHidden.includes(id); return <div key={id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 10, alignItems: 'center', padding: 11, borderRadius: 14, border: '1px solid #e2e8f0', background: hidden ? '#f8fafc' : '#fff', opacity: hidden ? .62 : 1 }}>
            <div style={{ display: 'grid', gap: 4 }}><button type="button" disabled={index === 0 || saving} onClick={() => move(id, -1)} style={{ width: 30, height: 25, borderRadius: 7, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: index === 0 ? 'not-allowed' : 'pointer', fontWeight: 900 }}>↑</button><button type="button" disabled={index === draftOrder.length - 1 || saving} onClick={() => move(id, 1)} style={{ width: 30, height: 25, borderRadius: 7, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: index === draftOrder.length - 1 ? 'not-allowed' : 'pointer', fontWeight: 900 }}>↓</button></div>
            <div><strong style={{ display: 'block', fontSize: 13 }}>{card.label}</strong><span style={{ color: '#64748b', fontSize: 11 }}>{card.description ?? 'Dashboard card'}</span></div>
            <button type="button" disabled={saving} onClick={() => toggleHidden(id)} style={{ minWidth: 66, minHeight: 30, borderRadius: 9, border: '1px solid #cbd5e1', background: hidden ? '#e2e8f0' : '#ecfdf5', color: hidden ? '#475569' : '#047857', font: 'inherit', fontSize: 10, fontWeight: 950, cursor: 'pointer' }}>{hidden ? 'Show' : 'Hide'}</button>
          </div>; })}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}><button type="button" disabled={saving} onClick={() => void reset()} style={{ minHeight: 38, padding: '0 12px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', font: 'inherit', fontSize: 11, fontWeight: 900, cursor: 'pointer' }}>Reset Default</button><button type="button" disabled={saving} onClick={() => void save()} style={{ flex: 1, minHeight: 38, padding: '0 14px', borderRadius: 10, border: 0, background: 'linear-gradient(145deg,#5b56df,#2563eb)', color: '#fff', font: 'inherit', fontSize: 11, fontWeight: 950, cursor: 'pointer', boxShadow: '0 9px 16px rgba(79,70,229,.18)' }}>{saving ? 'Saving…' : 'Save Layout'}</button></div>
        {status && <div role="status" style={{ marginTop: 10, padding: 9, borderRadius: 10, background: '#f1f5f9', color: '#475569', fontSize: 11, fontWeight: 800 }}>{status}</div>}
      </section>
    </div>}
  </>;
}
