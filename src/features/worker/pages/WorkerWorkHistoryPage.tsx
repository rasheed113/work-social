import { useEffect, useMemo, useState } from 'react';
import { navigate } from '../../../app/Router';
import { useCurrentWorkerProfileId } from '../hooks/useCurrentWorkerProfileId';
import { useWorkerWorkHistory } from '../hooks/useWorkerWorkHistory';
import type { WorkHistoryPeriod, WorkHistoryPeriodBounds } from '../api/workEntries';
import { getWorkerWorkTotals } from '../api/workEntries';
import { formatWorkDecimal, getWorkerWorkDayBounds, getWorkerWorkMonthBounds, getWorkerWorkPeriodBounds, getWorkerWorkWeekBounds, getWorkerWorkWeekStart } from '../logic/workEntryCalculations';
import type { WorkerWorkTotals } from '../types/workEntry';
import { WorkerWorkEntryDetails } from '../components/WorkerWorkEntryDetails';
import { WorkerWorkEntryList } from '../components/WorkerWorkEntryList';

const cardStyle = { padding: 18, border: '1px solid rgba(99,102,241,.14)', borderRadius: 18, background: 'rgba(255,255,255,.92)', boxShadow: '0 10px 28px rgba(15,23,42,.07)' };
const EMPTY_TOTALS: WorkerWorkTotals = { daily_total: '0', weekly_total: '0', monthly_total: '0', lifetime_total: '0' };

type SelectedPeriod = Date;

