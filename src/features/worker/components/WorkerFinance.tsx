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
  const [filter, setFilter] = useState<Filter>('all');
  const finance = useWorkerFinance(filter);
  const [modalOpen, setModalOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
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
    if (!modalOpen) { setEditing(null); setAmount(''); setType('payment'); setFormError(null); }
  }, [modalOpen]);
  useEffect(() => { if (!undoTarget) return; const timer = window.setTimeout(() => setUndoTarget(null), 8000); return () => window.clearTimeout(timer); }, [undoTarget]);
  useEffect(() => {
    if (!filterOpen) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setFilterOpen(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [filterOpen]);

  const visibleEntries = useMemo(() => finance.entries.filter((entry) => matchesFilter(entry, filter)), [finance.entries, filter]);
  const displayedEntries = visibleEntries;
  const hasMore = finance.historyHasMore;

  const openAdd = () => { setEditing(null); setType('payment'); setAmount(''); setFormError(null); setModalOpen(true); };
  const openEdit = (record: FinanceReceivedRecord) => { setEditing(record); setType(record.entry_type); setAmount(record.amount); setFormError(null); setModalOpen(true); };
  const submit = async () => {
    const normalized = amount.trim();
    if (!normalized) { setFormError('Amount is required.'); return; }
    if (!amountRe.test(normalized) || normalized === '0') { setFormError('Enter a valid amount greater than zero, with up to 4 decimal places.'); return; }
    setFormError(null);
    const result = editing ? await finance.editReceived(editing.id, type, normalized) : await finance.addReceived(type, normalized);
    if (result.error) { setFormError(result.error.message); return; }
    setModalOpen(false); setNotice('Saved successfully');
  };
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const result = await finance.removeReceived(deleteTarget.id);
    if (result.error) { setNotice(`Could not delete: ${result.error.message}`); return; }
    setDeleteTarget(null); setUndoTarget({ id: deleteTarget.id, entryType: deleteTarget.entry_type }); setNotice(`${deleteTarget.entry_type === 'payment' ? 'Payment' : 'Advance'} deleted`);
  };
  const undoDelete = async () => { if (!undoTarget) return; const result = await finance.restoreReceived(undoTarget.id); if (result.error) { setNotice(`Could not restore: ${result.error.message}`); return; } setUndoTarget(null); setNotice('Restored successfully'); };
  const dismissNotice = () => { setUndoTarget(null); setNotice(null); };
  const openDetails = async (entry: WorkEntry) => {
    setSelectedEntry(null); setDetailsError(null); setDetailsLoading(true);
    const result = await getWorkerWorkEntry(entry.id); setDetailsLoading(false);
    if (result.error) { setDetailsError(result.error.message); return; }
    if (!result.data) { setDetailsError('This Work Entry is no longer available.'); return; }
    setSelectedEntry(result.data);
  };

  if (finance.loading) return <main style={{ width: '100%', maxWidth: 900, margin: '0 auto', padding: '24px 14px 112px', boxSizing: 'border-box' }}><p style={{ color: '#64748b' }}>Loading Finance…</p></main>;
  if (finance.error) return <main style={{ width: '100%', maxWidth: 900, margin: '0 auto', padding: '24px 14px 112px', boxSizing: 'border-box' }}><button type="button" onClick={() => navigate('/work')} style={{ ...button, padding: '0 12px' }}>← Work House</button><p role="alert" style={{ ...card, marginTop: 16, padding: 18, color: '#b91c1c', fontWeight: 750 }}>{finance.error}</p></main>;

  return <main style={{ width: '100%', maxWidth: 900, margin: '0 auto', padding: '18px 14px 112px', boxSizing: 'border-box' }}>
    <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}><div><button type="button" onClick={() => navigate('/work')} style={{ ...button, minHeight: 38, padding: '0 11px', fontSize: 13 }}>← Work House</button><div style={{ marginTop: 12, color: '#64748b', fontSize: 11, fontWeight: 850, letterSpacing: '.08em', textTransform: 'uppercase' }}>Worker Finance</div><h1 style={{ margin: '4px 0 0', fontSize: 'clamp(28px, 7vw, 42px)', letterSpacing: '-.04em' }}>Finance</h1></div><button type="button" onClick={openAdd} style={{ ...button, flex: '0 0 auto', padding: '0 15px', border: '1px solid rgba(79,70,229,.3)', background: '#4f46e5', color: '#fff', boxShadow: '0 8px 18px rgba(79,70,229,.18)' }}>+ Add</button></header>
    {notice && <div role="status" aria-live="polite" style={{ ...card, marginBottom: 12, padding: '10px 13px', color: undoTarget ? '#991b1b' : '#166534', background: undoTarget ? '#fef2f2' : '#f0fdf4', borderColor: undoTarget ? '#fecaca' : '#bbf7d0', fontSize: 13, fontWeight: 850, display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ flex: 1 }}>{notice}</span>{undoTarget && <button type="button" onClick={() => void undoDelete()} disabled={finance.saving} style={{ ...button, minHeight: 36, padding: '0 11px', color: '#991b1b', borderColor: '#fecaca', background: '#fff' }}>Undo</button>}<button type="button" onClick={dismissNotice} aria-label="Dismiss message" style={{ border: 0, background: 'transparent', fontSize: 18, cursor: 'pointer', padding: 2 }}>×</button></div>}
    <section aria-label="Finance summary" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10, marginBottom: 16 }}><SummaryCard label="Total Earnings" value={amountLabel(finance.summary.total_earnings)} tone="positive" /><SummaryCard label="Received" value={amountLabel(finance.summary.received)} tone="negative" /><SummaryCard label="Remaining" value={amountLabel(finance.summary.remaining)} tone={amountTone(finance.summary.remaining)} /></section>
    <section className="finance-filter-shell" aria-label="Finance filter">
      <div className="finance-filter-bar">
        <button type="button" className="finance-filter-trigger" aria-haspopup="dialog" aria-expanded={filterOpen} aria-controls="finance-filter-dialog" onClick={() => setFilterOpen((open) => !open)}>
          <span>Filter</span><span className="finance-filter-current">{filterLabel(filter)}</span><span className="finance-filter-chevron" aria-hidden="true">⌄</span>{filter !== 'all' && <span className="finance-filter-dot" aria-label="Filter selected" />}
        </button>
      </div>
      {filterOpen && <FilterPopup filter={filter} onSelect={(next) => { setFilter(next); setFilterOpen(false); }} onClose={() => setFilterOpen(false)} />}
    </section>
    <section aria-labelledby="finance-list-heading"><h2 id="finance-list-heading" style={{ margin: '0 0 10px', fontSize: 19 }}>{filterLabel(filter)}</h2>{visibleEntries.length === 0 ? <section style={{ ...card, padding: 24, textAlign: 'center' }}><h3 style={{ margin: 0, fontSize: 17 }}>{finance.entries.length ? 'No matching finance records' : 'No finance records yet'}</h3><p style={{ margin: '7px 0 0', color: '#64748b', fontSize: 13, lineHeight: 1.5 }}>{finance.entries.length ? 'Try another filter.' : 'Your earnings and received amounts will appear here.'}</p></section> : <><div style={{ display: 'grid', gap: 10 }}>{displayedEntries.map((entry) => <FinanceRow key={entry.id} entry={entry} onDetails={openDetails} onEdit={openEdit} onDelete={setDeleteTarget} />)}</div>{hasMore && <button type="button" onClick={() => void finance.loadMoreHistory()} disabled={finance.historyLoadingMore} style={{ ...button, width: '100%', minHeight: 38, marginTop: 10, background: 'linear-gradient(180deg,#fff,#f3f6fa)', boxShadow: 'inset 0 1px 0 #fff, 0 3px 8px rgba(15,23,42,.08)', opacity: finance.historyLoadingMore ? .7 : 1 }}>{finance.historyLoadingMore ? 'Loading…' : 'Load More'}</button>}</>}</section>
    {modalOpen && <AddReceivedModal editing={editing} type={type} setType={setType} amount={amount} setAmount={setAmount} formError={formError} saving={finance.saving} onCancel={() => setModalOpen(false)} onSave={() => void submit()} />}
    {deleteTarget && <DeleteModal saving={finance.saving} onCancel={() => setDeleteTarget(null)} onDelete={() => void confirmDelete()} />}
    {(selectedEntry || detailsLoading || detailsError) && <WorkEntryDetails entry={selectedEntry} loading={detailsLoading} error={detailsError} onClose={() => { setSelectedEntry(null); setDetailsError(null); }} />}
  </main>;
}

