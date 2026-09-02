import { useEffect, useState } from 'react';
import { navigate } from '../../../app/Router';
import { useCurrentWorkerProfileId } from '../hooks/useCurrentWorkerProfileId';
import { useWorkerWorkHistory } from '../hooks/useWorkerWorkHistory';
import { useWorkerWorkPeriodHistory } from '../hooks/useWorkerWorkPeriodHistory';
import { getWorkerWorkTotals } from '../api/workEntries';
import type { WorkHistoryPeriod } from '../api/workEntries';
import type { WorkerWorkTotals } from '../types/workEntry';
import type { WorkerWorkPeriod, WorkerWorkPeriodType } from '../types/workPeriodHistory';
import { getWorkerWorkPeriodBounds, formatWorkDecimal } from '../logic/workEntryCalculations';
import { WorkerWorkEntryDetails } from '../components/WorkerWorkEntryDetails';
import { WorkerWorkEntryList } from '../components/WorkerWorkEntryList';
import { WorkerWorkPeriodList } from '../components/WorkerWorkPeriodList';
import { WorkerWorkPeriodDetails } from '../components/WorkerWorkPeriodDetails';

const cardStyle = { padding: 18, border: '1px solid rgba(99,102,241,.14)', borderRadius: 18, background: 'rgba(255,255,255,.92)', boxShadow: '0 10px 28px rgba(15,23,42,.07)' };
const EMPTY_TOTALS: WorkerWorkTotals = { daily_total: '0', weekly_total: '0', monthly_total: '0', lifetime_total: '0' };

function readPeriod(): WorkHistoryPeriod {
  const value = new URLSearchParams(window.location.search).get('period');
  return value === 'day' || value === 'week' || value === 'month' ? value : 'lifetime';
}

