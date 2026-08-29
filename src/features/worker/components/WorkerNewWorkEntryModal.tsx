import { useMemo, useState } from 'react';
import { calculateWorkEntryTotal } from '../logic/workEntryCalculations';

interface WorkerNewWorkEntryModalProps {
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (input: { item_name: string; size: string; quantity: number; rate: number; special_note: string | null }) => Promise<{ error: unknown } | { error: null }>;
}

const overlayStyle = {
  position: 'fixed' as const,
  inset: 0,
  zIndex: 1300,
  display: 'grid',
  placeItems: 'center',
  padding: 14,
  background: 'rgba(15,23,42,.58)',
  backdropFilter: 'blur(8px)',
};

export function WorkerNewWorkEntryModal({ open, saving, onClose, onSave }: WorkerNewWorkEntryModalProps) {
  const [itemName, setItemName] = useState('');
  const [size, setSize] = useState('');
  const [quantity, setQuantity] = useState('');
  const [rate, setRate] = useState('');
  const [specialNote, setSpecialNote] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const total = useMemo(() => calculateWorkEntryTotal(Number(quantity), Number(rate)), [quantity, rate]);

  if (!open) return null;

  const resetAndClose = () => {
    if (saving) return;
    setItemName('');
    setSize('');
    setQuantity('');
    setRate('');
    setSpecialNote('');
    setValidationError(null);
    onClose();
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const numericQuantity = Number(quantity);
    const numericRate = Number(rate);

    if (!itemName.trim()) return setValidationError('Item Name is required.');
    if (!size.trim()) return setValidationError('Size is required.');
    if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) return setValidationError('Quantity must be greater than zero.');
    if (!Number.isFinite(numericRate) || numericRate < 0) return setValidationError('Rate must be zero or greater.');

    setValidationError(null);
    const result = await onSave({
      item_name: itemName,
      size,
      quantity: numericQuantity,
      rate: numericRate,
      special_note: specialNote.trim() || null,
    });

    if (!result.error) resetAndClose();
  };

  return (
    <div style={overlayStyle} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) resetAndClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="new-work-entry-title" style={{ width: '100%', maxWidth: 560, maxHeight: 'calc(100dvh - 28px)', overflowY: 'auto', borderRadius: 22, background: '#fff', boxShadow: '0 24px 70px rgba(15,23,42,.3)', padding: 18, boxSizing: 'border-box' }}>
        <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ color: '#64748b', fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>My Work</div>
            <h2 id="new-work-entry-title" style={{ margin: '5px 0 0', fontSize: 24, letterSpacing: '-.035em' }}>New Entry</h2>
          </div>
          <button type="button" onClick={resetAndClose} disabled={saving} aria-label="Close New Entry" style={{ minWidth: 40, minHeight: 40, borderRadius: 12, cursor: saving ? 'not-allowed' : 'pointer' }}>×</button>
        </header>

        <form onSubmit={submit} style={{ display: 'grid', gap: 12, marginTop: 18 }}>
          <label style={{ display: 'grid', gap: 6, fontWeight: 700, fontSize: 13 }}>
            Work context
            <div style={{ padding: '11px 12px', borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155' }}>My Work</div>
          </label>

          <label style={{ display: 'grid', gap: 6, fontWeight: 700, fontSize: 13 }}>
            Item Name
            <input value={itemName} onChange={(event) => setItemName(event.target.value)} maxLength={200} autoFocus disabled={saving} />
          </label>

          <label style={{ display: 'grid', gap: 6, fontWeight: 700, fontSize: 13 }}>
            Size
            <input value={size} onChange={(event) => setSize(event.target.value)} maxLength={100} disabled={saving} />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={{ display: 'grid', gap: 6, fontWeight: 700, fontSize: 13 }}>
              Pieces / Quantity
              <input type="number" inputMode="decimal" min="0.0001" step="0.0001" value={quantity} onChange={(event) => setQuantity(event.target.value)} disabled={saving} />
            </label>
            <label style={{ display: 'grid', gap: 6, fontWeight: 700, fontSize: 13 }}>
              Rate
              <input type="number" inputMode="decimal" min="0" step="0.0001" value={rate} onChange={(event) => setRate(event.target.value)} disabled={saving} />
            </label>
          </div>

          <div style={{ padding: 14, borderRadius: 14, background: 'linear-gradient(145deg,#eff6ff,#ecfeff)', border: '1px solid #bae6fd' }}>
            <div style={{ color: '#475569', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em' }}>Live Total</div>
            <div style={{ marginTop: 4, fontSize: 28, fontWeight: 950, letterSpacing: '-.04em' }}>{total.toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
            <div style={{ marginTop: 3, color: '#64748b', fontSize: 11 }}>Quantity × Rate</div>
          </div>

          <label style={{ display: 'grid', gap: 6, fontWeight: 700, fontSize: 13 }}>
            Special Note <span style={{ color: '#94a3b8', fontWeight: 500 }}>(optional)</span>
            <textarea value={specialNote} onChange={(event) => setSpecialNote(event.target.value)} maxLength={2000} rows={3} disabled={saving} />
          </label>

          {validationError && <p role="alert" style={{ margin: 0, color: '#b91c1c', fontSize: 13, fontWeight: 700 }}>{validationError}</p>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
            <button type="button" onClick={resetAndClose} disabled={saving} style={{ minHeight: 46, borderRadius: 13, cursor: saving ? 'not-allowed' : 'pointer' }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ minHeight: 46, borderRadius: 13, cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 900 }}>{saving ? 'Saving…' : 'Save Entry'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
