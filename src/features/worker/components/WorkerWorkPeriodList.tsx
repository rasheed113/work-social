import type { WorkerWorkPeriod, WorkerWorkPeriodHistoryRow } from '../api/workEntries';
import { formatWorkDecimal } from '../logic/workEntryCalculations';

interface WorkerWorkPeriodListProps {
  period: WorkerWorkPeriod;
  periods: WorkerWorkPeriodHistoryRow[];
  timezone: string;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  onMore: () => void;
  onSelect: (row: WorkerWorkPeriodHistoryRow) => void;
}

function formatDate(value: string, timezone: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(undefined, { ...options, timeZone: timezone }).format(new Date(value));
}

function periodLabel(period: WorkerWorkPeriod, row: WorkerWorkPeriodHistoryRow, timezone: string) {
  if (period === 'day') return formatDate(row.period_start, timezone, { month: 'short', day: 'numeric', year: 'numeric' });
  if (period === 'month') return formatDate(row.period_start, timezone, { month: 'long', year: 'numeric' });
  const start = formatDate(row.period_start, timezone, { month: 'short', day: 'numeric' });
  const end = formatDate(new Date(new Date(row.period_end).getTime() - 1).toISOString(), timezone, { month: 'short', day: 'numeric', year: 'numeric' });
  return `${start} – ${end}`;
}

function title(period: WorkerWorkPeriod) {
  return period === 'day' ? 'Daily Earnings' : period === 'week' ? 'Weekly Earnings' : 'Monthly Earnings';
}

export function WorkerWorkPeriodList({ period, periods, timezone, loading, loadingMore, hasMore, error, onMore, onSelect }: WorkerWorkPeriodListProps) {
  if (loading) {
    return <section aria-label={`${title(period)} loading`} style={{ display: 'grid', gap: 10 }}>
      {[0, 1, 2].map((item) => <div key={item} style={{ height: 122, borderRadius: 18, background: 'rgba(226,232,240,.7)', border: '1px solid rgba(148,163,184,.18)' }} aria-hidden="true" />)}
    </section>;
  }

  if (error) {
    return <section role="alert" style={{ padding: 18, borderRadius: 18, border: '1px solid rgba(220,38,38,.18)', background: 'rgba(254,242,242,.96)', color: '#991b1b' }}>
      <strong>Unable to load {title(period).toLowerCase()}.</strong>
      <p style={{ margin: '6px 0 0', fontSize: 13 }}>{error}</p>
    </section>;
  }

  if (!periods.length) {
    return <section style={{ padding: 24, borderRadius: 18, border: '1px solid rgba(99,102,241,.14)', background: 'rgba(255,255,255,.92)', textAlign: 'center' }}>
      <h3 style={{ margin: 0, fontSize: 17 }}>No work recorded for these periods.</h3>
      <p style={{ margin: '7px 0 0', color: '#64748b', fontSize: 13 }}>Historical periods appear here when persisted Work Entries exist.</p>
    </section>;
  }

  return <section aria-label={`${title(period)} history`} style={{ display: 'grid', gap: 10 }}>
    {periods.map((row) => (
      <button key={row.period_start} type="button" onClick={() => onSelect(row)} style={{ width: '100%', padding: 18, borderRadius: 18, border: '1px solid rgba(99,102,241,.14)', background: 'rgba(255,255,255,.94)', boxShadow: '0 10px 28px rgba(15,23,42,.06)', textAlign: 'left', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ color: '#475569', fontSize: 11, fontWeight: 850, letterSpacing: '.06em', textTransform: 'uppercase' }}>{period === 'day' ? 'Work Day' : period === 'week' ? 'Work Week' : 'Work Month'}</div>
            <div style={{ marginTop: 5, fontSize: 17, fontWeight: 900, letterSpacing: '-.02em' }}>{periodLabel(period, row, timezone)}</div>
          </div>
          <span aria-hidden="true" style={{ fontSize: 22, color: '#64748b' }}>›</span>
        </div>
        <div style={{ marginTop: 18, fontSize: 'clamp(25px, 7vw, 34px)', fontWeight: 950, letterSpacing: '-.04em' }}>{formatWorkDecimal(String(row.period_total))}</div>
        <div style={{ marginTop: 6, color: '#64748b', fontSize: 13 }}>{row.entry_count} {row.entry_count === 1 ? 'Work Entry' : 'Work Entries'}</div>
      </button>
    ))}
    {hasMore && <button type="button" onClick={onMore} disabled={loadingMore} style={{ width: '100%', minHeight: 46, marginTop: 2, borderRadius: 13, border: '1px solid rgba(99,102,241,.18)', background: 'rgba(255,255,255,.96)', fontWeight: 850, cursor: loadingMore ? 'not-allowed' : 'pointer' }}>{loadingMore ? 'Loading more…' : 'More'}</button>}
  </section>;
}
