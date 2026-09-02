import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { calculateWorkEntryTotal } from '../logic/workEntryCalculations';
import { MAX_WORK_ENTRY_SIZE_LENGTH, WORK_ENTRY_SIZE_OPTIONS, normalizeWorkEntrySizes } from '../logic/workEntrySizes';

interface WorkerNewWorkEntryModalProps {
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (input: { id?: string; item_name: string; size: string[] | null; quantity: string; rate: string; special_note: string | null }) => Promise<{ error: unknown } | { error: null }>;
}

const DECIMAL_RE = /^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/;
const overlayStyle = { position: 'fixed' as const, inset: 0, zIndex: 1300, display: 'grid', placeItems: 'center', padding: 14, background: 'rgba(15,23,42,.58)', backdropFilter: 'blur(8px)' };

export function WorkerNewWorkEntryModal({ open, saving, onClose, onSave }: WorkerNewWorkEntryModalProps) {
  const [entryId, setEntryId] = useState(() => crypto.randomUUID());
  const [itemName, setItemName] = useState('');
  const [sizes, setSizes] = useState<string[]>([]);
  const [quantity, setQuantity] = useState('');
  const [rate, setRate] = useState('');
  const [specialNote, setSpecialNote] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [sizePickerOpen, setSizePickerOpen] = useState(false);
  const [customSize, setCustomSize] = useState('');
  const sizeTriggerRef = useRef<HTMLButtonElement>(null);
  const customSizeInputRef = useRef<HTMLInputElement>(null);
  const total = useMemo(() => calculateWorkEntryTotal(quantity, rate), [quantity, rate]);

  useEffect(() => {
    if (!sizePickerOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSizePickerOpen(false);
        requestAnimationFrame(() => sizeTriggerRef.current?.focus());
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sizePickerOpen]);

  useEffect(() => {
    if (sizePickerOpen) customSizeInputRef.current?.focus();
  }, [sizePickerOpen]);

  if (!open) return null;

  const resetAndClose = () => {
    if (saving) return;
    setItemName('');
    setSizes([]);
    setQuantity('');
    setRate('');
    setSpecialNote('');
    setCustomSize('');
    setSizePickerOpen(false);
    setValidationError(null);
    setEntryId(crypto.randomUUID());
    onClose();
  };

  const closeSizePicker = () => {
    setSizePickerOpen(false);
    requestAnimationFrame(() => sizeTriggerRef.current?.focus());
  };

  const toggleSize = (value: string) => {
    setSizes((current) => current.includes(value) ? current.filter((size) => size !== value) : [...current, value]);
    setValidationError(null);
  };

  const clearSizes = () => {
    setSizes([]);
    setCustomSize('');
    setValidationError(null);
  };

  const addCustomSize = () => {
    const normalized = customSize.trim();
    if (!normalized) return;
    if (normalized.length > MAX_WORK_ENTRY_SIZE_LENGTH) {
      setValidationError(`Each Size must be ${MAX_WORK_ENTRY_SIZE_LENGTH} characters or fewer.`);
      return;
    }
    setSizes((current) => normalizeWorkEntrySizes([...current, normalized]));
    setCustomSize('');
    setValidationError(null);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!itemName.trim()) return setValidationError('Item Name is required.');
    if (!DECIMAL_RE.test(quantity) || quantity === '0') return setValidationError('Quantity must be a valid positive decimal with up to 4 decimal places.');
    if (!DECIMAL_RE.test(rate)) return setValidationError('Rate must be a valid decimal with up to 4 decimal places.');
    const normalizedSizes = normalizeWorkEntrySizes(sizes);
    setValidationError(null);
    const result = await onSave({ id: entryId, item_name: itemName, size: normalizedSizes.length ? normalizedSizes : null, quantity, rate, special_note: specialNote.trim() || null });
    if (!result.error) resetAndClose();
  };

  const sizeSummary = sizes.length ? (sizes.length === 1 ? sizes[0] : `${sizes.length} sizes selected`) : 'Optional — Select sizes';

  return (
    <div style={overlayStyle} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) resetAndClose(); }}>
      <style>{`\
        .work-size-picker-backdrop { position: fixed; inset: 0; z-index: 1400; display: flex; align-items: flex-end; justify-content: center; padding: 0; background: rgba(15,23,42,.38); backdrop-filter: blur(5px); animation: work-size-fade-in 160ms ease-out; }\
        .work-size-picker-panel { width: 100%; max-height: min(78dvh, 620px); overflow-y: auto; box-sizing: border-box; border-radius: 24px 24px 0 0; background: #fff; box-shadow: 0 -18px 60px rgba(15,23,42,.2); padding: 10px 16px calc(18px + env(safe-area-inset-bottom)); animation: work-size-slide-up 220ms cubic-bezier(.22,1,.36,1); }\
        .work-size-option { min-height: 48px; width: 100%; border: 1px solid #e2e8f0; border-radius: 14px; background: #fff; color: #0f172a; font: inherit; font-size: 15px; font-weight: 800; text-align: left; padding: 0 14px; cursor: pointer; transition: transform 120ms ease, background 120ms ease, border-color 120ms ease; }\
        .work-size-option:active { transform: scale(.985); }\
        .work-size-option[data-selected="true"] { border-color: #4f46e5; background: #eef2ff; color: #3730a3; }\
        .work-size-picker-control { min-height: 48px; border-radius: 14px; border: 1px solid #cbd5e1; background: #fff; color: #0f172a; font: inherit; font-weight: 700; cursor: pointer; }\
        .work-size-picker-control:focus-visible, .work-size-option:focus-visible { outline: 3px solid rgba(99,102,241,.25); outline-offset: 2px; }\
        .work-size-custom-input { width: 100%; min-height: 48px; box-sizing: border-box; border: 1px solid #cbd5e1; border-radius: 14px; padding: 0 13px; font: inherit; color: #0f172a; background: #fff; }\
        .work-size-custom-input:focus { border-color: #6366f1; outline: 3px solid rgba(99,102,241,.16); }\
        @keyframes work-size-fade-in { from { opacity: 0; } to { opacity: 1; } }\
        @keyframes work-size-slide-up { from { transform: translateY(18px); opacity: .7; } to { transform: translateY(0); opacity: 1; } }\
        @media (min-width: 700px) { .work-size-picker-backdrop { align-items: center; padding: 18px; } .work-size-picker-panel { max-width: 460px; border-radius: 24px; padding: 12px 18px 18px; box-shadow: 0 24px 70px rgba(15,23,42,.24); } }\
        @media (prefers-reduced-motion: reduce) { .work-size-picker-backdrop, .work-size-picker-panel, .work-size-option { animation: none; transition: none; } }\
      `}</style>
      <section role="dialog" aria-modal="true" aria-labelledby="new-work-entry-title" style={{ width: '100%', maxWidth: 560, maxHeight: 'calc(100dvh - 28px)', overflowY: 'auto', borderRadius: 22, background: '#fff', boxShadow: '0 24px 70px rgba(15,23,42,.3)', padding: 18, boxSizing: 'border-box' }}>
        <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}><div><div style={{ color: '#64748b', fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>My Work</div><h2 id="new-work-entry-title" style={{ margin: '5px 0 0', fontSize: 24, letterSpacing: '-.035em' }}>New Entry</h2></div><button type="button" onClick={resetAndClose} disabled={saving} aria-label="Close New Entry" style={{ minWidth: 40, minHeight: 40, borderRadius: 12 }}>×</button></header>
        <form onSubmit={submit} style={{ display: 'grid', gap: 12, marginTop: 18 }}>
          <label style={{ display: 'grid', gap: 6, fontWeight: 700, fontSize: 13 }}>Work context<div style={{ padding: '11px 12px', borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155' }}>My Work</div></label>
          <label style={{ display: 'grid', gap: 6, fontWeight: 700, fontSize: 13 }}>Item Name<input value={itemName} onChange={(event) => setItemName(event.target.value)} maxLength={200} autoFocus disabled={saving} /></label>
          <div style={{ display: 'grid', gap: 6 }}>
            <label htmlFor="work-entry-size-trigger" style={{ fontWeight: 700, fontSize: 13 }}>Size <span style={{ color: '#94a3b8', fontWeight: 600 }}>(optional)</span></label>
            <button id="work-entry-size-trigger" ref={sizeTriggerRef} type="button" disabled={saving} onClick={() => setSizePickerOpen(true)} aria-haspopup="dialog" aria-expanded={sizePickerOpen} style={{ minHeight: 52, width: '100%', padding: '0 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderRadius: 15, border: '1px solid #cbd5e1', background: '#fff', color: sizes.length ? '#0f172a' : '#94a3b8', font: 'inherit', fontWeight: 750, textAlign: 'left', cursor: saving ? 'not-allowed' : 'pointer', boxShadow: '0 2px 8px rgba(15,23,42,.04)' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sizeSummary}</span>
              <span aria-hidden="true" style={{ color: '#64748b', fontSize: 18, lineHeight: 1 }}>⌄</span>
            </button>
            {!!sizes.length && <div aria-label="Selected sizes" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{sizes.map((value) => <span key={value} style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 9px', borderRadius: 999, background: '#eef2ff', color: '#3730a3', fontSize: 12, fontWeight: 800 }}>{value}</span>)}</div>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><label style={{ display: 'grid', gap: 6, fontWeight: 700, fontSize: 13 }}>Pieces / Quantity<input type="text" inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value)} disabled={saving} /></label><label style={{ display: 'grid', gap: 6, fontWeight: 700, fontSize: 13 }}>Rate<input type="text" inputMode="decimal" value={rate} onChange={(event) => setRate(event.target.value)} disabled={saving} /></label></div>
          <div style={{ padding: 14, borderRadius: 14, background: 'linear-gradient(145deg,#eff6ff,#ecfeff)', border: '1px solid #bae6fd' }}><div style={{ color: '#475569', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em' }}>Live Total</div><div style={{ marginTop: 4, fontSize: 28, fontWeight: 950, letterSpacing: '-.04em' }}>{total}</div><div style={{ marginTop: 3, color: '#64748b', fontSize: 11 }}>Quantity × Rate · exact decimal</div></div>
          <label style={{ display: 'grid', gap: 6, fontWeight: 700, fontSize: 13 }}>Special Note <span style={{ color: '#94a3b8', fontWeight: 500 }}>(optional)</span><textarea value={specialNote} onChange={(event) => setSpecialNote(event.target.value)} maxLength={2000} rows={3} disabled={saving} /></label>
          {validationError && <p role="alert" style={{ margin: 0, color: '#b91c1c', fontSize: 13, fontWeight: 700 }}>{validationError}</p>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}><button type="button" onClick={resetAndClose} disabled={saving} style={{ minHeight: 46, borderRadius: 13 }}>Cancel</button><button type="submit" disabled={saving} style={{ minHeight: 46, borderRadius: 13, fontWeight: 900 }}>{saving ? 'Saving…' : 'Save Entry'}</button></div>
        </form>
      </section>

      {sizePickerOpen && (
        <div className="work-size-picker-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeSizePicker(); }}>
          <section className="work-size-picker-panel" role="dialog" aria-modal="true" aria-labelledby="work-size-picker-title">
            <div style={{ width: 42, height: 4, borderRadius: 999, background: '#cbd5e1', margin: '0 auto 14px' }} aria-hidden="true" />
            <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div><h3 id="work-size-picker-title" style={{ margin: 0, fontSize: 20, letterSpacing: '-.025em' }}>Choose sizes</h3><p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 12 }}>Optional · select any combination or add custom values.</p></div>
              <button className="work-size-picker-control" type="button" onClick={closeSizePicker} aria-label="Close size selector" style={{ width: 44, fontSize: 20 }}>×</button>
            </header>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>{sizes.map((value) => <span key={value} style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 9px', borderRadius: 999, background: '#eef2ff', color: '#3730a3', fontSize: 12, fontWeight: 800 }}>{value}</span>)}</div>
            <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>
              <button className="work-size-option" type="button" data-selected={!sizes.length} onClick={clearSizes}>No size</button>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
                {WORK_ENTRY_SIZE_OPTIONS.map((option) => { const selected = sizes.includes(option); return <button key={option} className="work-size-option" type="button" data-selected={selected} onClick={() => toggleSize(option)} aria-pressed={selected}>{selected ? '✓ ' : ''}{option}</button>; })}
              </div>
              <div style={{ marginTop: 6, paddingTop: 14, borderTop: '1px solid #e2e8f0' }}>
                <label htmlFor="custom-work-entry-size" style={{ display: 'block', marginBottom: 7, fontSize: 13, fontWeight: 800 }}>Custom size</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                  <input id="custom-work-entry-size" ref={customSizeInputRef} className="work-size-custom-input" value={customSize} onChange={(event) => setCustomSize(event.target.value)} maxLength={MAX_WORK_ENTRY_SIZE_LENGTH} placeholder="e.g. 40/120 or 40 × 120" onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addCustomSize(); } }} />
                  <button className="work-size-picker-control" type="button" onClick={addCustomSize} disabled={!customSize.trim()} style={{ padding: '0 16px', fontWeight: 900 }}>Add</button>
                </div>
              </div>
              {!!sizes.length && <button className="work-size-picker-control" type="button" onClick={clearSizes} style={{ marginTop: 4, fontWeight: 900 }}>Clear all</button>}
              <button className="work-size-picker-control" type="button" onClick={closeSizePicker} style={{ marginTop: 4, fontWeight: 900 }}>Done</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
