import type { WorkHistoryPeriod } from '../api/workEntries';
import type { WorkerWorkPeriod } from '../types/workPeriodHistory';
import { formatWorkDecimal } from '../logic/workEntryCalculations';
import { WorkerWorkEntryDetails } from './WorkerWorkEntryDetails';
import { WorkerWorkEntryList } from './WorkerWorkEntryList';
import { useWorkerWorkPeriodEntries } from '../hooks/useWorkerWorkPeriodEntries';

interface Props {
  period: Exclude<WorkHistoryPeriod, 'lifetime'>;
  selected: WorkerWorkPeriod;
  onBack: () => void;
}

function formatRange(period: Props['period'], item: WorkerWorkPeriod) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const start = new Date(item.period_start);
  const end = new Date(new Date(item.period_end).getTime() - 1);
  if (period === 'month') return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone }).format(start);
  if (period === 'day') return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone }).format(start);
  return new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', timeZone }).format(start) + ' – ' + new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric', timeZone }).format(end);
}

export function WorkerWorkPeriodDetails({ period, selected, onBack }: Props) {
  const history = useWorkerWorkPeriodEntries(selected.period_start, selected.period_end);
  return <main>
    <header style={{ marginBottom: 16 }}>
      <button type="button" onClick={onBack} style={{ minHeight: 40, padding: '0 12px', borderRadius: 11, fontWeight: 800, cursor: 'pointer' }}>← {period[0].toUpperCase() + period.slice(1)} History</button>
      <div style={{ marginTop: 14, padding: 18, border: '1px solid rgba(99,102,241,.14)', borderRadius: 18, background: 'rgba(255,255,255,.94)', boxShadow: '0 10px 28px rgba(15,23,42,.07)' }}>
        <div style={{ color: '#475569', fontSize: 11, fontWeight: 900, letterSpacing: '.07em', textTransform: 'uppercase' }}>{period} Earnings</div>
        <h1 style={{ margin: '6px 0 0', fontSize: 'clamp(25px, 7vw, 38px)', letterSpacing: '-.04em' }}>{formatRange(period, selected)}</h1>
        <div style={{ marginTop: 14, fontSize: 'clamp(28px, 8vw, 42px)', fontWeight: 950, letterSpacing: '-.045em' }}>{formatWorkDecimal(selected.period_total)}</div>
        <div style={{ marginTop: 5, color: '#64748b', fontSize: 12 }}>{selected.entry_count} {selected.entry_count === 1 ? 'Work Entry' : 'Work Entries'}</div>
      </div>
    </header>

    {history.error && <p role="alert" style={{ padding: 14, borderRadius: 14, background: '#fff1f2', color: '#b91c1c', fontWeight: 700 }}>{history.error}</p>}
    {history.loading ? <section style={{ padding: 18, border: '1px solid rgba(99,102,241,.14)', borderRadius: 18, background: 'rgba(255,255,255,.94)' }}><p style={{ margin: 0, color: '#64748b' }}>Loading period Work Entries…</p></section> : history.entries.length === 0 ? <section style={{ padding: 18, border: '1px solid rgba(99,102,241,.14)', borderRadius: 18, background: 'rgba(255,255,255,.94)', textAlign: 'center' }}><h2 style={{ margin: 0, fontSize: 17 }}>No work recorded for this period.</h2></section> : <>
      <WorkerWorkEntryList entries={history.entries} onOpen={(entry) => void history.openDetails(entry)} />
      {history.hasMore && <button type="button" onClick={history.loadMore} disabled={history.loadingMore} style={{ display: 'block', width: '100%', marginTop: 12, minHeight: 44, borderRadius: 12, fontWeight: 800, cursor: history.loadingMore ? 'not-allowed' : 'pointer' }}>{history.loadingMore ? 'Loading more…' : 'More'}</button>}
    </>}
    <WorkerWorkEntryDetails entry={history.selectedEntry} versions={history.versions} versionsLoading={history.versionsLoading} actionError={history.error} onClose={history.closeDetails} onEdit={history.editEntry} onTrash={history.trashEntry} />
  </main>;
}
