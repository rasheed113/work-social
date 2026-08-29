import type { WorkEntry } from '../types/workEntry';

interface WorkerWorkEntryListProps {
  entries: WorkEntry[];
  emptyTitle?: string;
  emptyDescription?: string;
  onOpen: (entry: WorkEntry) => void;
}

function formatAmount(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(value);
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function WorkerWorkEntryList({ entries, emptyTitle = 'No Work Entries yet', emptyDescription = 'Saved Work Entries will appear here.', onOpen }: WorkerWorkEntryListProps) {
  if (!entries.length) {
    return (
      <section style={{ padding: 20, border: '1px dashed #cbd5e1', borderRadius: 18, background: '#f8fafc' }}>
        <h2 style={{ margin: 0, fontSize: 17 }}>{emptyTitle}</h2>
        <p style={{ margin: '7px 0 0', color: '#64748b', fontSize: 13, lineHeight: 1.5 }}>{emptyDescription}</p>
      </section>
    );
  }

  return (
    <section aria-label="My Work Entries" style={{ display: 'grid', gap: 9 }}>
      {entries.map((entry) => (
        <button
          key={entry.id}
          type="button"
          onClick={() => onOpen(entry)}
          style={{ width: '100%', padding: 14, border: '1px solid rgba(99,102,241,.13)', borderRadius: 16, background: '#fff', boxShadow: '0 8px 22px rgba(15,23,42,.05)', textAlign: 'left', cursor: 'pointer', font: 'inherit' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 15 }}>{entry.item_name}</strong>
              <span style={{ display: 'block', marginTop: 4, color: '#64748b', fontSize: 12 }}>{entry.size} · {entry.quantity} pcs · {formatDate(entry.occurred_at)}</span>
            </div>
            <span style={{ flex: '0 0 auto', fontWeight: 900, fontSize: 15 }}>{formatAmount(entry.total)}</span>
          </div>
        </button>
      ))}
    </section>
  );
}
