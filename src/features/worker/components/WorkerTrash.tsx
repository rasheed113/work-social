import { useCallback, useEffect, useState } from 'react';
import { emptyWorkerWorkTrash, getWorkerWorkEntryVersions, listWorkerTrash, removeWorkerWorkEntryPermanently, restoreWorkerWorkEntry } from '../api/workEntries';
import type { WorkEntry, WorkEntryVersion } from '../types/workEntry';
import { formatWorkDecimal } from '../logic/workEntryCalculations';
import { formatWorkEntrySizes } from '../logic/workEntrySizes';
import { navigate } from '../../../app/Router';

const cardStyle = { padding: 18, border: '1px solid rgba(99,102,241,.14)', borderRadius: 18, background: 'rgba(255,255,255,.94)', boxShadow: '0 10px 28px rgba(15,23,42,.07)' };

function formatDate(value: string) { return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }

export function WorkerTrash() {
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [versions, setVersions] = useState<Record<string, WorkEntryVersion[]>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [emptying, setEmptying] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await listWorkerTrash();
    if (result.error) setError(result.error.message); else setEntries(result.data);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const restore = async (entryId: string) => {
    setBusyId(entryId);
    setError(null);
    const result = await restoreWorkerWorkEntry(entryId);
    if (result.error) setError(result.error.message); else {
      setNotice('Restored to Active Work.');
      await load();
    }
    setBusyId(null);
  };

  const removePermanently = async (entryId: string) => {
    setBusyId(entryId);
    setError(null);
    const result = await removeWorkerWorkEntryPermanently(entryId);
    if (result.error) setError(result.error.message); else {
      setNotice('Removed permanently. Immutable audit history was retained.');
      setConfirmRemoveId(null);
      setExpanded(null);
      await load();
    }
    setBusyId(null);
  };

  const emptyTrash = async () => {
    setEmptying(true);
    setError(null);
    const result = await emptyWorkerWorkTrash();
    if (result.error) setError(result.error.message); else {
      setNotice('Trash emptied. Immutable audit history was retained.');
      setConfirmEmpty(false);
      setExpanded(null);
      await load();
    }
    setEmptying(false);
  };

  const toggleHistory = async (entryId: string) => {
    if (expanded === entryId) { setExpanded(null); return; }
    setExpanded(entryId);
    if (versions[entryId]) return;
    const result = await getWorkerWorkEntryVersions(entryId);
    if (result.error) setError(result.error.message); else setVersions((current) => ({ ...current, [entryId]: result.data }));
  };

  return (
    <main style={{ width: '100%', maxWidth: 900, margin: '0 auto', padding: '24px 14px 112px', boxSizing: 'border-box' }}>
      <header style={{ marginBottom: 18, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div><div style={{ color: '#64748b', fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>Worker Work House</div><h1 style={{ margin: '6px 0 0', fontSize: 'clamp(28px, 7vw, 40px)', letterSpacing: '-.04em' }}>🗑️ Trash</h1><p style={{ margin: '8px 0 0', color: '#64748b', lineHeight: 1.55 }}>Trashed My Work entries are persisted here until you restore or permanently remove them.</p></div><button type="button" onClick={() => navigate('/work')} style={{ minHeight: 42, padding: '0 12px', borderRadius: 12, fontWeight: 800 }}>← Work</button>
      </header>

      {notice && <p role="status" style={{ ...cardStyle, margin: '0 0 14px', color: '#166534', background: '#f0fdf4' }}>{notice}</p>}
      {error && <p role="alert" style={{ ...cardStyle, margin: '0 0 14px', color: '#b91c1c' }}>{error}</p>}

      {entries.length > 0 && <section style={{ ...cardStyle, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}><div><strong>{entries.length} trashed {entries.length === 1 ? 'entry' : 'entries'}</strong><div style={{ marginTop: 3, color: '#64748b', fontSize: 12 }}>Empty Trash permanently removes these canonical records.</div></div>{confirmEmpty ? <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}><button type="button" onClick={() => setConfirmEmpty(false)} disabled={emptying} style={{ minHeight: 40, borderRadius: 11 }}>Cancel</button><button type="button" onClick={() => void emptyTrash()} disabled={emptying} style={{ minHeight: 40, borderRadius: 11, fontWeight: 900 }}>{emptying ? 'Emptying…' : 'Yes, Empty Trash'}</button></div> : <button type="button" onClick={() => setConfirmEmpty(true)} style={{ minHeight: 40, borderRadius: 11, fontWeight: 900 }}>Empty Trash</button>}</section>}

      {loading ? <section style={cardStyle}><p style={{ margin: 0, color: '#64748b' }}>Loading Trash…</p></section> : !entries.length ? <section style={cardStyle}><h2 style={{ margin: 0, fontSize: 18 }}>Trash is empty</h2><p style={{ margin: '7px 0 0', color: '#64748b' }}>Deleted Work Entries will appear here instead of being destroyed immediately.</p></section> : <div style={{ display: 'grid', gap: 12 }}>
        {entries.map((entry) => <article key={entry.id} style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}><div style={{ minWidth: 0 }}><h2 style={{ margin: 0, fontSize: 18, overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.item_name}</h2><p style={{ margin: '5px 0 0', color: '#64748b', fontSize: 12 }}>{formatDate(entry.occurred_at)} · {formatWorkEntrySizes(entry.size)} · {entry.quantity} × {formatWorkDecimal(entry.rate)} = {formatWorkDecimal(entry.total)}</p></div><span style={{ flex: '0 0 auto', padding: '5px 9px', borderRadius: 999, background: '#fef3c7', color: '#92400e', fontSize: 11, fontWeight: 900 }}>TRASHED</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 13 }}><button type="button" onClick={() => void restore(entry.id)} disabled={busyId === entry.id} style={{ minHeight: 42, borderRadius: 11, fontWeight: 800 }}>{busyId === entry.id ? 'Working…' : 'Restore'}</button><button type="button" onClick={() => setConfirmRemoveId(entry.id)} disabled={busyId === entry.id} style={{ minHeight: 42, borderRadius: 11, fontWeight: 800 }}>Remove permanently</button><button type="button" onClick={() => void toggleHistory(entry.id)} style={{ minHeight: 42, borderRadius: 11, fontWeight: 800 }}>{expanded === entry.id ? 'Hide history' : 'History'}</button></div>
          {confirmRemoveId === entry.id && <div role="alertdialog" aria-modal="true" aria-labelledby={`remove-${entry.id}`} style={{ marginTop: 12, padding: 13, borderRadius: 13, background: '#fef2f2', border: '1px solid #fecaca' }}><strong id={`remove-${entry.id}`}>Remove permanently?</strong><p style={{ margin: '6px 0 12px', color: '#7f1d1d', fontSize: 12 }}>This cannot be undone. The canonical Work Entry will be removed while immutable audit history is retained.</p><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}><button type="button" onClick={() => setConfirmRemoveId(null)} disabled={busyId === entry.id} style={{ minHeight: 42, borderRadius: 11 }}>Cancel</button><button type="button" onClick={() => void removePermanently(entry.id)} disabled={busyId === entry.id} style={{ minHeight: 42, borderRadius: 11, fontWeight: 900 }}>{busyId === entry.id ? 'Removing…' : 'Remove permanently'}</button></div></div>}
          {expanded === entry.id && <section style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e2e8f0' }}><h3 style={{ margin: 0, fontSize: 14 }}>Audit History</h3>{versions[entry.id]?.length ? <div style={{ display: 'grid', gap: 7, marginTop: 8 }}>{versions[entry.id].map((version) => <div key={version.id} style={{ padding: 9, borderRadius: 10, background: '#f8fafc', fontSize: 12 }}><strong>Revision {version.revision_no}</strong> · Size: {formatWorkEntrySizes(version.size)} · {version.quantity} × {formatWorkDecimal(version.rate)} = {formatWorkDecimal(version.total)} · {formatDate(version.recorded_at)}</div>)}</div> : <p style={{ color: '#64748b', fontSize: 12 }}>No revision history is available.</p>}</section>}
        </article>)}
      </div>}
    </main>
  );
}
