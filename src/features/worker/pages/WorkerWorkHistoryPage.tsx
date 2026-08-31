import { useEffect, useMemo, useState } from 'react';
import { navigate } from '../../../app/Router';
import { useCurrentWorkerProfileId } from '../hooks/useCurrentWorkerProfileId';
import { useWorkerWorkHistory } from '../hooks/useWorkerWorkHistory';
import type { WorkHistoryPeriod, WorkHistoryPeriodBounds } from '../api/workEntries';
import { getWorkerWorkTotals } from '../api/workEntries';
import { formatWorkDecimal, getWorkerWorkPeriodBounds, getWorkerWorkWeekBounds, getWorkerWorkWeekStart } from '../logic/workEntryCalculations';
import type { WorkerWorkTotals } from '../types/workEntry';
import { WorkerWorkEntryDetails } from '../components/WorkerWorkEntryDetails';
import { WorkerWorkEntryList } from '../components/WorkerWorkEntryList';

const cardStyle = { padding: 18, border: '1px solid rgba(99,102,241,.14)', borderRadius: 18, background: 'rgba(255,255,255,.92)', boxShadow: '0 10px 28px rgba(15,23,42,.07)' };
const EMPTY_TOTALS: WorkerWorkTotals = { daily_total: '0', weekly_total: '0', monthly_total: '0', lifetime_total: '0' };

