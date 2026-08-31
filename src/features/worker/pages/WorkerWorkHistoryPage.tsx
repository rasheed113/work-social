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
  const nextDisabled = isDay ? isCurrentDay : isWeek ? isCurrentWeek : isCurrentMonth;
  const editEntry = async (...args: Parameters<typeof history.editEntry>) => history.editEntry(...args);
  const trashEntry = async (entryId: string) => history.trashEntry(entryId);

  if (session.loading) return <main className="worker-history"><section className="worker-history__state"><span className="worker-history__state-mark" aria-hidden="true">◌</span><p>Loading Work History…</p></section></main>;
  if (session.error || !session.profileId) return <main className="worker-history"><section className="worker-history__state worker-history__state--error"><span className="worker-history__state-mark" aria-hidden="true">!</span><p role="alert">{session.error ?? 'Authenticated profile is unavailable.'}</p></section></main>;

  let periodLabel = '';
  if (isDay) periodLabel = formatDate(selectedPeriod);
  else if (isWeek) { const end = new Date(selectedPeriod); end.setDate(end.getDate() + 6); periodLabel = `${formatDate(selectedPeriod)} – ${formatDate(end)}`; }
  else if (isMonth) periodLabel = selectedPeriod.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <main className="worker-history">
      <style>{`
        .worker-history{--wh-ink:#172033;--wh-muted:#64748b;width:100%;max-width:900px;margin:0 auto;padding:clamp(16px,3vw,24px) clamp(9px,2.5vw,14px) 112px;box-sizing:border-box;color:var(--wh-ink)}
        .worker-history::before{content:'';position:fixed;z-index:-1;inset:0;pointer-events:none;background:radial-gradient(circle at 8% 0%,rgba(99,102,241,.055),transparent 30%),radial-gradient(circle at 94% 42%,rgba(20,184,166,.045),transparent 32%),linear-gradient(180deg,#f8fafc 0%,#f5f7fb 60%,#f8fafc 100%)}
        .worker-history__hero{position:relative;margin-bottom:14px;padding:clamp(15px,3vw,21px);border:1px solid rgba(99,102,241,.17);border-radius:20px;background:linear-gradient(145deg,rgba(255,255,255,.99),rgba(247,249,255,.98) 58%,rgba(242,253,251,.96));box-shadow:0 16px 28px rgba(15,23,42,.08),0 4px 9px rgba(15,23,42,.045),inset 0 1px 0 #fff,inset 0 -1px 0 rgba(99,102,241,.06);isolation:isolate}
        .worker-history__hero::before{content:'';position:absolute;z-index:-1;inset:8px 12px -7px;border-radius:20px;background:linear-gradient(90deg,rgba(99,102,241,.10),rgba(20,184,166,.065));filter:blur(10px);opacity:.75}
        .worker-history__hero::after,.worker-history__surface::after{content:'';position:absolute;top:0;left:16px;right:16px;height:1px;border-radius:999px;background:linear-gradient(90deg,rgba(255,255,255,1),rgba(99,102,241,.36),rgba(20,184,166,.18),rgba(255,255,255,0));box-shadow:0 1px 4px rgba(255,255,255,.8);pointer-events:none}
        .worker-history__back{min-height:38px;padding:0 12px;border:1px solid rgba(71,85,105,.15);border-radius:11px;background:linear-gradient(145deg,#fff,#f5f7fa);color:#273449;font:inherit;font-size:11px;font-weight:900;cursor:pointer;box-shadow:0 6px 11px rgba(15,23,42,.055),0 2px 4px rgba(15,23,42,.03),inset 0 1px 0 #fff;transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease}
        .worker-history__back:hover{transform:translateY(-1px);box-shadow:0 9px 15px rgba(15,23,42,.08),inset 0 1px 0 #fff}.worker-history__back:active{transform:translateY(1px);box-shadow:0 4px 7px rgba(15,23,42,.06),inset 0 2px 3px rgba(15,23,42,.035)}
        .worker-history__back:focus-visible,.worker-history__segment:focus-visible,.worker-history__nav-button:focus-visible,.worker-history__more:focus-visible{outline:2px solid rgba(79,70,229,.72);outline-offset:3px}
        .worker-history__title{margin:11px 0 0;font-size:clamp(29px,6vw,41px);line-height:1;letter-spacing:-.055em;font-weight:950;text-shadow:0 1px 0 rgba(255,255,255,.98),0 3px 8px rgba(15,23,42,.09)}
        .worker-history__description{margin:7px 0 0;color:var(--wh-muted);font-size:12px;line-height:1.5}
        .worker-history__surface{position:relative;isolation:isolate;margin-bottom:12px;border:1px solid rgba(99,102,241,.15);border-radius:18px;background:linear-gradient(145deg,rgba(255,255,255,.99),rgba(248,250,252,.97));box-shadow:0 12px 23px rgba(15,23,42,.07),0 3px 7px rgba(15,23,42,.035),inset 0 1px 0 #fff,inset 0 -1px 0 rgba(148,163,184,.07)}
        .worker-history__total{padding:15px 17px;overflow:visible}.worker-history__total::before{content:'';position:absolute;z-index:-1;inset:8px 12px -7px;border-radius:18px;background:linear-gradient(90deg,rgba(37,99,235,.10),rgba(20,184,166,.06));filter:blur(10px)}
        .worker-history__eyebrow{display:flex;align-items:center;gap:8px;color:#334155;font-size:10px;font-weight:950;letter-spacing:.1em;text-transform:uppercase}.worker-history__eyebrow::before{content:'∞';display:grid;place-items:center;width:27px;height:27px;border:1px solid rgba(37,99,235,.17);border-radius:9px;background:linear-gradient(145deg,#fff,#eff6ff);color:#2563eb;box-shadow:0 5px 10px rgba(15,23,42,.065),inset 0 1px 0 #fff;font-size:13px}
        .worker-history__total-value{display:block;margin-top:6px;color:#0f172a;font-size:clamp(29px,8vw,40px);line-height:1;font-weight:950;letter-spacing:-.06em;text-shadow:0 1px 0 #fff,0 3px 8px rgba(15,23,42,.12)}
        .worker-history__total-copy{margin:6px 0 0;color:#64748b;font-size:11px;line-height:1.4;font-weight:650}
        .worker-history__segments{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-bottom:12px;padding:5px;border:1px solid rgba(99,102,241,.13);border-radius:15px;background:linear-gradient(145deg,#f1f5f9,#fff);box-shadow:0 7px 14px rgba(15,23,42,.055),inset 0 1px 0 #fff}
        .worker-history__segment{min-width:0;min-height:39px;padding:0 9px;border:1px solid transparent;border-radius:10px;background:transparent;color:#64748b;font:inherit;font-size:11px;font-weight:900;cursor:pointer;transition:transform .14s ease,box-shadow .14s ease,background .14s ease,color .14s ease,border-color .14s ease}.worker-history__segment:hover{color:#334155;background:rgba(255,255,255,.72);transform:translateY(-1px)}
        .worker-history__segment[aria-pressed="true"]{border-color:rgba(79,70,229,.27);background:linear-gradient(145deg,#fff,#eef2ff);color:#3730a3;box-shadow:0 6px 11px rgba(15,23,42,.08),0 2px 4px rgba(79,70,229,.08),inset 0 1px 0 #fff}.worker-history__segment:active{transform:translateY(1px);box-shadow:inset 0 2px 4px rgba(15,23,42,.06)}
        .worker-history__selected{padding:15px 16px}.worker-history__selected-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.worker-history__selected-label{color:#64748b;font-size:10px;font-weight:950;letter-spacing:.09em;text-transform:uppercase}.worker-history__date{margin-top:5px;font-size:20px;line-height:1.15;font-weight:950;letter-spacing:-.035em;overflow-wrap:anywhere;text-shadow:0 1px 0 #fff,0 2px 5px rgba(15,23,42,.07)}
        .worker-history__nav{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}.worker-history__nav-button,.worker-history__more{min-height:42px;padding:0 11px;border:1px solid rgba(71,85,105,.15);border-radius:11px;background:linear-gradient(145deg,#fff,#f4f7fb);color:#273449;font:inherit;font-size:11px;font-weight:900;cursor:pointer;box-shadow:0 7px 13px rgba(15,23,42,.065),0 2px 4px rgba(15,23,42,.035),inset 0 1px 0 #fff;transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease}.worker-history__nav-button:hover:not(:disabled),.worker-history__more:hover:not(:disabled){transform:translateY(-2px);border-color:rgba(79,70,229,.23);box-shadow:0 11px 18px rgba(15,23,42,.09),0 3px 6px rgba(15,23,42,.04),inset 0 1px 0 #fff}.worker-history__nav-button:active:not(:disabled),.worker-history__more:active:not(:disabled){transform:translateY(1px);box-shadow:0 4px 8px rgba(15,23,42,.07),inset 0 2px 4px rgba(15,23,42,.035)}.worker-history__nav-button:disabled{opacity:.5;cursor:not-allowed;box-shadow:0 3px 7px rgba(15,23,42,.04),inset 0 1px 0 #fff}
        .worker-history__daily{display:flex;align-items:baseline;gap:7px;margin-top:13px;padding:10px 11px;border:1px solid rgba(37,99,235,.14);border-radius:12px;background:linear-gradient(145deg,rgba(239,246,255,.72),rgba(255,255,255,.86));box-shadow:0 6px 12px rgba(37,99,235,.055),inset 0 1px 0 #fff;color:#64748b;font-size:11px;font-weight:800}.worker-history__daily strong{color:#0f172a;font-size:clamp(23px,7vw,30px);line-height:1;font-weight:950;letter-spacing:-.055em;text-shadow:0 1px 0 #fff,0 2px 5px rgba(15,23,42,.11)}
        .worker-history__list-title{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 8px;padding:0 2px}.worker-history__list-title h2{margin:0;font-size:18px;letter-spacing:-.025em}.worker-history__list-title span{color:#94a3b8;font-size:10px;font-weight:800}
        .worker-history__state{position:relative;display:flex;align-items:center;gap:9px;padding:14px 15px;border:1px solid rgba(99,102,241,.13);border-radius:15px;background:linear-gradient(145deg,#fff,#f8fafc);box-shadow:0 9px 18px rgba(15,23,42,.06),inset 0 1px 0 #fff;color:#64748b;font-size:12px;font-weight:750}.worker-history__state p{margin:0}.worker-history__state-mark{display:grid;place-items:center;width:27px;height:27px;border-radius:9px;background:linear-gradient(145deg,#fff,#eef2ff);color:#4f46e5;box-shadow:0 4px 8px rgba(15,23,42,.06),inset 0 1px 0 #fff}.worker-history__state--error{color:#b91c1c;border-color:rgba(185,28,28,.15);background:linear-gradient(145deg,#fff,#fff7f7)}.worker-history__state--error .worker-history__state-mark{color:#b91c1c;background:#fff1f2}
        .worker-history__more{display:block;width:100%;margin-top:10px}
        @media (max-width:430px){.worker-history__hero{padding:14px 13px;border-radius:18px}.worker-history__title{font-size:clamp(28px,10vw,36px)}.worker-history__description{font-size:11px}.worker-history__total{padding:14px}.worker-history__total-value{font-size:clamp(28px,10vw,35px)}.worker-history__selected{padding:14px}.worker-history__date{font-size:18px}.worker-history__nav{gap:7px}.worker-history__nav-button{padding:0 7px;font-size:10px}.worker-history__segment{padding:0 6px;font-size:10px}.worker-history__daily strong{font-size:clamp(22px,8vw,28px)}}
      `}</style>

      <header className="worker-history__hero">
        <button className="worker-history__back" type="button" onClick={() => navigate('/work')}>← Work House</button>
        <h1 className="worker-history__title">Work History</h1>
        <p className="worker-history__description">Real persisted Work Entries, newest first. The list loads five initially, then ten more per request.</p>
      </header>

      <section className="worker-history__surface worker-history__total" aria-label="Lifetime Grand Total">
        <div className="worker-history__eyebrow">Lifetime / Grand Total</div>
        <div className="worker-history__total-value" aria-live="polite">{totalsLoading ? 'Loading…' : formatWorkDecimal(totals.lifetime_total)}</div>
        <p className="worker-history__total-copy">Authoritative persisted total; independent from the visible page size.</p>
      </section>

      <nav className="worker-history__segments" aria-label="Work History shortcuts">
        {(['lifetime', 'day', 'week', 'month'] as const).map((item) => <button className="worker-history__segment" key={item} type="button" onClick={() => changePeriod(item)} aria-pressed={period === item}>{item === 'lifetime' ? 'All' : item[0].toUpperCase() + item.slice(1)}</button>)}
      </nav>

      {(isDay || isWeek || isMonth) && <section className="worker-history__surface worker-history__selected" aria-label={`Selected ${period}`}>
        <div className="worker-history__selected-head"><div><div className="worker-history__selected-label">Selected {isDay ? 'Day' : isWeek ? 'Week' : 'Month'}</div><div className="worker-history__date">{periodLabel}</div></div></div>
        <div className="worker-history__nav">
          <button className="worker-history__nav-button" type="button" onClick={() => changeSelectedPeriod(-1)}>{isDay ? '← Previous Day' : isWeek ? '← Previous Week' : '← Previous Month'}</button>
          <button className="worker-history__nav-button" type="button" onClick={() => changeSelectedPeriod(1)} disabled={nextDisabled}>{isDay ? 'Next Day →' : isWeek ? 'Next Week →' : 'Next Month →'}</button>
        </div>
        {isDay && <div className="worker-history__daily">Daily Total: <strong>{totalsLoading ? 'Loading…' : formatWorkDecimal(totals.daily_total)}</strong></div>}
        {isWeek && <div className="worker-history__daily">Weekly Total: <strong>{totalsLoading ? 'Loading…' : formatWorkDecimal(totals.weekly_total)}</strong></div>}
        {isMonth && <div className="worker-history__daily">Monthly Total: <strong>{totalsLoading ? 'Loading…' : formatWorkDecimal(totals.monthly_total)}</strong></div>}
      </section>}

      <section aria-labelledby="worker-history-list-heading">
        <div className="worker-history__list-title"><h2 id="worker-history-list-heading">Work Entries</h2>{!history.loading && history.entries.length > 0 && <span>{history.entries.length}{history.hasMore ? '+' : ''} loaded</span>}</div>
        {history.actionError && <p className="worker-history__state worker-history__state--error" role="alert">{history.actionError}</p>}
        {history.loading ? <section className="worker-history__state"><span className="worker-history__state-mark" aria-hidden="true">◌</span><p>Loading Work History…</p></section> : history.entries.length === 0 ? <section className="worker-history__state" style={{ textAlign: 'center', display: 'block' }}><span className="worker-history__state-mark" aria-hidden="true">○</span><h3 style={{ margin: '8px 0 0', fontSize: 16, color: '#172033' }}>No Work Entries yet</h3><p style={{ marginTop: 5 }}>Persisted Work Entries will appear here when they exist.</p></section> : <><WorkerWorkEntryList entries={history.entries} onOpen={(entry) => void history.openDetails(entry)} />{history.hasMore && <button className="worker-history__more" type="button" onClick={() => void history.loadMore()} disabled={history.loadingMore}>{history.loadingMore ? 'Loading more…' : 'Load more'}</button>}</>}
      </section>

      <WorkerWorkEntryDetails entry={history.selectedEntry} versions={history.versions} versionsLoading={history.versionsLoading} actionError={history.actionError} onClose={history.closeDetails} onEdit={editEntry} onTrash={trashEntry} />
    </main>
  );
}