function FilterPopup({ filter, onSelect, onClose }: { filter: Filter; onSelect: (filter: Filter) => void; onClose: () => void }) {
  const options: Filter[] = ['all', 'earnings', 'payments', 'advances', 'received'];
  return <div className="finance-filter-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section id="finance-filter-dialog" className="finance-filter-popup" role="dialog" aria-modal="true" aria-labelledby="finance-filter-title">
      <div className="finance-filter-reflection" aria-hidden="true" />
      <div className="finance-filter-heading"><div><h3 id="finance-filter-title">Filter</h3></div><button type="button" className="finance-filter-close" onClick={onClose} aria-label="Close filter">×</button></div>
      <div className="finance-filter-options" role="listbox" aria-label="Finance filters">
        {options.map((item) => { const selected = item === filter; return <button key={item} type="button" role="option" aria-selected={selected} className={`finance-filter-option${selected ? ' is-selected' : ''}`} onClick={() => onSelect(item)}>
          <span className="finance-filter-option-icon" aria-hidden="true">{selected ? '✓' : '•'}</span><span className="finance-filter-option-label">{filterLabel(item)}</span>{selected && <span className="finance-filter-option-state">Selected</span>}
        </button>; })}
      </div>
    </section>
    <style>{`
      .finance-filter-shell{position:relative;margin-bottom:14px;padding:9px 10px;border:1px solid rgba(99,102,241,.13);border-radius:16px;background:linear-gradient(180deg,#ffffff 0%,#f7fafc 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.98),inset 0 -1px 0 rgba(148,163,184,.08),0 3px 9px rgba(15,23,42,.055);}
      .finance-filter-bar{display:flex;align-items:center;justify-content:flex-start;gap:10px;min-width:0;}
      .finance-filter-current{position:relative;display:inline-block;font-size:12px;font-weight:950;letter-spacing:-.012em;color:#18243a;text-shadow:0 1px 0 #fff,0 2px 1px rgba(15,23,42,.10);}
      .finance-filter-trigger{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:38px;max-width:100%;padding:0 12px;border:1px solid rgba(37,99,235,.27);border-radius:11px;background:linear-gradient(180deg,#ffffff 0%,#f8fdff 38%,#e9f5fa 100%);color:#164e63;font:inherit;font-size:12px;font-weight:950;letter-spacing:.015em;cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,255,255,.99),inset 0 -1px 0 rgba(14,116,144,.16),0 1px 0 rgba(148,163,184,.30),0 3px 5px rgba(15,23,42,.08),0 7px 13px rgba(14,116,144,.10),0 0 13px rgba(45,212,191,.07);text-shadow:0 1px 0 #fff,0 2px 1px rgba(15,23,42,.07);transition:transform .12s ease,box-shadow .12s ease;}
      .finance-filter-trigger::before{content:"";position:absolute;left:3px;right:3px;top:2px;height:40%;border-radius:8px 8px 50% 50%;background:linear-gradient(180deg,rgba(255,255,255,.78),transparent);pointer-events:none;}
      .finance-filter-trigger:hover{transform:translateY(-1px);box-shadow:inset 0 1px 0 #fff,inset 0 -1px 0 rgba(14,116,144,.16),0 2px 0 rgba(148,163,184,.30),0 6px 10px rgba(15,23,42,.09),0 10px 17px rgba(14,116,144,.12),0 0 15px rgba(45,212,191,.09);}
      .finance-filter-trigger:active{transform:translateY(2px) scale(.975);box-shadow:inset 0 2px 4px rgba(15,23,42,.14),inset 0 -1px 0 rgba(255,255,255,.65),0 1px 2px rgba(15,23,42,.07);}
      .finance-filter-trigger:focus-visible,.finance-filter-option:focus-visible,.finance-filter-close:focus-visible{outline:3px solid rgba(37,99,235,.22);outline-offset:2px;}
      .finance-filter-trigger span{position:relative;z-index:1;filter:drop-shadow(0 1px 0 rgba(255,255,255,.95));}
      .finance-filter-chevron{font-size:14px;line-height:1;transform:translateY(-1px);}
      .finance-filter-dot{width:6px;height:6px;border-radius:50%;background:#0f9fa5;box-shadow:0 1px 1px rgba(15,23,42,.16),0 0 7px rgba(20,184,166,.28);}
      .finance-filter-overlay{position:fixed;inset:0;z-index:1400;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(241,245,249,.46);backdrop-filter:blur(4px);}
      .finance-filter-popup{position:relative;width:min(420px,calc(100vw - 36px));box-sizing:border-box;padding:12px;border:1px solid rgba(71,85,105,.14);border-radius:20px;background:linear-gradient(180deg,#ffffff 0%,#f8fbfd 55%,#eef4f7 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.98),inset 0 -2px 0 rgba(148,163,184,.1),0 2px 0 rgba(148,163,184,.24),0 10px 20px rgba(15,23,42,.12),0 28px 58px rgba(15,23,42,.16),0 0 22px rgba(45,212,191,.09);overflow:visible;}
      .finance-filter-reflection{position:absolute;left:12px;right:12px;top:7px;height:18px;border-radius:14px 14px 50% 50%;background:linear-gradient(180deg,rgba(255,255,255,.86),rgba(255,255,255,0));pointer-events:none;}
      .finance-filter-heading{position:relative;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:1px 1px 9px;}
      .finance-filter-heading h3{margin:2px 0 0;font-size:16px;font-weight:950;letter-spacing:-.025em;color:#172033;text-shadow:0 1px 0 #fff,0 1px 1px rgba(15,23,42,.08);}
      .finance-filter-close{width:32px;height:32px;border:1px solid rgba(148,163,184,.24);border-radius:10px;background:linear-gradient(180deg,#fff,#edf2f5);color:#475569;font:inherit;font-size:18px;font-weight:800;line-height:1;cursor:pointer;box-shadow:inset 0 1px 0 #fff,0 2px 0 rgba(148,163,184,.22),0 4px 9px rgba(15,23,42,.08);}
      .finance-filter-options{display:grid;gap:6px;}
      .finance-filter-option{position:relative;display:flex;align-items:center;gap:9px;width:100%;min-height:43px;padding:0 10px;border:1px solid rgba(148,163,184,.18);border-radius:12px;box-sizing:border-box;background:linear-gradient(180deg,#f9fbfc,#eef3f5);color:#334155;font:inherit;font-size:12px;font-weight:900;letter-spacing:.005em;text-align:left;cursor:pointer;box-shadow:inset 0 2px 4px rgba(15,23,42,.06),inset 0 1px 0 rgba(255,255,255,.8),0 1px 0 rgba(255,255,255,.9);text-shadow:0 1px 0 #fff;transition:transform .1s ease,box-shadow .1s ease,background .1s ease;}
      .finance-filter-option:hover{transform:translateY(-1px);box-shadow:inset 0 2px 4px rgba(15,23,42,.045),inset 0 1px 0 #fff,0 3px 7px rgba(15,23,42,.07);}
      .finance-filter-option:active{transform:translateY(2px);box-shadow:inset 0 3px 6px rgba(15,23,42,.1),0 1px 0 rgba(255,255,255,.8);}
      .finance-filter-option.is-selected{border-color:rgba(14,116,144,.25);background:linear-gradient(180deg,#f2ffff 0%,#e5f7f7 100%);color:#155e75;box-shadow:inset 0 1px 0 rgba(255,255,255,.98),inset 0 -1px 0 rgba(13,148,136,.1),0 2px 0 rgba(148,163,184,.2),0 6px 12px rgba(13,148,136,.1),0 0 15px rgba(45,212,191,.08);}
      .finance-filter-option-icon{display:inline-flex;align-items:center;justify-content:center;width:21px;height:21px;flex:0 0 21px;border-radius:7px;background:linear-gradient(180deg,#fff,#e8eef1);color:#94a3b8;font-size:12px;font-weight:950;box-shadow:inset 0 1px 2px rgba(15,23,42,.08),0 1px 0 #fff;}
      .finance-filter-option.is-selected .finance-filter-option-icon{background:linear-gradient(180deg,#d9ffff,#bceceb);color:#0f766e;box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 2px 6px rgba(13,148,136,.16),0 0 9px rgba(45,212,191,.16);}
      .finance-filter-option-label{flex:1;min-width:0;}
      .finance-filter-option-state{font-size:9px;font-weight:950;letter-spacing:.07em;text-transform:uppercase;color:#0f766e;}
      @media (max-width:520px){.finance-filter-overlay{align-items:flex-end;padding:0;background:rgba(241,245,249,.52)}.finance-filter-popup{width:100%;max-width:none;border-radius:22px 22px 0 0;padding:11px 12px calc(12px + env(safe-area-inset-bottom));box-shadow:inset 0 1px 0 rgba(255,255,255,.98),inset 0 -2px 0 rgba(148,163,184,.1),0 -2px 0 rgba(148,163,184,.2),0 -10px 24px rgba(15,23,42,.12),0 -26px 58px rgba(15,23,42,.16),0 0 20px rgba(45,212,191,.08)}.finance-filter-heading{padding-bottom:8px}.finance-filter-option{min-height:42px}.finance-filter-option-state{display:none}}
    `}</style>
  </div>;
}

