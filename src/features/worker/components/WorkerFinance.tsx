import { useEffect, useMemo, useState } from 'react';
import { navigate } from '../../../app/Router';
import { getWorkerWorkEntry } from '../api/workEntries';
import { formatWorkDecimal } from '../logic/workEntryCalculations';
import { useWorkerFinance } from '../hooks/useWorkerFinance';
import type { FinanceListEntry, FinanceReceivedRecord, FinanceReceivedType } from '../types/finance';
import type { WorkEntry } from '../types/workEntry';

type Filter = 'all' | 'earnings' | 'payments' | 'advances' | 'received';
type UndoTarget = { id: string; entryType: FinanceReceivedType };
const amountRe = /^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/;
const card = { border: '1px solid rgba(99,102,241,.14)', borderRadius: 18, background: 'rgba(255,255,255,.94)', boxShadow: '0 10px 28px rgba(15,23,42,.07)' };
const button = { minHeight: 44, borderRadius: 12, border: '1px solid #cbd5e1', background: '#fff', font: 'inherit', fontWeight: 800, cursor: 'pointer' };
function dateLabel(value: string) { return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
function amountLabel(value: string) { return `Rs. ${formatWorkDecimal(value)}`; }
function filterLabel(value: Filter) { return value === 'all' ? 'All' : value === 'earnings' ? 'Earnings' : value === 'payments' ? 'Payments' : value === 'advances' ? 'Advances' : 'All Received'; }
function matchesFilter(entry: FinanceListEntry, filter: Filter) { if (filter === 'all') return true; if (filter === 'earnings') return entry.kind === 'earning'; if (filter === 'payments') return entry.kind === 'payment'; if (filter === 'advances') return entry.kind === 'advance'; return entry.kind === 'payment' || entry.kind === 'advance'; }
function amountTone(value: string): 'positive' | 'negative' | 'neutral' { const normalized = value.trim(); if (/^-0+(?:\.0+)?$/.test(normalized) || /^0+(?:\.0+)?$/.test(normalized)) return 'neutral'; return normalized.startsWith('-') ? 'negative' : 'positive'; }

export function WorkerFinance() {
  const finance = useWorkerFinance();
  const [filter, setFilter] = useState<Filter>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceReceivedRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FinanceReceivedRecord | null>(null);
  const [undoTarget, setUndoTarget] = useState<UndoTarget | null>(null);
  const [type, setType] = useState<FinanceReceivedType>('payment');
  const [amount, setAmount] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<WorkEntry | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  useEffect(() => {
    if (!modalOpen) {
      setEditing(null);
      setAmount('');
      setType('payment');
      setFormError(null);
    }
  }, [modalOpen]);

  useEffect(() => {
    if (!undoTarget) return;
    const timer = window.setTimeout(() => setUndoTarget(null), 8000);
    return () => window.clearTimeout(timer);
  }, [undoTarget]);

  const visibleEntries = useMemo(() => finance.entries.filter((entry) => matchesFilter(entry, filter)), [finance.entries, filter]);

  const openAdd = () => {
    setEditing(null);
    setType('payment');
    setAmount('');
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (record: FinanceReceivedRecord) => {
    setEditing(record);
    setType(record.entry_type);
    setAmount(record.amount);
    setFormError(null);
    setModalOpen(true);
  };

  const submit = async () => {
    const normalized = amount.trim();
    if (!normalized) {
      setFormError('Amount is required.');
      return;
    }
    if (!amountRe.test(normalized) || normalized === '0') {
      setFormError('Enter a valid amount greater than zero, with up to 4 decimal places.');
      return;
    }
    setFormError(null);
    const result = editing
      ? await finance.editReceived(editing.id, type, normalized)
      : await finance.addReceived(type, normalized);
    if (result.error) {
      setFormError(result.error.message);
      return;
    }
    setModalOpen(false);
    setNotice('Saved successfully');
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const result = await finance.removeReceived(deleteTarget.id);
    if (result.error) {
      setNotice(`Could not delete: ${result.error.message}`);
      return;
    }
    setDeleteTarget(null);
    setUndoTarget({ id: deleteTarget.id, entryType: deleteTarget.entry_type });
    setNotice(`${deleteTarget.entry_type === 'payment' ? 'Payment' : 'Advance'} deleted`);
  };

  const undoDelete = async () => {
    if (!undoTarget) return;
    const result = await finance.restoreReceived(undoTarget.id);
    if (result.error) {
      setNotice(`Could not restore: ${result.error.message}`);
      return;
    }
    setUndoTarget(null);
    setNotice('Restored successfully');
  };

  const dismissNotice = () => {
    setUndoTarget(null);
    setNotice(null);
  };

  const openDetails = async (entry: WorkEntry) => {
    setSelectedEntry(null);
    setDetailsError(null);
    setDetailsLoading(true);
    const result = await getWorkerWorkEntry(entry.id);
    setDetailsLoading(false);
    if (result.error) {
      setDetailsError(result.error.message);
      return;
    }
    if (!result.data) {
      setDetailsError('This Work Entry is no longer available.');
      return;
    }
    setSelectedEntry(result.data);
  };

  if (finance.loading) return <main style={{ width: '100%', maxWidth: 900, margin: '0 auto', padding: '24px 14px 112px', boxSizing: 'border-box' }}><p style={{ color: '#64748b' }}>Loading Finance…</p></main>;
  if (finance.error) return <main style={{ width: '100%', maxWidth: 900, margin: '0 auto', padding: '24px 14px 112px', boxSizing: 'border-box' }}><button type="button" onClick={() => navigate('/work')} style={{ ...button, padding: '0 12px' }}>← Work House</button><p role="alert" style={{ ...card, marginTop: 16, padding: 18, color: '#b91c1c', fontWeight: 750 }}>{finance.error}</p></main>;

  return <main style={{ width: '100%', maxWidth: 900, margin: '0 auto', padding: '18px 14px 112px', boxSizing: 'border-box' }}>
    <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}><div><button type="button" onClick={() => navigate('/work')} style={{ ...button, minHeight: 38, padding: '0 11px', fontSize: 13 }}>← Work House</button><div style={{ marginTop: 12, color: '#64748b', fontSize: 11, fontWeight: 850, letterSpacing: '.08em', textTransform: 'uppercase' }}>Worker Finance</div><h1 style={{ margin: '4px 0 0', fontSize: 'clamp(28px, 7vw, 42px)', letterSpacing: '-.04em' }}>Finance</h1></div><button type="button" onClick={openAdd} style={{ ...button, flex: '0 0 auto', padding: '0 15px', border: '1px solid rgba(79,70,229,.3)', background: '#4f46e5', color: '#fff', boxShadow: '0 8px 18px rgba(79,70,229,.18)' }}>+ Add</button></header>
    {notice && <div role="status" aria-live="polite" style={{ ...card, marginBottom: 12, padding: '10px 13px', color: undoTarget ? '#991b1b' : '#166534', background: undoTarget ? '#fef2f2' : '#f0fdf4', borderColor: undoTarget ? '#fecaca' : '#bbf7d0', fontSize: 13, fontWeight: 850, display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ flex: 1 }}>{notice}</span>{undoTarget && <button type="button" onClick={() => void undoDelete()} disabled={finance.saving} style={{ ...button, minHeight: 36, padding: '0 11px', color: '#991b1b', borderColor: '#fecaca', background: '#fff' }}>Undo</button>}<button type="button" onClick={dismissNotice} aria-label="Dismiss message" style={{ border: 0, background: 'transparent', fontSize: 18, cursor: 'pointer', padding: 2 }}>×</button></div>}
    <section aria-label="Finance summary" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10, marginBottom: 16 }}><SummaryCard label="Total Earnings" value={amountLabel(finance.summary.total_earnings)} tone="positive" /><SummaryCard label="Received" value={amountLabel(finance.summary.received)} tone="negative" /><SummaryCard label="Remaining" value={amountLabel(finance.summary.remaining)} tone={amountTone(finance.summary.remaining)} /></section>
    <section style={{ ...card, padding: 12, marginBottom: 14 }} aria-label="Finance filter"><label htmlFor="finance-filter" style={{ display: 'grid', gap: 6, fontSize: 12, fontWeight: 850, color: '#475569' }}>Filter<select id="finance-filter" value={filter} onChange={(event) => setFilter(event.target.value as Filter)} style={{ minHeight: 44, borderRadius: 12, border: '1px solid #cbd5e1', padding: '0 11px', background: '#fff', font: 'inherit', fontWeight: 750 }}>{(['all', 'earnings', 'payments', 'advances', 'received'] as Filter[]).map((item) => <option key={item} value={item}>{filterLabel(item)}</option>)}</select></label></section>
    <section aria-labelledby="finance-list-heading"><h2 id="finance-list-heading" style={{ margin: '0 0 10px', fontSize: 19 }}>{filterLabel(filter)}</h2>{visibleEntries.length === 0 ? <section style={{ ...card, padding: 24, textAlign: 'center' }}><h3 style={{ margin: 0, fontSize: 17 }}>{finance.entries.length ? 'No matching finance records' : 'No finance records yet'}</h3><p style={{ margin: '7px 0 0', color: '#64748b', fontSize: 13, lineHeight: 1.5 }}>{finance.entries.length ? 'Try another filter.' : 'Your earnings and received amounts will appear here.'}</p></section> : <div style={{ display: 'grid', gap: 10 }}>{visibleEntries.map((entry) => <FinanceRow key={entry.id} entry={entry} onDetails={openDetails} onEdit={openEdit} onDelete={setDeleteTarget} />)}</div>}</section>
    {modalOpen && <AddReceivedModal editing={editing} type={type} setType={setType} amount={amount} setAmount={setAmount} formError={formError} saving={finance.saving} onCancel={() => setModalOpen(false)} onSave={() => void submit()} />}
    {deleteTarget && <DeleteModal saving={finance.saving} onCancel={() => setDeleteTarget(null)} onDelete={() => void confirmDelete()} />}
    {(selectedEntry || detailsLoading || detailsError) && <WorkEntryDetails entry={selectedEntry} loading={detailsLoading} error={detailsError} onClose={() => { setSelectedEntry(null); setDetailsError(null); }} />}
  </main>;
}

