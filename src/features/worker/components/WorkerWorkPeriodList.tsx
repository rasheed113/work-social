import type { WorkerWorkPeriod } from '../types/workPeriodHistory';
import type { WorkerWorkPeriodType } from '../types/workPeriodHistory';
import { formatWorkDecimal } from '../logic/workEntryCalculations';

interface Props {
  period: WorkerWorkPeriodType;
  periods: WorkerWorkPeriod[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  onMore: () => void;
  onOpen: (period: WorkerWorkPeriod) => void;
}

const cardStyle = {
  padding: 17,
  border: '1px solid rgba(99,102,241,.14)',
  borderRadius: 18,
  background: 'rgba(255,255,255,.94)',
  boxShadow: '0 10px 28px rgba(15,23,42,.07)',
};

function periodRange(period: WorkerWorkPeriodType, item: WorkerWorkPeriod) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const start = new Date(item.period_start);
  const endExclusive = new Date(item.period_end);
  const end = new Date(endExclusive.getTime() - 1);
  if (period === 'month') {
    return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone }).format(start);
  }
  if (period === 'day') {
    return new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone }).format(start);
  }
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone }).format(start)
    + ' – ' + new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone }).format(end);
}

function periodTitle(period: WorkerWorkPeriodType, index: number) {
  if (index === 0) return period === 'day' ? 'Today' : period === 'week' ? 'This Week' : 'This Month';
  return 'Historical';
}

export function WorkerWorkPeriodList({ period, periods, loading, loadingMore, hasMore, error, onMore, onOpen }: Props) {
  if (loading) {
    return <section style={cardStyle} aria-busy="true"><p style={{ margin: 0, color: '#64748b' }}>Loading {period} history…</p></section>;
  }
  if (error) {
    return <section style={cardStyle} role="alert"><p style={{ margin: 0, color: '#b91c1c', fontWeight: 700 }}>{error}</p></section>;
  }
  if (!periods.length) {
    return <section style={{ ...cardStyle, textAlign: 'center' }}><h3 style={{ margin: 0, fontSize: 17 }}>No work recorded</h3><p style={{ margin: '7px 0 0', color: '#64748b', fontSize: 13 }}>No recorded {period} periods are available.</p></section>;
  }

  return <section aria-label={`${period} earnings history`} style={{ display: 'grid', gap: 10 }}>
    {periods.map((item, index) => (
      <button key={item.period_start} type="button" onClick={() => onOpen(item)} style={{ ...cardStyle, width: '100%', textAlign: 'left', cursor: 'pointer', font: 'inherit' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
          <div>
            <div style={{ color: '#475569', fontSize: 11, fontWeight: 900, letterSpacing: '.07em', textTransform: 'uppercase' }}>{periodTitle(period, index)}</div>
            <div style={{ marginTop: 5, fontSize: 16, fontWeight: 850 }}>{periodRange(period, item)}</div>
          </div>
          <span aria-hidden="true" style={{ color: '#64748b', fontSize: 22, lineHeight: 1 }}>›</span>
        </div>
        <div style={{ marginTop: 16, fontSize: 'clamp(24px, 7vw, 34px)', fontWeight: 950, letterSpacing: '-.045em' }}>{formatWorkDecimal(item.period_total)}</div>
        <div style={{ marginTop: 5, color: '#64748b', fontSize: 12 }}>{item.entry_count} {item.entry_count === 1 ? 'Work Entry' : 'Work Entries'}</div>
      </button>
    ))}
    {hasMore && <button type="button" onClick={onMore} disabled={loadingMore} style={{ ...cardStyle, minHeight: 46, fontWeight: 900, cursor: loadingMore ? 'not-allowed' : 'pointer' }}>{loadingMore ? 'Loading older periods…' : 'More'}</button>}
  </section>;
}
