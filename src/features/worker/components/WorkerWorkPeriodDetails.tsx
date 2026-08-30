import { useCallback, useEffect, useState } from 'react';
import { getWorkerWorkPeriodHistory, listWorkerWorkEntriesBetween } from '../api/workEntries';
import type { WorkHistoryCursor, WorkerWorkPeriod, WorkerWorkPeriodBounds, WorkerWorkPeriodHistoryRow } from '../api/workEntries';
import { formatWorkDecimal } from '../logic/workEntryCalculations';
import { WorkerWorkEntryList } from './WorkerWorkEntryList';

interface WorkerWorkPeriodDetailsProps {
  period: WorkerWorkPeriod;
  bounds: WorkerWorkPeriodBounds;
  timezone: string;
  onBack: () => void;
}

const INITIAL_ENTRY_PAGE_SIZE = 5;
const MORE_ENTRY_PAGE_SIZE = 10;
const cardStyle = { padding: 18, border: '1px solid rgba(99,102,241,.14)', borderRadius: 18, background: 'rgba(255,255,255,.92)', boxShadow: '0 10px 28px rgba(15,23,42,.07)' };

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

export function WorkerWorkPeriodDetails({ period, bounds, timezone, onBack }: WorkerWorkPeriodDetailsProps) {
  const [row, setRow] = useState<WorkerWorkPeriodHistoryRow | null>(null);
  const [entries, setEntries] = useState<Awaited<ReturnType<typeof listWorkerWorkEntriesBetween>>['data']>([]);
  const [entryCount, setEntryCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreEntries, setHasMoreEntries] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEntries = useCallback(async (append = false) => {
    if (append && loadingMore) return;
    if (append) setLoadingMore(true);
    const cursor: WorkHistoryCursor | null = append && entries.length
      ? { occurred_at: entries[entries.length - 1].occurred_at, id: entries[entries.length - 1].id }
      : null;
    const result = await listWorkerWorkEntriesBetween(append ? MORE_ENTRY_PAGE_SIZE : INITIAL_ENTRY_PAGE_SIZE, bounds, cursor);
    if (result.error) setError(result.error.message);
    else {
      const next = append ? [...entries, ...result.data] : result.data;
      setEntries(next);
      setEntryCount(result.count);
      setHasMoreEntries(next.length < result.count);
    }
    if (append) setLoadingMore(false);
  }, [bounds, entries, loadingMore]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setEntries([]);
    setEntryCount(0);
    setHasMoreEntries(false);
    const cursor = bounds.end;
    void Promise.all([
      getWorkerWorkPeriodHistory(period, timezone, cursor, 1),
      listWorkerWorkEntriesBetween(INITIAL_ENTRY_PAGE_SIZE, bounds),
    ]).then(([historyResult, entriesResult]) => {
      if (!active) return;
      if (historyResult.error) setError(historyResult.error.message);
      else {
        const exact = historyResult.data.find((candidate) => candidate.period_start === bounds.start);
        if (!exact) setError('The selected persisted period is no longer available.');
        else setRow(exact);
      }
      if (entriesResult.error) setError(entriesResult.error.message);
      else {
        setEntries(entriesResult.data);
        setEntryCount(entriesResult.count);
        setHasMoreEntries(entriesResult.data.length < entriesResult.count);
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, [bounds.end, bounds.start, period, timezone]);

  return <section>
    <button type="button" onClick={onBack} style={{ minHeight: 40, padding: '0 12px', borderRadius: 11, fontWeight: 800, cursor: 'pointer' }}>← {title(period)} history</button>
    {loading ? <section style={{ ...cardStyle, marginTop: 16 }}><p style={{ margin: 0, color: '#64748b' }}>Loading period…</p></section> : error || !row ? <section role="alert" style={{ marginTop: 16, padding: 18, borderRadius: 18, background: '#fef2f2', color: '#991b1b' }}><strong>Unable to load this period.</strong><p style={{ margin: '6px 0 0', fontSize: 13 }}>{error ?? 'The selected period is unavailable.'}</p></section> : <>
      <header style={{ marginTop: 16, padding: 20, borderRadius: 20, border: '1px solid rgba(99,102,241,.14)', background: 'rgba(255,255,255,.94)', boxShadow: '0 10px 28px rgba(15,23,42,.07)' }}>
        <div style={{ color: '#64748b', fontSize: 11, fontWeight: 850, letterSpacing: '.07em', textTransform: 'uppercase' }}>{title(period)}</div>
        <h2 style={{ margin: '5px 0 0', fontSize: 'clamp(24px, 6vw, 32px)', letterSpacing: '-.035em' }}>{label(period, row, timezone)}</h2>
        <div style={{ marginTop: 16, fontSize: 'clamp(28px, 8vw, 40px)', fontWeight: 950, letterSpacing: '-.045em' }}>{formatWorkDecimal(String(row.period_total))}</div>
        <div style={{ marginTop: 5, color: '#64748b', fontSize: 13 }}>{entryCount || row.entry_count} {(entryCount || row.entry_count) === 1 ? 'Work Entry' : 'Work Entries'}</div>
      </header>

      <section style={{ marginTop: 18 }} aria-labelledby="period-entry-list-heading">
        <h3 id="period-entry-list-heading" style={{ margin: '0 0 10px', fontSize: 18 }}>Work Entries</h3>
        <WorkerWorkEntryList entries={entries} emptyTitle="No Work Entries in this period" emptyDescription="This persisted period currently has no visible active Work Entries." onOpen={() => undefined} />
        {hasMoreEntries && <button type="button" onClick={() => void loadEntries(true)} disabled={loadingMore} style={{ width: '100%', minHeight: 44, marginTop: 10, borderRadius: 12, fontWeight: 800, cursor: loadingMore ? 'not-allowed' : 'pointer' }}>{loadingMore ? 'Loading more…' : 'More'}</button>}
      </section>
    </>}
  </section>;
}