function readPeriod(): WorkHistoryPeriod { const value = new URLSearchParams(window.location.search).get('period'); return value === 'day' || value === 'week' || value === 'month' ? value : 'lifetime'; }
function readWeekStart() {
  const raw = new URLSearchParams(window.location.search).get('week');
  if (!raw) return getWorkerWorkWeekStart();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return getWorkerWorkWeekStart();
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? getWorkerWorkWeekStart() : getWorkerWorkWeekStart(date);
}
function formatDate(value: Date) { return value.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
function weekKey(value: Date) { return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`; }
function shiftWeek(value: Date, amount: number) { const next = new Date(value); next.setDate(next.getDate() + amount * 7); return getWorkerWorkWeekStart(next); }

export function WorkerWorkHistoryPage() {
  const session = useCurrentWorkerProfileId();
  const [period, setPeriod] = useState<WorkHistoryPeriod>(() => readPeriod());
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(() => readWeekStart());
  const [totals, setTotals] = useState<WorkerWorkTotals>(EMPTY_TOTALS);
  const [totalsLoading, setTotalsLoading] = useState(true);
  const isWeek = period === 'week';
  const currentWeekStart = useMemo(() => getWorkerWorkWeekStart(), []);
  const selectedWeekBounds: WorkHistoryPeriodBounds | null = useMemo(() => isWeek ? (() => { const bounds = getWorkerWorkWeekBounds(selectedWeekStart); return { start: bounds.weekStart, end: bounds.weekEnd }; })() : null, [isWeek, selectedWeekStart]);
  const history = useWorkerWorkHistory(session.profileId ?? '', period, selectedWeekBounds);

  useEffect(() => {
    if (!session.profileId) return;
    let active = true;
    setTotalsLoading(true);
    const bounds = isWeek ? (() => { const selected = getWorkerWorkWeekBounds(selectedWeekStart); const base = getWorkerWorkPeriodBounds(selectedWeekStart); return { ...base, weekStart: selected.weekStart, weekEnd: selected.weekEnd }; })() : getWorkerWorkPeriodBounds();
    void getWorkerWorkTotals(bounds).then((result) => { if (!active) return; if (!result.error) setTotals(result.data); setTotalsLoading(false); });
    return () => { active = false; };
  }, [session.profileId, isWeek, selectedWeekStart]);

  const changePeriod = (next: WorkHistoryPeriod) => {
    setPeriod(next);
    if (next === 'week') {
      const week = weekKey(selectedWeekStart);
      navigate(`/work/history?period=week&week=${week}`);
    } else navigate(next === 'lifetime' ? '/work/history' : `/work/history?period=${next}`);
  };
  const changeWeek = (amount: number) => {
    const next = shiftWeek(selectedWeekStart, amount);
    setSelectedWeekStart(next);
    navigate(`/work/history?period=week&week=${weekKey(next)}`);
  };
  const isCurrentWeek = selectedWeekStart.getTime() === currentWeekStart.getTime();

  const editEntry = async (...args: Parameters<typeof history.editEntry>) => history.editEntry(...args);
  const trashEntry = async (entryId: string) => history.trashEntry(entryId);

  if (session.loading) return <main style={{ width: '100%', maxWidth: 900, margin: '0 auto', padding: '24px 14px 112px' }}><p style={{ color: '#64748b' }}>Loading Work History…</p></main>;
  if (session.error || !session.profileId) return <main style={{ width: '100%', maxWidth: 900, margin: '0 auto', padding: '24px 14px 112px' }}><p role="alert" style={{ color: '#b91c1c', fontWeight: 700 }}>{session.error ?? 'Authenticated profile is unavailable.'}</p></main>;

  const weekEnd = new Date(selectedWeekStart); weekEnd.setDate(weekEnd.getDate() + 6);

  return (
    <main style={{ width: '100%', maxWidth: 900, margin: '0 auto', padding: '24px 14px 112px', boxSizing: 'border-box' }}>
      <header style={{ marginBottom: 18 }}>
        <button type="button" onClick={() => navigate('/work')} style={{ minHeight: 40, padding: '0 12px', borderRadius: 11, fontWeight: 800, cursor: 'pointer' }}>← Work House</button>
        <h1 style={{ margin: '14px 0 0', fontSize: 'clamp(28px, 7vw, 42px)', letterSpacing: '-.04em' }}>Work History</h1>
        <p style={{ margin: '7px 0 0', color: '#64748b', lineHeight: 1.5 }}>Real persisted Work Entries, newest first. The list loads five initially, then ten more per request.</p>
      </header>

      <section style={{ ...cardStyle, marginBottom: 14 }} aria-label="Lifetime Grand Total">
        <div style={{ color: '#475569', fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase' }}>Lifetime / Grand Total</div>
        <div style={{ marginTop: 5, fontSize: 'clamp(27px, 8vw, 40px)', fontWeight: 950, letterSpacing: '-.045em' }}>{totalsLoading ? 'Loading…' : formatWorkDecimal(totals.lifetime_total)}</div>
        <div style={{ marginTop: 5, color: '#64748b', fontSize: 12 }}>Authoritative persisted total; it is independent from the visible page size.</div>
      </section>

      <nav aria-label="Work History shortcuts" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 8, marginBottom: 16 }}>
        {(['lifetime', 'day', 'week', 'month'] as const).map((item) => <button key={item} type="button" onClick={() => changePeriod(item)} aria-pressed={period === item} style={{ minHeight: 42, borderRadius: 11, border: period === item ? '1px solid rgba(37,99,235,.5)' : '1px solid rgba(99,102,241,.14)', background: period === item ? 'rgba(219,234,254,.9)' : 'rgba(255,255,255,.94)', fontWeight: 800, cursor: 'pointer' }}>{item === 'lifetime' ? 'All' : item[0].toUpperCase() + item.slice(1)}</button>)}
      </nav>

      {isWeek && <section style={{ ...cardStyle, marginBottom: 16 }} aria-label="Selected week">
        <div style={{ color: '#475569', fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase' }}>Selected Week</div>
        <div style={{ marginTop: 6, fontSize: 20, fontWeight: 900 }}>{formatDate(selectedWeekStart)} – {formatDate(weekEnd)}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
          <button type="button" onClick={() => changeWeek(-1)} style={{ minHeight: 44, borderRadius: 12, fontWeight: 800, cursor: 'pointer' }}>← Previous Week</button>
          <button type="button" onClick={() => changeWeek(1)} disabled={isCurrentWeek} style={{ minHeight: 44, borderRadius: 12, fontWeight: 800, cursor: isCurrentWeek ? 'not-allowed' : 'pointer', opacity: isCurrentWeek ? .5 : 1 }}>Next Week →</button>
        </div>
        <div style={{ marginTop: 14, color: '#64748b', fontSize: 12 }}>Weekly Total: <strong style={{ color: '#0f172a' }}>{totalsLoading ? 'Loading…' : formatWorkDecimal(totals.weekly_total)}</strong></div>
      </section>}

      <section aria-labelledby="worker-history-list-heading">
        <h2 id="worker-history-list-heading" style={{ margin: '0 0 10px', fontSize: 19 }}>Work Entries</h2>
        {history.actionError && <p role="alert" style={{ ...cardStyle, color: '#b91c1c', fontSize: 13, fontWeight: 700 }}>{history.actionError}</p>}
        {history.loading ? <section style={cardStyle}><p style={{ margin: 0, color: '#64748b' }}>Loading Work History…</p></section> : history.entries.length === 0 ? <section style={{ ...cardStyle, textAlign: 'center' }}><h3 style={{ margin: 0, fontSize: 17 }}>No Work Entries yet</h3><p style={{ margin: '7px 0 0', color: '#64748b', fontSize: 13 }}>Persisted Work Entries will appear here when they exist.</p></section> : <><WorkerWorkEntryList entries={history.entries} onOpen={(entry) => void history.openDetails(entry)} />{history.hasMore && <button type="button" onClick={() => void history.loadMore()} disabled={history.loadingMore} style={{ display: 'block', width: '100%', marginTop: 12, minHeight: 44, borderRadius: 12, fontWeight: 800, cursor: history.loadingMore ? 'not-allowed' : 'pointer' }}>{history.loadingMore ? 'Loading more…' : 'More'}</button>}</>}
      </section>

      <WorkerWorkEntryDetails entry={history.selectedEntry} versions={history.versions} versionsLoading={history.versionsLoading} actionError={history.actionError} onClose={history.closeDetails} onEdit={editEntry} onTrash={trashEntry} />
    </main>
  );
}