function SummaryCard({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'positive' | 'negative' | 'neutral' }) { const valueColor = tone === 'positive' ? '#15803d' : tone === 'negative' ? '#b91c1c' : '#0f172a'; return <section style={{ ...card, padding: 17 }}><div style={{ color: '#64748b', fontSize: 11, fontWeight: 850, letterSpacing: '.06em', textTransform: 'uppercase' }}>{label}</div><div style={{ marginTop: 6, fontSize: 'clamp(23px,6vw,32px)', fontWeight: 950, letterSpacing: '-.04em', color: valueColor }}>{value}</div></section>; }
function FinanceRow({ entry, onDetails, onEdit, onDelete }: { entry: FinanceListEntry; onDetails: (entry: WorkEntry) => void; onEdit: (record: FinanceReceivedRecord) => void; onDelete: (record: FinanceReceivedRecord) => void }) { const earning = entry.kind === 'earning'; const label = earning ? 'Earnings' : entry.kind === 'payment' ? 'Payment' : 'Advance'; return <article style={{ ...card, padding: 15, borderLeft: `4px solid ${earning ? '#16a34a' : '#dc2626'}` }}><div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}><div><div style={{ fontSize: 19, fontWeight: 950, color: earning ? '#15803d' : '#b91c1c' }}>{earning ? '+' : '−'} {amountLabel(entry.amount)}</div><div style={{ marginTop: 3, fontSize: 12, fontWeight: 900, color: '#334155' }}>{label}</div></div><span aria-label={label} style={{ display: 'inline-flex', padding: '5px 8px', borderRadius: 999, background: earning ? '#f0fdf4' : '#fef2f2', color: earning ? '#166534' : '#991b1b', fontSize: 11, fontWeight: 900 }}>{label}</span></div><div style={{ marginTop: 9, color: '#64748b', fontSize: 12 }}>{earning ? `Work Entry · ${dateLabel(entry.occurred_at)}` : `${label} · ${dateLabel(entry.occurred_at)}`}</div>{earning ? <button type="button" onClick={() => onDetails(entry.workEntry)} style={{ marginTop: 9, border: 0, background: 'transparent', padding: 0, color: '#4338ca', font: 'inherit', fontSize: 12, fontWeight: 850, cursor: 'pointer' }}>View details →</button> : <div style={{ display: 'flex', gap: 8, marginTop: 11 }}><button type="button" onClick={() => onEdit(entry.record)} style={{ ...button, minHeight: 38, padding: '0 12px', fontSize: 12 }}>Edit</button><button type="button" onClick={() => onDelete(entry.record)} style={{ ...button, minHeight: 38, padding: '0 12px', fontSize: 12, color: '#b91c1c', borderColor: '#fecaca' }}>Delete</button></div>}</article>; }
function AddReceivedModal({ editing, type, setType, amount, setAmount, formError, saving, onCancel, onSave }: { editing: FinanceReceivedRecord | null; type: FinanceReceivedType; setType: (type: FinanceReceivedType) => void; amount: string; setAmount: (value: string) => void; formError: string | null; saving: boolean; onCancel: () => void; onSave: () => void }) { return <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onCancel(); }} style={{ position: 'fixed', inset: 0, zIndex: 1300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(15,23,42,.56)', backdropFilter: 'blur(7px)' }}><section role="dialog" aria-modal="true" aria-labelledby="received-modal-title" style={{ width: '100%', maxWidth: 560, borderRadius: '24px 24px 0 0', background: '#fff', padding: '12px 16px calc(20px + env(safe-area-inset-bottom))', boxSizing: 'border-box', boxShadow: '0 -20px 70px rgba(15,23,42,.25)' }}><div style={{ width: 42, height: 4, borderRadius: 99, background: '#cbd5e1', margin: '0 auto 12px' }} /><h2 id="received-modal-title" style={{ margin: 0, fontSize: 19 }}>{editing ? 'Edit Received' : 'Add Received'}</h2><div style={{ display: 'grid', gap: 12, marginTop: 14 }}><label style={{ display: 'grid', gap: 6, fontSize: 12, fontWeight: 850 }}>Type<select value={type} onChange={(event) => setType(event.target.value as FinanceReceivedType)} disabled={saving} style={{ minHeight: 44, borderRadius: 12, border: '1px solid #cbd5e1', padding: '0 11px', background: '#fff', font: 'inherit' }}><option value="payment">Payment</option><option value="advance">Advance</option></select></label><label style={{ display: 'grid', gap: 6, fontSize: 12, fontWeight: 850 }}>Amount<input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" disabled={saving} style={{ minHeight: 44, borderRadius: 12, border: '1px solid #cbd5e1', padding: '0 11px', background: '#fff', font: 'inherit' }} /></label>{formError && <p role="alert" style={{ margin: 0, color: '#b91c1c', fontSize: 12, fontWeight: 750 }}>{formError}</p>}<div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="button" onClick={onCancel} disabled={saving} style={{ ...button, padding: '0 13px' }}>Cancel</button><button type="button" onClick={onSave} disabled={saving} style={{ ...button, padding: '0 15px', background: '#4f46e5', color: '#fff', borderColor: '#4f46e5' }}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Add'}</button></div></div></section></div>; }
function DeleteModal({ saving, onCancel, onDelete }: { saving: boolean; onCancel: () => void; onDelete: () => void }) { return <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onCancel(); }} style={{ position: 'fixed', inset: 0, zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(15,23,42,.56)', backdropFilter: 'blur(7px)' }}><section role="dialog" aria-modal="true" aria-labelledby="delete-title" style={{ width: '100%', maxWidth: 420, ...card, padding: 18, background: '#fff' }}><h2 id="delete-title" style={{ margin: 0, fontSize: 18 }}>Delete received record?</h2><p style={{ margin: '8px 0 16px', color: '#64748b', fontSize: 13, lineHeight: 1.5 }}>This removes the selected received record. You can undo the deletion for a short time.</p><div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="button" onClick={onCancel} disabled={saving} style={{ ...button, padding: '0 13px' }}>Cancel</button><button type="button" onClick={onDelete} disabled={saving} style={{ ...button, padding: '0 13px', color: '#b91c1c', borderColor: '#fecaca', background: '#fff5f5' }}>{saving ? 'Deleting…' : 'Delete'}</button></div></section></div>; }
function WorkEntryDetails({ entry, loading, error, onClose }: { entry: WorkEntry | null; loading: boolean; error: string | null; onClose: () => void }) { return <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(15,23,42,.56)', backdropFilter: 'blur(7px)' }}><section role="dialog" aria-modal="true" aria-labelledby="entry-details-title" style={{ width: '100%', maxWidth: 560, maxHeight: '85vh', overflowY: 'auto', ...card, padding: 18, background: '#fff' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}><h2 id="entry-details-title" style={{ margin: 0, fontSize: 19 }}>Work Entry Details</h2><button type="button" onClick={onClose} aria-label="Close details" style={{ ...button, minHeight: 36, minWidth: 36, padding: 0 }}>×</button></div>{loading && <p style={{ color: '#64748b' }}>Loading Work Entry…</p>}{error && <p role="alert" style={{ color: '#b91c1c', fontWeight: 750 }}>{error}</p>}{entry && <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>{[['Date', dateLabel(entry.occurred_at)], ['Item', entry.item_name], ['Note', entry.special_note || '—'], ['Total', amountLabel(entry.total)]].map(([label, value]) => <div key={label} style={{ ...card, padding: 11 }}><div style={{ fontSize: 10, fontWeight: 850, color: '#64748b', textTransform: 'uppercase' }}>{label}</div><div style={{ marginTop: 3, fontSize: 14, fontWeight: 800, color: '#172033' }}>{value}</div></div>)}</div>}</section></div>; }