function readPeriod(): WorkHistoryPeriod { const value = new URLSearchParams(window.location.search).get('period'); return value === 'day' || value === 'week' || value === 'month' ? value : 'lifetime'; }
function parseDateKey(raw: string | null): Date | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [year, month, day] = raw.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}
function readSelectedPeriod(period: WorkHistoryPeriod): SelectedPeriod {
  const params = new URLSearchParams(window.location.search);
  const raw = period === 'week' ? params.get('week') : period === 'day' ? params.get('day') : period === 'month' ? params.get('month') : null;
  const parsed = parseDateKey(raw);
  if (parsed) return period === 'week' ? getWorkerWorkWeekStart(parsed) : period === 'month' ? new Date(parsed.getFullYear(), parsed.getMonth(), 1) : parsed;
  return period === 'week' ? getWorkerWorkWeekStart() : period === 'month' ? new Date(new Date().getFullYear(), new Date().getMonth(), 1) : new Date();
}
function formatDate(value: Date) { return value.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
function dateKey(value: Date) { return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`; }
function monthKey(value: Date) { return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-01`; }
function shiftDay(value: Date, amount: number) { const next = new Date(value); next.setDate(next.getDate() + amount); return next; }
function shiftMonth(value: Date, amount: number) { return new Date(value.getFullYear(), value.getMonth() + amount, 1); }
function shiftWeek(value: Date, amount: number) { const next = new Date(value); next.setDate(next.getDate() + amount * 7); return getWorkerWorkWeekStart(next); }

export function WorkerWorkHistoryPage() {
  const session = useCurrentWorkerProfileId();
  const [period, setPeriod] = useState<WorkHistoryPeriod>(() => readPeriod());
  const [selectedPeriod, setSelectedPeriod] = useState<SelectedPeriod>(() => readSelectedPeriod(readPeriod()));
  const [totals, setTotals] = useState<WorkerWorkTotals>(EMPTY_TOTALS);
  const [totalsLoading, setTotalsLoading] = useState(true);
  const isDay = period === 'day';
  const isWeek = period === 'week';
  const isMonth = period === 'month';
  const currentDay = useMemo(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), now.getDate()); }, []);
  const currentMonth = useMemo(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1); }, []);
  const currentWeekStart = useMemo(() => getWorkerWorkWeekStart(), []);
  const selectedBounds: WorkHistoryPeriodBounds | null = useMemo(() => {
    if (isDay) { const bounds = getWorkerWorkDayBounds(selectedPeriod); return { start: bounds.dayStart, end: bounds.dayEnd }; }
    if (isWeek) { const bounds = getWorkerWorkWeekBounds(selectedPeriod); return { start: bounds.weekStart, end: bounds.weekEnd }; }
    if (isMonth) { const bounds = getWorkerWorkMonthBounds(selectedPeriod); return { start: bounds.monthStart, end: bounds.monthEnd }; }
    return null;
  }, [isDay, isWeek, isMonth, selectedPeriod]);
  const history = useWorkerWorkHistory(session.profileId ?? '', period, selectedBounds);

  useEffect(() => {
    if (!session.profileId) return;
    let active = true;
    setTotalsLoading(true);
    const bounds = getWorkerWorkPeriodBounds(selectedPeriod);
    if (isDay) { const selected = getWorkerWorkDayBounds(selectedPeriod); bounds.dayStart = selected.dayStart; bounds.dayEnd = selected.dayEnd; }
    if (isWeek) { const selected = getWorkerWorkWeekBounds(selectedPeriod); bounds.weekStart = selected.weekStart; bounds.weekEnd = selected.weekEnd; }
    if (isMonth) { const selected = getWorkerWorkMonthBounds(selectedPeriod); bounds.monthStart = selected.monthStart; bounds.monthEnd = selected.monthEnd; }
    void getWorkerWorkTotals(bounds).then((result) => { if (!active) return; if (!result.error) setTotals(result.data); setTotalsLoading(false); });
    return () => { active = false; };
  }, [session.profileId, isDay, isWeek, isMonth, selectedPeriod]);

  const changePeriod = (next: WorkHistoryPeriod) => {
    setPeriod(next);
    const nextSelected = readSelectedPeriod(next);
    setSelectedPeriod(nextSelected);
    if (next === 'week') navigate(`/work/history?period=week&week=${dateKey(nextSelected)}`);
    else if (next === 'day') navigate(`/work/history?period=day&day=${dateKey(nextSelected)}`);
    else if (next === 'month') navigate(`/work/history?period=month&month=${monthKey(nextSelected)}`);
    else navigate('/work/history');
  };
  const changeSelectedPeriod = (amount: number) => {
    const next = isDay ? shiftDay(selectedPeriod, amount) : isWeek ? shiftWeek(selectedPeriod, amount) : shiftMonth(selectedPeriod, amount);
    setSelectedPeriod(next);
    if (isDay) navigate(`/work/history?period=day&day=${dateKey(next)}`);
    else if (isWeek) navigate(`/work/history?period=week&week=${dateKey(next)}`);
    else navigate(`/work/history?period=month&month=${monthKey(next)}`);
  };
  const isCurrentDay = selectedPeriod.getTime() === currentDay.getTime();
  const isCurrentWeek = selectedPeriod.getTime() === currentWeekStart.getTime();
  const isCurrentMonth = selectedPeriod.getTime() === currentMonth.getTime();

  const editEntry = async (...args: Parameters<typeof history.editEntry>) => history.editEntry(...args);
  const trashEntry = async (entryId: string) => history.trashEntry(entryId);

  if (session.loading) return <main style={{ width: '100%', maxWidth: 900, margin: '0 auto', padding: '24px 14px 112px' }}><p style={{ color: '#64748b' }}>Loading Work History…</p></main>;
  if (session.error || !session.profileId) return <main style={{ width: '100%', maxWidth: 900, margin: '0 auto', padding: '24px 14px 112px' }}><p role="alert" style={{ color: '#b91c1c', fontWeight: 700 }}>{session.error ?? 'Authenticated profile is unavailable.'}</p></main>;

  let periodLabel = '';
  if (isDay) periodLabel = formatDate(selectedPeriod);
  else if (isWeek) { const end = new Date(selectedPeriod); end.setDate(end.getDate() + 6); periodLabel = `${formatDate(selectedPeriod)} – ${formatDate(end)}`; }
  else if (isMonth) periodLabel = selectedPeriod.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

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

      {(isDay || isWeek || isMonth) && <section style={{ ...cardStyle, marginBottom: 16 }} aria-label={`Selected ${period}`}>
        <div style={{ color: '#475569', fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase' }}>Selected {isDay ? 'Day' : isWeek ? 'Week' : 'Month'}</div>
        <div style={{ marginTop: 6, fontSize: 20, fontWeight: 900 }}>{periodLabel}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
          <button type="button" onClick={() => changeSelectedPeriod(-1)} style={{ minHeight: 44, borderRadius: 12, fontWeight: 800, cursor: 'pointer' }}>{isDay ? '← Previous Day' : isWeek ? '← Previous Week' : '← Previous Month'}</button>
          <button type="button" onClick={() => changeSelectedPeriod(1)} disabled={isDay ? isCurrentDay : isWeek ? isCurrentWeek : isCurrentMonth} style={{ minHeight: 44, borderRadius: 12, fontWeight: 800, cursor: (isDay ? isCurrentDay : isWeek ? isCurrentWeek : isCurrentMonth) ? 'not-allowed' : 'pointer', opacity: (isDay ? isCurrentDay : isWeek ? isCurrentWeek : isCurrentMonth) ? .5 : 1 }}>{isDay ? 'Next Day →' : isWeek ? 'Next Week →' : 'Next Month →'}</button>
        </div>
        {isDay && <div style={{ marginTop: 14, color: '#64748b', fontSize: 12 }}>Daily Total: <strong style={{ color: '#0f172a' }}>{totalsLoading ? 'Loading…' : formatWorkDecimal(totals.daily_total)}</strong></div>}
        {isWeek && <div style={{ marginTop: 14, color: '#64748b', fontSize: 12 }}>Weekly Total: <strong style={{ color: '#0f172a' }}>{totalsLoading ? 'Loading…' : formatWorkDecimal(totals.weekly_total)}</strong></div>}
        {isMonth && <div style={{ marginTop: 14, color: '#64748b', fontSize: 12 }}>Monthly Total: <strong style={{ color: '#0f172a' }}>{totalsLoading ? 'Loading…' : formatWorkDecimal(totals.monthly_total)}</strong></div>}
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
