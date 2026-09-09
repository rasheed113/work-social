import type { WorkHistoryPeriod } from '../api/workEntries';
import { formatWorkDecimal } from '../logic/workEntryCalculations';
import type { WorkDecimal, WorkerWorkTotals } from '../types/workEntry';

interface WorkerWorkSummaryCardsProps { totals: WorkerWorkTotals; periodLabels: { day: string; week: string; month: string }; onOpenHistory: (period: WorkHistoryPeriod) => void; cardOrder?: string[]; hiddenCards?: string[]; }
type Breakdown = { personal: WorkDecimal; team: WorkDecimal; total: WorkDecimal };

function BreakdownRow({ code, label, value, total = false }: { code: string; label: string; value: WorkDecimal; total?: boolean }) {
  return <span className={`worker-summary__row${total ? ' worker-summary__row--total' : ''}`}><span className="worker-summary__code">{code}</span><span className="worker-summary__row-label">{label}</span><span className="worker-summary__row-value">{formatWorkDecimal(value)}</span></span>;
}

export function WorkerWorkSummaryCards({ totals, periodLabels, onOpenHistory, cardOrder, hiddenCards = [] }: WorkerWorkSummaryCardsProps) {
  const cards: Array<{ id: string; label: string; period: string; history: WorkHistoryPeriod; icon: string; tone: string; breakdown: Breakdown }> = [
    { id: 'daily', label: 'Today', period: periodLabels.day, history: 'day', icon: '◷', tone: 'daily', breakdown: { personal: totals.daily_personal_total, team: totals.daily_team_total, total: totals.daily_total } },
    { id: 'weekly', label: 'Weekly', period: periodLabels.week, history: 'week', icon: '▦', tone: 'weekly', breakdown: { personal: totals.weekly_personal_total, team: totals.weekly_team_total, total: totals.weekly_total } },
    { id: 'monthly', label: 'Monthly', period: periodLabels.month, history: 'month', icon: '◈', tone: 'monthly', breakdown: { personal: totals.monthly_personal_total, team: totals.monthly_team_total, total: totals.monthly_total } },
    { id: 'lifetime', label: 'Grand Total', period: 'All persisted work', history: 'lifetime', icon: '∞', tone: 'lifetime', breakdown: { personal: totals.lifetime_personal_total, team: totals.lifetime_team_total, total: totals.lifetime_total } },
  ];
  const orderedCards = [...cards].sort((a, b) => { const ai = cardOrder?.indexOf(a.id) ?? -1; const bi = cardOrder?.indexOf(b.id) ?? -1; if (ai === -1 && bi === -1) return 0; if (ai === -1) return 1; if (bi === -1) return -1; return ai - bi; });

  return <>
    <style>{`
      .worker-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
      .worker-summary__card{--accent:99,102,241;position:relative;display:block;min-width:0;padding:14px;border:1px solid rgba(var(--accent),.16);border-radius:18px;background:linear-gradient(145deg,#fff,#f9fafc 52%,#f3f7ff);box-shadow:0 12px 22px rgba(15,23,42,.07),0 3px 6px rgba(15,23,42,.045),inset 0 1px 0 #fff;text-align:left;cursor:pointer;font:inherit;isolation:isolate;transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease}
      .worker-summary__card:hover{transform:translateY(-2px);border-color:rgba(var(--accent),.28);box-shadow:0 17px 30px rgba(15,23,42,.1),0 5px 10px rgba(15,23,42,.055),inset 0 1px 0 #fff}.worker-summary__card:active{transform:translateY(1px)}.worker-summary__card:focus-visible{outline:2px solid rgba(79,70,229,.7);outline-offset:3px}
      .worker-summary__card--daily{--accent:79,70,229}.worker-summary__card--weekly{--accent:14,116,144}.worker-summary__card--monthly{--accent:13,148,136}.worker-summary__card--lifetime{--accent:37,99,235;grid-column:1 / -1;background:linear-gradient(145deg,#eff6ff,#fff 46%,#f0fdfa)}
      .worker-summary__head{display:flex;align-items:center;gap:9px}.worker-summary__icon{display:grid;place-items:center;flex:0 0 30px;width:30px;height:30px;border:1px solid rgba(var(--accent),.18);border-radius:10px;background:linear-gradient(145deg,#fff,rgba(var(--accent),.08));color:rgb(var(--accent));font-size:14px;font-weight:950;box-shadow:0 5px 10px rgba(15,23,42,.07),inset 0 1px 0 #fff}.worker-summary__label{color:#334155;font-size:12px;font-weight:950;letter-spacing:.045em;text-transform:uppercase}.worker-summary__period{display:block;margin:7px 0 9px;color:#94a3b8;font-size:10px;font-weight:750;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .worker-summary__breakdown{display:grid;gap:5px}.worker-summary__row{display:grid;grid-template-columns:28px minmax(0,1fr) auto;align-items:center;gap:5px;padding:5px 6px;border-radius:8px;background:rgba(248,250,252,.78);border:1px solid rgba(148,163,184,.09)}.worker-summary__row--total{background:rgba(var(--accent),.065);border-color:rgba(var(--accent),.13)}.worker-summary__code{font-size:9px;font-weight:950;color:rgb(var(--accent));letter-spacing:.04em}.worker-summary__row-label{min-width:0;color:#64748b;font-size:9px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.worker-summary__row-value{color:#111827;font-size:12px;font-weight:950;white-space:nowrap}.worker-summary__row--total .worker-summary__row-label,.worker-summary__row--total .worker-summary__row-value{color:#172033}
      @media(max-width:759px){.worker-summary{gap:9px}.worker-summary__card{padding:12px;border-radius:15px}.worker-summary__icon{flex-basis:28px;width:28px;height:28px}.worker-summary__label{font-size:10px}.worker-summary__row{grid-template-columns:26px minmax(0,1fr) auto;padding:4px 5px}.worker-summary__row-label{font-size:8px}.worker-summary__row-value{font-size:11px}.worker-summary__card--lifetime{grid-column:1 / -1}}
      @media(max-width:520px){.worker-summary{grid-template-columns:1fr 1fr}.worker-summary__card--lifetime{grid-column:1 / -1}}
    `}</style>
    <section className="worker-summary" aria-label="Personal Work, Team Work and Total">
      {orderedCards.filter(card => !hiddenCards.includes(card.id)).map(card => <button className={`worker-summary__card worker-summary__card--${card.tone}`} key={card.id} type="button" onClick={() => onOpenHistory(card.history)} aria-label={`${card.label}: Personal Work ${formatWorkDecimal(card.breakdown.personal)}, Team Work ${formatWorkDecimal(card.breakdown.team)}, Total ${formatWorkDecimal(card.breakdown.total)}`}>
        <span className="worker-summary__head"><span className="worker-summary__icon" aria-hidden="true">{card.icon}</span><span className="worker-summary__label">{card.label}</span></span>
        <span className="worker-summary__period">{card.period}</span>
        <span className="worker-summary__breakdown"><BreakdownRow code="PW" label="Personal Work" value={card.breakdown.personal}/><BreakdownRow code="TW" label="Team Work" value={card.breakdown.team}/><BreakdownRow code="TL" label="Total" value={card.breakdown.total} total/></span>
      </button>)}
    </section>
  </>;
}
