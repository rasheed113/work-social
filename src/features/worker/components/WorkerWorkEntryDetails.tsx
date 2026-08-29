import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { calculateWorkEntryTotal, formatWorkDecimal } from '../logic/workEntryCalculations';
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

const DECIMAL_RE = /^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/;
const SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '28', '30', '32', '34', '36', '40'];
const overlayStyle = { position: 'fixed' as const, inset: 0, zIndex: 1250, display: 'grid', placeItems: 'center', padding: 14, background: 'rgba(15,23,42,.58)', backdropFilter: 'blur(8px)' };
function formatDate(value: string) { return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }

export function WorkerWorkEntryDetails({ entry, versions, versionsLoading, actionError, onClose, onEdit, onDeleteForMe }: WorkerWorkEntryDetailsProps) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [itemName, setItemName] = useState('');
  const [size, setSize] = useState('');
  const [sizePickerOpen, setSizePickerOpen] = useState(false);
  const [customSize, setCustomSize] = useState('');
  const [quantity, setQuantity] = useState('');
  const [rate, setRate] = useState('');
  const [specialNote, setSpecialNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!entry) return;
    setItemName(entry.item_name);
    setSize(entry.size ?? '');
    setCustomSize('');
    setSizePickerOpen(false);
    setQuantity(entry.quantity);
    setRate(entry.rate);
    setSpecialNote(entry.special_note ?? '');
    setEditing(false);
    setConfirmDelete(false);
  }, [entry]);

  useEffect(() => {
    if (!sizePickerOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSizePickerOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sizePickerOpen]);

  const liveTotal = useMemo(() => calculateWorkEntryTotal(quantity, rate), [quantity, rate]);
  if (!entry) return null;

  const saveEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedSize = size.trim();
    if (!itemName.trim() || normalizedSize.length > 100 || !DECIMAL_RE.test(quantity) || quantity === '0' || !DECIMAL_RE.test(rate)) return;
    setSaving(true);
    const result = await onEdit(entry.id, { item_name: itemName, size: normalizedSize || null, quantity, rate, special_note: specialNote.trim() || null });
    setSaving(false);
    if (!result.error) setEditing(false);
  };

  const deleteForMe = async () => {
    setSaving(true);
    const result = await onDeleteForMe(entry.id);
    setSaving(false);
    if (!result.error) onClose();
  };

  const chooseSize = (value: string) => {
    setSize(value);
    setCustomSize('');
    setSizePickerOpen(false);
  };

  const clearSize = () => {
    setSize('');
    setCustomSize('');
    setSizePickerOpen(false);
  };

  const addCustomSize = () => {
    const normalized = customSize.trim();
    if (!normalized) return;
    setSize(normalized);
    setCustomSize('');
    setSizePickerOpen(false);
  };

  return (
    <div style={overlayStyle} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="work-entry-details-title" style={{ width: '100%', maxWidth: 620, maxHeight: 'calc(100dvh - 28px)', overflowY: 'auto', borderRadius: 22, background: '#fff', boxShadow: '0 24px 70px rgba(15,23,42,.3)', padding: 18, boxSizing: 'border-box' }}>
        <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}><div><div style={{ color: '#64748b', fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>My Work · Details</div><h2 id="work-entry-details-title" style={{ margin: '5px 0 0', fontSize: 24, letterSpacing: '-.035em' }}>{entry.item_name}</h2>{versions.length > 1 && <div style={{ marginTop: 5, display: 'inline-flex', padding: '4px 8px', borderRadius: 999, background: '#fef3c7', color: '#92400e', fontSize: 11, fontWeight: 800 }}>Edited</div>}</div><button type="button" onClick={onClose} disabled={saving} aria-label="Close details" style={{ minWidth: 40, minHeight: 40, borderRadius: 12 }}>×</button></header>
        {editing ? (
          <form onSubmit={saveEdit} style={{ display: 'grid', gap: 11, marginTop: 18 }}>
            <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700 }}>Item Name<input value={itemName} onChange={(event) => setItemName(event.target.value)} maxLength={200} disabled={saving} /></label>
            <div style={{ display: 'grid', gap: 6 }}>
              <label htmlFor="edit-work-entry-size-trigger" style={{ fontSize: 13, fontWeight: 700 }}>Size <span style={{ color: '#94a3b8', fontWeight: 600 }}>(optional)</span></label>
              <button id="edit-work-entry-size-trigger" type="button" disabled={saving} onClick={() => setSizePickerOpen(true)} aria-haspopup="dialog" aria-expanded={sizePickerOpen} style={{ minHeight: 48, width: '100%', padding: '0 13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderRadius: 14, border: '1px solid #cbd5e1', background: '#fff', color: size ? '#0f172a' : '#94a3b8', font: 'inherit', fontWeight: 750, textAlign: 'left', cursor: saving ? 'not-allowed' : 'pointer' }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{size || 'Optional — Select size'}</span><span aria-hidden="true">⌄</span></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700 }}>Quantity<input type="text" inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value)} disabled={saving} /></label><label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700 }}>Rate<input type="text" inputMode="decimal" value={rate} onChange={(event) => setRate(event.target.value)} disabled={saving} /></label></div>
            <div style={{ padding: 12, borderRadius: 13, background: '#f8fafc', border: '1px solid #e2e8f0' }}><strong>Live Total:</strong> {formatWorkDecimal(liveTotal)}</div>
            <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700 }}>Special Note<textarea value={specialNote} onChange={(event) => setSpecialNote(event.target.value)} maxLength={2000} rows={3} disabled={saving} /></label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><button type="button" onClick={() => setEditing(false)} disabled={saving} style={{ minHeight: 44, borderRadius: 12 }}>Cancel</button><button type="submit" disabled={saving} style={{ minHeight: 44, borderRadius: 12, fontWeight: 900 }}>{saving ? 'Saving…' : 'Save Edit'}</button></div>
          </form>
        ) : (
          <>
            <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, margin: '20px 0 0' }}><div><dt style={{ color: '#64748b', fontSize: 11, fontWeight: 800 }}>Size</dt><dd style={{ margin: '3px 0 0', fontWeight: 700 }}>{entry.size || 'No size'}</dd></div><div><dt style={{ color: '#64748b', fontSize: 11, fontWeight: 800 }}>Quantity</dt><dd style={{ margin: '3px 0 0', fontWeight: 700 }}>{entry.quantity}</dd></div><div><dt style={{ color: '#64748b', fontSize: 11, fontWeight: 800 }}>Rate</dt><dd style={{ margin: '3px 0 0', fontWeight: 700 }}>{formatWorkDecimal(entry.rate)}</dd></div><div><dt style={{ color: '#64748b', fontSize: 11, fontWeight: 800 }}>Total</dt><dd style={{ margin: '3px 0 0', fontWeight: 900 }}>{formatWorkDecimal(entry.total)}</dd></div><div style={{ gridColumn: '1 / -1' }}><dt style={{ color: '#64748b', fontSize: 11, fontWeight: 800 }}>Date / time</dt><dd style={{ margin: '3px 0 0', fontWeight: 700 }}>{formatDate(entry.occurred_at)}</dd></div><div style={{ gridColumn: '1 / -1' }}><dt style={{ color: '#64748b', fontSize: 11, fontWeight: 800 }}>Work context</dt><dd style={{ margin: '3px 0 0', fontWeight: 700 }}>My Work</dd></div><div style={{ gridColumn: '1 / -1' }}><dt style={{ color: '#64748b', fontSize: 11, fontWeight: 800 }}>Special Note</dt><dd style={{ margin: '3px 0 0', whiteSpace: 'pre-wrap', color: entry.special_note ? '#0f172a' : '#94a3b8' }}>{entry.special_note || 'No special note.'}</dd></div></dl>
            <section style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #e2e8f0' }} aria-labelledby="work-entry-history-title"><h3 id="work-entry-history-title" style={{ margin: 0, fontSize: 15 }}>Audit History</h3>{versionsLoading ? <p style={{ color: '#64748b', fontSize: 13 }}>Loading revision history…</p> : versions.length ? <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>{versions.map((version) => <div key={version.id} style={{ padding: 10, borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 12 }}><strong>Revision {version.revision_no}</strong> · {version.quantity} × {formatWorkDecimal(version.rate)} = {formatWorkDecimal(version.total)} · {formatDate(version.recorded_at)}</div>)}</div> : <p style={{ color: '#64748b', fontSize: 13 }}>No revision history is available.</p>}</section>
            {actionError && <p role="alert" style={{ color: '#b91c1c', fontSize: 13, fontWeight: 700 }}>{actionError}</p>}
            {confirmDelete ? <section style={{ marginTop: 18, padding: 14, borderRadius: 14, background: '#fff7ed', border: '1px solid #fed7aa' }}><strong style={{ display: 'block' }}>Delete for me?</strong><p style={{ margin: '6px 0 12px', color: '#7c2d12', fontSize: 12, lineHeight: 1.5 }}>This hides the entry from your Work view. The canonical Work Entry is not destroyed.</p><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}><button type="button" onClick={() => setConfirmDelete(false)} disabled={saving} style={{ minHeight: 42, borderRadius: 11 }}>Cancel</button><button type="button" onClick={() => void deleteForMe()} disabled={saving} style={{ minHeight: 42, borderRadius: 11, fontWeight: 900 }}>{saving ? 'Hiding…' : 'Delete for me'}</button></div></section> : <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginTop: 18 }}><button type="button" onClick={() => setEditing(true)} style={{ minHeight: 44, borderRadius: 12, fontWeight: 800 }}>Edit</button><button type="button" onClick={() => setConfirmDelete(true)} style={{ minHeight: 44, borderRadius: 12, fontWeight: 800 }}>Delete</button></div>}
          </>
        )}
      </section>

      {sizePickerOpen && editing && (
        <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSizePickerOpen(false); }} style={{ position: 'fixed', inset: 0, zIndex: 1350, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 0, background: 'rgba(15,23,42,.38)', backdropFilter: 'blur(5px)' }}>
          <section role="dialog" aria-modal="true" aria-labelledby="edit-size-picker-title" style={{ width: '100%', maxWidth: 460, maxHeight: '78dvh', overflowY: 'auto', boxSizing: 'border-box', borderRadius: '24px 24px 0 0', background: '#fff', boxShadow: '0 -18px 60px rgba(15,23,42,.2)', padding: '10px 16px calc(18px + env(safe-area-inset-bottom))' }}>
            <div style={{ width: 42, height: 4, borderRadius: 999, background: '#cbd5e1', margin: '0 auto 14px' }} aria-hidden="true" />
            <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}><div><h3 id="edit-size-picker-title" style={{ margin: 0, fontSize: 20 }}>Choose a size</h3><p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 12 }}>Optional · pick a shortcut or enter your own.</p></div><button type="button" onClick={() => setSizePickerOpen(false)} aria-label="Close size selector" style={{ minWidth: 44, minHeight: 44, borderRadius: 13, fontSize: 20 }}>×</button></header>
            <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>
              <button type="button" onClick={clearSize} aria-pressed={!size} style={{ minHeight: 48, borderRadius: 14, border: '1px solid #e2e8f0', background: !size ? '#eef2ff' : '#fff', color: !size ? '#3730a3' : '#0f172a', font: 'inherit', fontWeight: 800, textAlign: 'left', padding: '0 14px' }}>No size</button>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>{SIZE_OPTIONS.map((option) => <button key={option} type="button" onClick={() => chooseSize(option)} aria-pressed={size === option} style={{ minHeight: 48, borderRadius: 14, border: `1px solid ${size === option ? '#4f46e5' : '#e2e8f0'}`, background: size === option ? '#eef2ff' : '#fff', color: size === option ? '#3730a3' : '#0f172a', font: 'inherit', fontWeight: 800 }}>{option}</button>)}</div>
              <div style={{ marginTop: 6, paddingTop: 14, borderTop: '1px solid #e2e8f0' }}><label htmlFor="edit-custom-work-entry-size" style={{ display: 'block', marginBottom: 7, fontSize: 13, fontWeight: 800 }}>Custom size</label><div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}><input id="edit-custom-work-entry-size" value={customSize} onChange={(event) => setCustomSize(event.target.value)} maxLength={100} placeholder="e.g. 40/120 or 40 × 120" style={{ width: '100%', minHeight: 48, boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: 14, padding: '0 13px', font: 'inherit' }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addCustomSize(); } }} /><button type="button" onClick={addCustomSize} disabled={!customSize.trim()} style={{ minHeight: 48, padding: '0 16px', borderRadius: 14, fontWeight: 900 }}>Use</button></div></div>
              <button type="button" onClick={() => setSizePickerOpen(false)} style={{ minHeight: 48, marginTop: 4, borderRadius: 14, fontWeight: 900 }}>Done</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
