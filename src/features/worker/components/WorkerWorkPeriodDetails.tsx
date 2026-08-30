import { useEffect, useState } from 'react';
import { listWorkerWorkEntriesBetween } from '../api/workEntries';
import type { WorkerWorkPeriod, WorkerWorkPeriodBounds, WorkerWorkPeriodHistoryRow } from '../api/workEntries';
import { formatWorkDecimal } from '../logic/workEntryCalculations';
import { WorkerWorkEntryList } from './WorkerWorkEntryList';

interface WorkerWorkPeriodDetailsProps {
  period: WorkerWorkPeriod;
  row: WorkerWorkPeriodHistoryRow;
  timezone: string;
  onBack: () => void;
}

function formatDate(value: string, timezone: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(undefined, { ...options, timeZone: timezone }).format(new Date(value));
}

function label(period: WorkerWorkPeriod, row: WorkerWorkPeriodHistoryRow, timezone: string) {
  if (period === 'day') return formatDate(row.period_start, timezone, { month: 'short', day: 'numeric', year: 'numeric' });
  if (period === 'month') return formatDate(row.period_start, timezone, { month: 'long', year: 'numeric' });
  const start = formatDate(row.period_start, timezone, { month: 'short', day: 'numeric' });
  const end = formatDate(new Date(new Date(row.period_end).getTime() - 1).toISOString(), timezone, { month: 'short', day: 'numeric', year: 'numeric' });
  return `${start} – ${end}`;
}

function title(period: WorkerWorkPeriod) {
  return period === 'day' ? 'Daily Earnings' : period === 'week' ? 'Weekly Earnings' : 'Monthly Earnings';
}

export function WorkerWorkPeriodDetails({ period, row, timezone, onBack }: WorkerWorkPeriodDetailsProps) {
  const [entries, setEntries] = useState<Awaited<ReturnType<typeof listWorkerWorkEntriesBetween>>['data']>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    const bounds: WorkerWorkPeriodBounds = { start: row.period_start, end: row.period_end };
    void listWorkerWorkEntriesBetween(50, bounds).then((result) => {
      if (!active) return;
      if (result.error) setError(result.error.message); else setEntries(result.data);
      setLoading(false);
    });
    return () => { active = false; };
  }, [row.period_start, row.period_end]);

  return <section>
    <button type="button" onClick={onBack} style={{ minHeight: 40, padding: '0 12px', borderRadius: 11, fontWeight: 800, cursor: 'pointer' }}>← {title(period)} history</button>
    <header style={{ marginTop: 16, padding: 20, borderRadius: 20, border: '1px solid rgba(99,102,241,.14)', background: 'rgba(255,255,255,.94)', boxShadow: '0 10px 28px rgba(15,23,42,.07)' }}>
      <div style={{ color: '#64748b', fontSize: 11, fontWeight: 850, letterSpacing: '.07em', textTransform: 'uppercase' }}>{title(period)}</div>
      <h2 style={{ margin: '5px 0 0', fontSize: 'clamp(24px, 6vw, 32px)', letterSpacing: '-.035em' }}>{label(period, row, timezone)}</h2>
      <div style={{ marginTop: 16, fontSize: 'clamp(28px, 8vw, 40px)', fontWeight: 950, letterSpacing: '-.045em' }}>{formatWorkDecimal(String(row.period_total))}</div>
      <div style={{ marginTop: 5, color: '#64748b', fontSize: 13 }}>{row.entry_count} {row.entry_count === 1 ? 'Work Entry' : 'Work Entries'}</div>
    </header>

    <section style={{ marginTop: 18 }} aria-labelledby="period-entry-list-heading">
      <h3 id="period-entry-list-heading" style={{ margin: '0 0 10px', fontSize: 18 }}>Work Entries</h3>
      {loading ? <section style={{ padding: 18, borderRadius: 18, background: '#f8fafc', color: '#64748b' }}>Loading Work Entries…</section>
        : error ? <section role="alert" style={{ padding: 18, borderRadius: 18, background: '#fef2f2', color: '#991b1b' }}><strong>Unable to load this period.</strong><p style={{ margin: '6px 0 0', fontSize: 13 }}>{error}</p></section>
          : <WorkerWorkEntryList entries={entries} emptyTitle="No Work Entries in this period" emptyDescription="This persisted period currently has no visible active Work Entries." onOpen={() => undefined} />}
    </section>
  </section>;
}