function SummaryCard({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'positive' | 'negative' | 'neutral' }) { const valueColor = tone === 'positive' ? '#15803d' : tone === 'negative' ? '#b91c1c' : '#0f172a'; return <section style={{ ...card, padding: 17 }}><div style={{ color: '#64748b', fontSize: 11, fontWeight: 850, letterSpacing: '.06em', textTransform: 'uppercase' }}>{label}</div><div style={{ marginTop: 6, fontSize: 'clamp(23px,6vw,32px)', fontWeight: 950, letterSpacing: '-.04em', color: valueColor }}>{value}</div></section>; }
function FinanceRow({ entry, onDetails, onEdit, onDelete }: { entry: FinanceListEntry; onDetails: (entry: WorkEntry) => void; onEdit: (record: FinanceReceivedRecord) => void; onDelete: (record: FinanceReceivedRecord) => void }) { const earning = entry.kind === 'earning'; const label = earning ? 'Earnings' : entry.kind === 'payment' ? 'Payment' : 'Advance'; return <article style={{ ...card, padding: 15, borderLeft: `4px solid ${earning ? '#16a34a' : '#dc2626'}` }}><div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}><div><div style={{ fontSize: 19, fontWeight: 950, color: earning ? '#15803d' : '#b91c1c' }}>{earning ? '+' : '−'} {amountLabel(entry.amount)}</div><div style={{ marginTop: 3, fontSize: 12, fontWeight: 900, color: '#334155' }}>{label}</div></div><span aria-label={label} style={{ display: 'inline-flex', padding: '5px 8px', borderRadius: 999, background: earning ? '#f0fdf4' : '#fef2f2', color: earning ? '#166534' : '#991b1b', fontSize: 11, fontWeight: 900 }}>{label}</span></div><div style={{ marginTop: 9, color: '#64748b', fontSize: 12 }}>{earning ? `Work Entry · ${dateLabel(entry.occurred_at)}` : `${label} · ${dateLabel(entry.occurred_at)}`}</div>{earning ? <button type="button" onClick={() => onDetails(entry.workEntry)} style={{ marginTop: 9, border: 0, background: 'transparent', padding: 0, color: '#4338ca', font: 'inherit', fontSize: 12, fontWeight: 850, cursor: 'pointer' }}>View details →</button> : <div style={{ display: 'flex', gap: 8, marginTop: 11 }}><button type="button" onClick={() => onEdit(entry.record)} style={{ ...button, minHeight: 38, padding: '0 12px', fontSize: 12 }}>Edit</button><button type="button" onClick={() => onDelete(entry.record)} style={{ ...button, minHeight: 38, padding: '0 12px', fontSize: 12, color: '#b91c1c', borderColor: '#fecaca' }}>Delete</button></div>}</article>; }
function AddReceivedModal({ editing, type, setType, amount, setAmount, formError, saving, onCancel, onSave }: { editing: FinanceReceivedRecord | null; type: FinanceReceivedType; setType: (type: FinanceReceivedType) => void; amount: string; setAmount: (value: string) => void; formError: string | null; saving: boolean; onCancel: () => void; onSave: () => void }) { return <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onCancel(); }} style={{ position: 'fixed', inset: 0, zIndex: 1300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(15,23,42,.56)', backdropFilter: 'blur(7px)' }}><section role="dialog" aria-modal="true" aria-labelledby="received-modal-title" style={{ width: '100%', maxWidth: 560, borderRadius: '24px 24px 0 0', background: '#fff', padding: '12px 16px calc(20px + env(safe-area-inset-bottom))', boxSizing: 'border-box', boxShadow: '0 -20px 70px rgba(15,23,42,.25)' }}><div style={{ width: 42, height: 4, borderRadius: 999, background: '#cbd5e1', margin: '0 auto 15px' }} /><h2 id="received-modal-title" style={{ margin: 0, fontSize: 21 }}>{editing ? 'Edit Received Amount' : 'Add Received Amount'}</h2><p style={{ margin: '5px 0 16px', color: '#64748b', fontSize: 13 }}>Record an amount you received. No money is transferred by the app.</p><fieldset disabled={saving} style={{ border: 0, padding: 0, margin: 0 }}><legend style={{ fontSize: 13, fontWeight: 850 }}>What did you receive?</legend><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginTop: 8 }}><Choice active={type === 'payment'} onClick={() => setType('payment')} label="Payment" /><Choice active={type === 'advance'} onClick={() => setType('advance')} label="Advance" /></div><label style={{ display: 'grid', gap: 7, marginTop: 16, fontSize: 13, fontWeight: 850 }}>Amount<input autoFocus type="text" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Rs. 0.00" aria-invalid={!!formError} style={{ minHeight: 48, boxSizing: 'border-box', borderRadius: 13, border: formError ? '1px solid #dc2626' : '1px solid #cbd5e1', padding: '0 13px', font: 'inherit' }} /></label></fieldset>{formError && <p role="alert" style={{ margin: '8px 0 0', color: '#b91c1c', fontSize: 12, fontWeight: 750 }}>{formError}</p>}<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginTop: 18 }}><button type="button" onClick={onCancel} disabled={saving} style={{ ...button }}>Cancel</button><button type="button" onClick={onSave} disabled={saving} style={{ ...button, background: '#4f46e5', borderColor: '#4f46e5', color: '#fff' }}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Save'}</button></div></section></div>; }
function Choice({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) { return <button type="button" role="radio" aria-checked={active} onClick={onClick} style={{ minHeight: 48, borderRadius: 13, border: active ? '2px solid #4f46e5' : '1px solid #cbd5e1', background: active ? '#eef2ff' : '#fff', color: '#0f172a', font: 'inherit', fontWeight: 850, cursor: 'pointer' }}>{active ? '● ' : '○ '}{label}</button>; }
function DeleteModal({ saving, onCancel, onDelete }: { saving: boolean; onCancel: () => void; onDelete: () => void }) { return <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onCancel(); }} style={{ position: 'fixed', inset: 0, zIndex: 1350, display: 'grid', placeItems: 'center', padding: 14, background: 'rgba(15,23,42,.56)' }}><section role="dialog" aria-modal="true" aria-labelledby="delete-finance-title" style={{ width: '100%', maxWidth: 420, borderRadius: 20, background: '#fff', padding: 20, boxSizing: 'border-box', boxShadow: '0 24px 70px rgba(15,23,42,.3)' }}><h2 id="delete-finance-title" style={{ margin: 0, fontSize: 20 }}>Delete this entry?</h2><p style={{ margin: '8px 0 0', color: '#64748b', fontSize: 13, lineHeight: 1.5 }}>This entry will be marked deleted. You can undo it for the next few seconds.</p><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginTop: 18 }}><button type="button" onClick={onCancel} disabled={saving} style={{ ...button }}>Cancel</button><button type="button" onClick={onDelete} disabled={saving} style={{ ...button, background: '#dc2626', borderColor: '#dc2626', color: '#fff' }}>{saving ? 'Deleting…' : 'Delete'}</button></div></section></div>; }
function WorkEntryDetails({ entry, loading, error, onClose }: { entry: WorkEntry | null; loading: boolean; error: string | null; onClose: () => void }) { return <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, zIndex: 1250, display: 'grid', placeItems: 'center', padding: 14, background: 'rgba(15,23,42,.58)', backdropFilter: 'blur(7px)' }}><section role="dialog" aria-modal="true" aria-labelledby="finance-work-entry-title" style={{ width: '100%', maxWidth: 600, maxHeight: 'calc(100dvh - 28px)', overflowY: 'auto', boxSizing: 'border-box', borderRadius: 22, background: '#fff', padding: 18, boxShadow: '0 24px 70px rgba(15,23,42,.3)' }}><header style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}><div><div style={{ color: '#64748b', fontSize: 11, fontWeight: 850, letterSpacing: '.08em', textTransform: 'uppercase' }}>Work Entry · Details</div><h2 id="finance-work-entry-title" style={{ margin: '5px 0 0', fontSize: 23 }}>{entry?.item_name ?? (loading ? 'Loading…' : 'Work Entry')}</h2></div><button type="button" onClick={onClose} style={{ minWidth: 40, minHeight: 40, borderRadius: 12 }}>×</button></header>{loading && <p style={{ color: '#64748b' }}>Loading Work Entry…</p>}{error && <p role="alert" style={{ color: '#b91c1c', fontWeight: 750 }}>{error}</p>}{entry && <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, margin: '20px 0 0' }}><Detail label="Item Name" value={entry.item_name} /><Detail label="Quantity" value={entry.quantity} /><Detail label="Rate" value={formatWorkDecimal(entry.rate)} /><Detail label="Total" value={formatWorkDecimal(entry.total)} /><Detail label="Date" value={new Date(entry.occurred_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} wide /><Detail label="Note" value={entry.special_note || 'No special note.'} wide /></dl>}</section></div>; }
function Detail({ label, value, wide }: { label: string; value: string; wide?: boolean }) { return <div style={wide ? { gridColumn: '1 / -1' } : undefined}><dt style={{ color: '#64748b', fontSize: 11, fontWeight: 850 }}>{label}</dt><dd style={{ margin: '3px 0 0', fontWeight: 700, whiteSpace: 'pre-wrap' }}>{value}</dd></div>; }
