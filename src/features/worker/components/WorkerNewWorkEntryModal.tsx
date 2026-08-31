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
const overlayStyle = { position: 'fixed' as const, inset: 0, zIndex: 1300, display: 'grid', placeItems: 'center', padding: 10, background: 'rgba(15,23,42,.48)', backdropFilter: 'blur(8px)' };

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
        .new-entry-surface{position:relative;width:100%;max-width:560px;max-height:calc(100dvh - 20px);overflow-y:auto;box-sizing:border-box;border:1px solid rgba(79,142,160,.22);border-radius:20px;background:linear-gradient(180deg,#ffffff 0%,#fbfdfe 48%,#eef5f7 100%);padding:13px 14px calc(14px + env(safe-area-inset-bottom));color:#172033;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-shadow:inset 0 2px 0 rgba(255,255,255,.99),inset 0 -2px 0 rgba(100,116,139,.1),0 2px 0 rgba(255,255,255,.96),0 5px 0 rgba(148,163,184,.14),0 10px 24px rgba(15,23,42,.14),0 22px 46px rgba(15,23,42,.13);}\
        .new-entry-surface::before{content:"";position:absolute;left:10px;right:10px;top:1px;height:1px;border-radius:99px;background:rgba(255,255,255,.98);box-shadow:0 1px 7px rgba(255,255,255,.9);pointer-events:none;}\
        .new-entry-surface form{gap:9px!important;margin-top:12px!important;}\
        .new-entry-header{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;}\
        .new-entry-kicker{color:#527083;font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;line-height:1.2;text-shadow:0 1px 0 #fff;}\
        .new-entry-title{margin:4px 0 0;font-size:21px;line-height:1.05;font-weight:950;letter-spacing:-.035em;color:#172033;text-shadow:0 -1px 0 #fff,0 1px 0 rgba(100,116,139,.2),0 3px 5px rgba(15,23,42,.08);}\
        .new-entry-close{min-width:34px!important;min-height:34px!important;border:1px solid rgba(100,116,139,.25)!important;border-radius:10px!important;background:linear-gradient(180deg,#fff,#eaf1f3)!important;color:#475569;font:inherit;font-size:18px;line-height:1;cursor:pointer;box-shadow:inset 0 1px 0 #fff,0 2px 0 rgba(148,163,184,.2),0 4px 8px rgba(15,23,42,.08);transition:transform .12s ease,box-shadow .12s ease;}\
        .new-entry-close:hover:not(:disabled){transform:translateY(-1px);box-shadow:inset 0 1px 0 #fff,0 3px 0 rgba(148,163,184,.18),0 6px 10px rgba(15,23,42,.1);}\
        .new-entry-close:active:not(:disabled){transform:translateY(1px);box-shadow:inset 0 2px 4px rgba(15,23,42,.12),0 1px 0 #fff;}\
        .new-entry-close:focus-visible{outline:3px solid rgba(20,184,166,.18);outline-offset:2px;}\
        .new-entry-field{display:grid!important;gap:4px!important;min-width:0;}\
        .new-entry-field-label{font-size:11px;font-weight:850;color:#334155;line-height:1.2;}\
        .new-entry-control{width:100%;min-width:0;min-height:42px;box-sizing:border-box;border:1px solid rgba(71,112,127,.24);border-radius:11px;padding:0 10px;background:linear-gradient(180deg,#ffffff 0%,#fafdfe 48%,#edf5f7 100%);color:#172033;font:inherit;font-size:13px;font-weight:750;outline:none;box-shadow:inset 0 2px 0 rgba(255,255,255,.98),inset 0 -2px 4px rgba(100,116,139,.08),0 2px 0 rgba(255,255,255,.9),0 3px 7px rgba(15,23,42,.075);transition:transform .13s ease,box-shadow .13s ease,border-color .13s ease;}\
        .new-entry-control:hover:not(:disabled){transform:translateY(-1px);box-shadow:inset 0 2px 0 #fff,inset 0 -2px 4px rgba(100,116,139,.07),0 3px 0 #fff,0 5px 10px rgba(15,23,42,.09);}\
        .new-entry-control:focus-visible{border-color:rgba(13,148,136,.58);box-shadow:0 0 0 3px rgba(20,184,166,.14),inset 0 2px 0 #fff,inset 0 -2px 4px rgba(100,116,139,.07),0 4px 9px rgba(15,23,42,.1);}\
        .new-entry-control:active:not(:disabled){transform:translateY(1px);}\
        .new-entry-control:disabled{cursor:not-allowed;opacity:.62;background:linear-gradient(180deg,#f7fafb,#e8eef1);}\
        .new-entry-context{min-height:42px;box-sizing:border-box;padding:10px 11px;border:1px solid rgba(148,163,184,.2);border-radius:11px;background:linear-gradient(180deg,#fbfdfe,#eef3f5);color:#334155;box-shadow:inset 0 1px 0 #fff,inset 0 -1px 0 rgba(100,116,139,.08),0 2px 5px rgba(15,23,42,.05);}\
        .new-entry-size-trigger{min-height:42px!important;padding:0 10px!important;border:1px solid rgba(71,112,127,.24)!important;border-radius:11px!important;background:linear-gradient(180deg,#fff,#fafdfe 48%,#edf5f7)!important;color:#94a3b8;font:inherit;font-size:13px;font-weight:750;text-align:left;box-shadow:inset 0 2px 0 #fff,inset 0 -2px 4px rgba(100,116,139,.08),0 2px 0 #fff,0 3px 7px rgba(15,23,42,.075)!important;transition:transform .13s ease,box-shadow .13s ease,border-color .13s ease;}\
        .new-entry-size-trigger:hover:not(:disabled){transform:translateY(-1px);}\
        .new-entry-size-trigger:focus-visible{outline:3px solid rgba(20,184,166,.14);outline-offset:2px;border-color:rgba(13,148,136,.58)!important;}\
        .new-entry-total{padding:10px 11px!important;border-radius:12px!important;background:linear-gradient(145deg,#f2f9ff,#e9fbfa)!important;border:1px solid rgba(56,189,248,.28)!important;box-shadow:inset 0 2px 0 rgba(255,255,255,.98),inset 0 -2px 0 rgba(13,148,136,.08),0 2px 0 rgba(255,255,255,.9),0 4px 9px rgba(14,116,144,.08);}\
        .new-entry-total-value{margin-top:2px!important;font-size:24px!important;font-weight:950;letter-spacing:-.04em;color:#123b50;text-shadow:0 1px 0 #fff,0 2px 2px rgba(15,23,42,.1);}\
        .new-entry-note{min-height:68px;box-sizing:border-box;padding:9px 10px;border:1px solid rgba(71,112,127,.24);border-radius:11px;background:linear-gradient(180deg,#fff,#fafdfe 48%,#edf5f7);color:#172033;font:inherit;font-size:13px;line-height:1.4;resize:vertical;outline:none;box-shadow:inset 0 2px 0 #fff,inset 0 -2px 4px rgba(100,116,139,.08),0 2px 0 #fff,0 3px 7px rgba(15,23,42,.075);}\
        .new-entry-note:focus-visible{border-color:rgba(13,148,136,.58);box-shadow:0 0 0 3px rgba(20,184,166,.14),inset 0 2px 0 #fff,inset 0 -2px 4px rgba(100,116,139,.07),0 4px 9px rgba(15,23,42,.1);}\
        .new-entry-error{margin:0!important;padding:7px 9px;border:1px solid rgba(239,68,68,.2);border-radius:9px;background:#fff7f7;color:#b91c1c;font-size:11px;line-height:1.35;font-weight:750;}\
        .new-entry-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:1px;}\
        .new-entry-action{min-height:40px;border-radius:10px;padding:0 11px;border:1px solid rgba(100,116,139,.27);font:inherit;font-size:12px;font-weight:900;cursor:pointer;outline:none;transition:transform .13s ease,box-shadow .13s ease,opacity .13s ease;}\
        .new-entry-action:hover:not(:disabled){transform:translateY(-2px);}\
        .new-entry-action:active:not(:disabled){transform:translateY(1px) scale(.985);}\
        .new-entry-action:focus-visible{outline:3px solid rgba(20,184,166,.16);outline-offset:2px;}\
        .new-entry-cancel{background:linear-gradient(180deg,#fff,#f7fafb 52%,#e8eef1);color:#334155;box-shadow:inset 0 2px 0 #fff,inset 0 -2px 0 rgba(100,116,139,.1),0 2px 0 #fff,0 4px 8px rgba(15,23,42,.08);}\
        .new-entry-save{border-color:rgba(14,116,144,.5);background:linear-gradient(180deg,#e8fbfb 0%,#bfe9e8 48%,#79c8c8 100%);color:#0b3f4d;box-shadow:inset 0 2px 0 rgba(255,255,255,.96),inset 0 -3px 0 rgba(13,116,144,.18),0 2px 0 rgba(255,255,255,.82),0 5px 10px rgba(15,118,110,.15);}\
        .new-entry-save:hover:not(:disabled){box-shadow:inset 0 2px 0 #fff,inset 0 -3px 0 rgba(13,116,144,.2),0 3px 0 rgba(255,255,255,.86),0 7px 13px rgba(15,118,110,.19);}\
        .new-entry-action:disabled{cursor:not-allowed;opacity:.58;transform:none;box-shadow:inset 0 1px 0 rgba(255,255,255,.8),0 2px 5px rgba(15,23,42,.06);}\
        @media (max-width:360px){.new-entry-surface{padding:11px 11px calc(12px + env(safe-area-inset-bottom));border-radius:18px}.new-entry-surface form{gap:8px!important}.new-entry-title{font-size:20px}.new-entry-control,.new-entry-context,.new-entry-size-trigger{min-height:40px!important}.new-entry-note{min-height:62px}.new-entry-actions{gap:7px}.new-entry-action{min-height:38px;padding:0 9px}}\
        @media (min-width:700px){.new-entry-surface{max-width:540px;padding:15px 16px 17px}}\
        @media (prefers-reduced-motion:reduce){.new-entry-close,.new-entry-control,.new-entry-size-trigger,.new-entry-action{transition:none}}\
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
      <section className="new-entry-surface" role="dialog" aria-modal="true" aria-labelledby="new-work-entry-title">
        <header className="new-entry-header"><div><div className="new-entry-kicker">My Work</div><h2 id="new-work-entry-title" className="new-entry-title">New Entry</h2></div><button type="button" onClick={resetAndClose} disabled={saving} aria-label="Close New Entry" className="new-entry-close">×</button></header>
        <form onSubmit={submit} style={{ display: 'grid' }}>
          <label className="new-entry-field"><span className="new-entry-field-label">Work context</span><div className="new-entry-context">My Work</div></label>
          <label className="new-entry-field"><span className="new-entry-field-label">Item Name</span><input className="new-entry-control" value={itemName} onChange={(event) => setItemName(event.target.value)} maxLength={200} autoFocus disabled={saving} /></label>
          <div className="new-entry-field">
            <label htmlFor="work-entry-size-trigger" className="new-entry-field-label">Size <span style={{ color: '#94a3b8', fontWeight: 600 }}>(optional)</span></label>
            <button id="work-entry-size-trigger" ref={sizeTriggerRef} type="button" disabled={saving} onClick={() => setSizePickerOpen(true)} aria-haspopup="dialog" aria-expanded={sizePickerOpen} className="new-entry-size-trigger" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, color: sizes.length ? '#172033' : '#94a3b8', cursor: saving ? 'not-allowed' : 'pointer' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sizeSummary}</span>
              <span aria-hidden="true" style={{ color: '#527083', fontSize: 17, lineHeight: 1 }}>⌄</span>
            </button>
            {!!sizes.length && <div aria-label="Selected sizes" style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{sizes.map((value) => <span key={value} style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, background: '#e8f7f8', color: '#155e75', fontSize: 11, fontWeight: 850, boxShadow: 'inset 0 1px 0 #fff,0 1px 3px rgba(15,118,110,.08)' }}>{value}</span>)}</div>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}><label className="new-entry-field"><span className="new-entry-field-label">Pieces / Quantity</span><input className="new-entry-control" type="text" inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value)} disabled={saving} /></label><label className="new-entry-field"><span className="new-entry-field-label">Rate</span><input className="new-entry-control" type="text" inputMode="decimal" value={rate} onChange={(event) => setRate(event.target.value)} disabled={saving} /></label></div>
          <div className="new-entry-total"><div style={{ color: '#527083', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.08em' }}>Live Total</div><div className="new-entry-total-value">{total}</div><div style={{ marginTop: 1, color: '#64748b', fontSize: 10 }}>Quantity × Rate · exact decimal</div></div>
          <label className="new-entry-field"><span className="new-entry-field-label">Special Note <span style={{ color: '#94a3b8', fontWeight: 500 }}>(optional)</span></span><textarea className="new-entry-note" value={specialNote} onChange={(event) => setSpecialNote(event.target.value)} maxLength={2000} rows={3} disabled={saving} /></label>
          {validationError && <p role="alert" className="new-entry-error">{validationError}</p>}
          <div className="new-entry-actions"><button type="button" onClick={resetAndClose} disabled={saving} className="new-entry-action new-entry-cancel">Cancel</button><button type="submit" disabled={saving} className="new-entry-action new-entry-save">{saving ? 'Saving…' : 'Save Entry'}</button></div>
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
