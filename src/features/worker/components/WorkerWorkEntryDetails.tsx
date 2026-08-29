import { useEffect, useMemo, useState } from 'react';
import { calculateWorkEntryTotal } from '../logic/workEntryCalculations';
import type { WorkEntry, WorkEntryUpdateInput, WorkEntryVersion } from '../types/workEntry';

interface WorkerWorkEntryDetailsProps {
  entry: WorkEntry | null;
  versions: WorkEntryVersion[];
  versionsLoading: boolean;
  actionError: string | null;
  onClose: () => void;
  onEdit: (entryId: string, input: WorkEntryUpdateInput) => Promise<{ error: unknown } | { error: null }>;
  onDeleteForMe: (entryId: string) => Promise<{ error: unknown } | { error: null }>;
}

const overlayStyle = {
  position: 'fixed' as const,
  inset: 0,
  zIndex: 1250,
  display: 'grid',
  placeItems: 'center',
  padding: 14,
  background: 'rgba(15,23,42,.58)',
  backdropFilter: 'blur(8px)',
};

function formatAmount(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(value);
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function WorkerWorkEntryDetails({ entry, versions, versionsLoading, actionError, onClose, onEdit, onDeleteForMe }: WorkerWorkEntryDetailsProps) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [itemName, setItemName] = useState('');
  const [size, setSize] = useState('');
  const [quantity, setQuantity] = useState('');
  const [rate, setRate] = useState('');
  const [specialNote, setSpecialNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!entry) return;
    setItemName(entry.item_name);
    setSize(entry.size);
    setQuantity(String(entry.quantity));
    setRate(String(entry.rate));
    setSpecialNote(entry.special_note ?? '');
    setEditing(false);
    setConfirmDelete(false);
  }, [entry]);

  const liveTotal = useMemo(() => calculateWorkEntryTotal(Number(quantity), Number(rate)), [quantity, rate]);
  if (!entry) return null;

  const saveEdit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const numericQuantity = Number(quantity);
    const numericRate = Number(rate);
    if (!itemName.trim() || !size.trim() || !Number.isFinite(numericQuantity) || numericQuantity <= 0 || !Number.isFinite(numericRate) || numericRate < 0) return;

    setSaving(true);
    const result = await onEdit(entry.id, {
      item_name: itemName,
      size,
      quantity: numericQuantity,
      rate: numericRate,
      special_note: specialNote.trim() || null,
    });
    setSaving(false);
    if (!result.error) setEditing(false);
  };

  const deleteForMe = async () => {
    setSaving(true);
    const result = await onDeleteForMe(entry.id);
    setSaving(false);
    if (!result.error) onClose();
  };

  return (
    <div style={overlayStyle} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="work-entry-details-title" style={{ width: '100%', maxWidth: 620, maxHeight: 'calc(100dvh - 28px)', overflowY: 'auto', borderRadius: 22, background: '#fff', boxShadow: '0 24px 70px rgba(15,23,42,.3)', padding: 18, boxSizing: 'border-box' }}>
        <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ color: '#64748b', fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>My Work · Details</div>
            <h2 id="work-entry-details-title" style={{ margin: '5px 0 0', fontSize: 24, letterSpacing: '-.035em' }}>{entry.item_name}</h2>
            {versions.length > 1 && <div style={{ marginTop: 5, display: 'inline-flex', padding: '4px 8px', borderRadius: 999, background: '#fef3c7', color: '#92400e', fontSize: 11, fontWeight: 800 }}>Edited</div>}
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close details" style={{ minWidth: 40, minHeight: 40, borderRadius: 12 }}>×</button>
        </header>

        {editing ? (
          <form onSubmit={saveEdit} style={{ display: 'grid', gap: 11, marginTop: 18 }}>
            <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700 }}>Item Name<input value={itemName} onChange={(event) => setItemName(event.target.value)} maxLength={200} disabled={saving} /></label>
            <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700 }}>Size<input value={size} onChange={(event) => setSize(event.target.value)} maxLength={100} disabled={saving} /></label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700 }}>Quantity<input type="number" min="0.0001" step="0.0001" value={quantity} onChange={(event) => setQuantity(event.target.value)} disabled={saving} /></label>
              <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700 }}>Rate<input type="number" min="0" step="0.0001" value={rate} onChange={(event) => setRate(event.target.value)} disabled={saving} /></label>
            </div>
            <div style={{ padding: 12, borderRadius: 13, background: '#f8fafc', border: '1px solid #e2e8f0' }}><strong>Live Total:</strong> {formatAmount(liveTotal)}</div>
            <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700 }}>Special Note<textarea value={specialNote} onChange={(event) => setSpecialNote(event.target.value)} maxLength={2000} rows={3} disabled={saving} /></label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button type="button" onClick={() => setEditing(false)} disabled={saving} style={{ minHeight: 44, borderRadius: 12 }}>Cancel</button>
              <button type="submit" disabled={saving} style={{ minHeight: 44, borderRadius: 12, fontWeight: 900 }}>{saving ? 'Saving…' : 'Save Edit'}</button>
            </div>
          </form>
        ) : (
          <>
            <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, margin: '20px 0 0' }}>
              <div><dt style={{ color: '#64748b', fontSize: 11, fontWeight: 800 }}>Size</dt><dd style={{ margin: '3px 0 0', fontWeight: 700 }}>{entry.size}</dd></div>
              <div><dt style={{ color: '#64748b', fontSize: 11, fontWeight: 800 }}>Quantity</dt><dd style={{ margin: '3px 0 0', fontWeight: 700 }}>{entry.quantity}</dd></div>
              <div><dt style={{ color: '#64748b', fontSize: 11, fontWeight: 800 }}>Rate</dt><dd style={{ margin: '3px 0 0', fontWeight: 700 }}>{formatAmount(entry.rate)}</dd></div>
              <div><dt style={{ color: '#64748b', fontSize: 11, fontWeight: 800 }}>Total</dt><dd style={{ margin: '3px 0 0', fontWeight: 900 }}>{formatAmount(entry.total)}</dd></div>
              <div style={{ gridColumn: '1 / -1' }}><dt style={{ color: '#64748b', fontSize: 11, fontWeight: 800 }}>Date / time</dt><dd style={{ margin: '3px 0 0', fontWeight: 700 }}>{formatDate(entry.occurred_at)}</dd></div>
              <div style={{ gridColumn: '1 / -1' }}><dt style={{ color: '#64748b', fontSize: 11, fontWeight: 800 }}>Work context</dt><dd style={{ margin: '3px 0 0', fontWeight: 700 }}>My Work</dd></div>
              <div style={{ gridColumn: '1 / -1' }}><dt style={{ color: '#64748b', fontSize: 11, fontWeight: 800 }}>Special Note</dt><dd style={{ margin: '3px 0 0', whiteSpace: 'pre-wrap', color: entry.special_note ? '#0f172a' : '#94a3b8' }}>{entry.special_note || 'No special note.'}</dd></div>
            </dl>

            <section style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #e2e8f0' }} aria-labelledby="work-entry-history-title">
              <h3 id="work-entry-history-title" style={{ margin: 0, fontSize: 15 }}>Audit History</h3>
              {versionsLoading ? <p style={{ color: '#64748b', fontSize: 13 }}>Loading revision history…</p> : versions.length ? (
                <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                  {versions.map((version) => (
                    <div key={version.id} style={{ padding: 10, borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 12 }}>
                      <strong>Revision {version.revision_no}</strong> · {version.quantity} × {formatAmount(version.rate)} = {formatAmount(version.total)} · {formatDate(version.recorded_at)}
                    </div>
                  ))}
                </div>
              ) : <p style={{ color: '#64748b', fontSize: 13 }}>No revision history is available.</p>}
            </section>

            {actionError && <p role="alert" style={{ color: '#b91c1c', fontSize: 13, fontWeight: 700 }}>{actionError}</p>}

            {confirmDelete ? (
              <section style={{ marginTop: 18, padding: 14, borderRadius: 14, background: '#fff7ed', border: '1px solid #fed7aa' }}>
                <strong style={{ display: 'block' }}>Delete for me?</strong>
                <p style={{ margin: '6px 0 12px', color: '#7c2d12', fontSize: 12, lineHeight: 1.5 }}>This hides the entry from your Work view. The canonical Work Entry is not destroyed.</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
                  <button type="button" onClick={() => setConfirmDelete(false)} disabled={saving} style={{ minHeight: 42, borderRadius: 11 }}>Cancel</button>
                  <button type="button" onClick={() => void deleteForMe()} disabled={saving} style={{ minHeight: 42, borderRadius: 11, fontWeight: 900 }}>{saving ? 'Hiding…' : 'Delete for me'}</button>
                </div>
              </section>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginTop: 18 }}>
                <button type="button" onClick={() => setEditing(true)} style={{ minHeight: 44, borderRadius: 12, fontWeight: 800 }}>Edit</button>
                <button type="button" onClick={() => setConfirmDelete(true)} style={{ minHeight: 44, borderRadius: 12, fontWeight: 800 }}>Delete</button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