export function WorkerWorkHistoryPage() {
  const session = useCurrentWorkerProfileId();
  const [period, setPeriod] = useState<WorkHistoryPeriod>(() => readPeriod());
  const [totals, setTotals] = useState<WorkerWorkTotals>(EMPTY_TOTALS);
  const [totalsLoading, setTotalsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<WorkerWorkPeriod | null>(null);

  const history = useWorkerWorkHistory(session.profileId ?? '', period);
  const periodHistory = useWorkerWorkPeriodHistory(period === 'lifetime' ? 'day' : period as WorkerWorkPeriodType);

  useEffect(() => {
    setSelectedPeriod(null);
    if (!session.profileId) return;
    let active = true;
    setTotalsLoading(true);
    void getWorkerWorkTotals(getWorkerWorkPeriodBounds()).then((result) => {
      if (!active) return;
      if (!result.error) setTotals(result.data);
      setTotalsLoading(false);
    });
    return () => { active = false; };
  }, [session.profileId, period]);

  const changePeriod = (next: WorkHistoryPeriod) => {
    setSelectedPeriod(null);
    setPeriod(next);
    navigate(next === 'lifetime' ? '/work/history' : `/work/history?period=${next}`);
  };

  if (session.loading) return <main style={{ width: '100%', maxWidth: 900, margin: '0 auto', padding: '24px 14px 112px' }}><p style={{ color: '#64748b' }}>Loading Work History…</p></main>;
  if (session.error || !session.profileId) return <main style={{ width: '100%', maxWidth: 900, margin: '0 auto', padding: '24px 14px 112px' }}><p role="alert" style={{ color: '#b91c1c', fontWeight: 700 }}>{session.error ?? 'Authenticated profile is unavailable.'}</p></main>;

  return <main style={{ width: '100%', maxWidth: 900, margin: '0 auto', padding: '24px 14px 112px', boxSizing: 'border-box' }}>
    <header style={{ marginBottom: 18 }}>
      <button type="button" onClick={() => navigate('/work')} style={{ minHeight: 40, padding: '0 12px', borderRadius: 11, fontWeight: 800, cursor: 'pointer' }}>← Work House</button>
      <h1 style={{ margin: '14px 0 0', fontSize: 'clamp(28px, 7vw, 42px)', letterSpacing: '-.04em' }}>Work History</h1>
      <p style={{ margin: '7px 0 0', color: '#64748b', lineHeight: 1.5 }}>Real persisted Work Entries and period earnings, newest first.</p>
    </header>

    <section style={{ ...cardStyle, marginBottom: 14 }} aria-label="Lifetime Grand Total">
      <div style={{ color: '#475569', fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase' }}>Lifetime / Grand Total</div>
      <div style={{ marginTop: 5, fontSize: 'clamp(27px, 8vw, 40px)', fontWeight: 950, letterSpacing: '-.045em' }}>{totalsLoading ? 'Loading…' : formatWorkDecimal(totals.lifetime_total)}</div>
      <div style={{ marginTop: 5, color: '#64748b', fontSize: 12 }}>Authoritative persisted total; it remains independent from visible period pages.</div>
    </section>

    <nav aria-label="Work History shortcuts" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 8, marginBottom: 16 }}>
      {(['lifetime', 'day', 'week', 'month'] as const).map((item) => <button key={item} type="button" onClick={() => changePeriod(item)} aria-pressed={period === item} style={{ minHeight: 42, borderRadius: 11, border: period === item ? '1px solid rgba(37,99,235,.5)' : '1px solid rgba(99,102,241,.14)', background: period === item ? 'rgba(219,234,254,.9)' : 'rgba(255,255,255,.94)', fontWeight: 800, cursor: 'pointer' }}>{item === 'lifetime' ? 'All' : item[0].toUpperCase() + item.slice(1)}</button>)}
    </nav>

    {period === 'lifetime' ? <section aria-labelledby="worker-history-list-heading">
      <h2 id="worker-history-list-heading" style={{ margin: '0 0 10px', fontSize: 19 }}>Work Entries</h2>
      {history.actionError && <p role="alert" style={{ ...cardStyle, color: '#b91c1c', fontSize: 13, fontWeight: 700 }}>{history.actionError}</p>}
      {history.loading ? <section style={cardStyle}><p style={{ margin: 0, color: '#64748b' }}>Loading Work History…</p></section> : history.entries.length === 0 ? <section style={{ ...cardStyle, textAlign: 'center' }}><h3 style={{ margin: 0, fontSize: 17 }}>No Work Entries yet</h3><p style={{ margin: '7px 0 0', color: '#64748b', fontSize: 13 }}>Persisted Work Entries will appear here when they exist.</p></section> : <><WorkerWorkEntryList entries={history.entries} onOpen={(entry) => void history.openDetails(entry)} />{history.hasMore && <button type="button" onClick={() => void history.loadMore()} disabled={history.loadingMore} style={{ display: 'block', width: '100%', marginTop: 12, minHeight: 44, borderRadius: 12, fontWeight: 800, cursor: history.loadingMore ? 'not-allowed' : 'pointer' }}>{history.loadingMore ? 'Loading more…' : 'More'}</button>}</>}
      <WorkerWorkEntryDetails entry={history.selectedEntry} versions={history.versions} versionsLoading={history.versionsLoading} actionError={history.actionError} onClose={history.closeDetails} onEdit={history.editEntry} onTrash={history.trashEntry} />
    </section> : selectedPeriod ? <WorkerWorkPeriodDetails period={period} selected={selectedPeriod} onBack={() => setSelectedPeriod(null)} /> : <>
      <section style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 19 }}>{period === 'day' ? 'Daily Earnings' : period === 'week' ? 'Weekly Earnings' : 'Monthly Earnings'}</h2>
        <p style={{ margin: '5px 0 0', color: '#64748b', fontSize: 13 }}>Current period first, then older periods. Each card is calculated from persisted Work Entries.</p>
      </section>
      <WorkerWorkPeriodList period={period} periods={periodHistory.periods} loading={periodHistory.loading} loadingMore={periodHistory.loadingMore} hasMore={periodHistory.hasMore} error={periodHistory.error} onMore={periodHistory.loadMore} onOpen={setSelectedPeriod} />
    </>}
  </main>;
}
