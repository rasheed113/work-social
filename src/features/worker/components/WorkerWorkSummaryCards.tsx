import type { WorkHistoryPeriod } from '../api/workEntries';
import { formatWorkDecimal } from '../logic/workEntryCalculations';
import type { WorkerWorkTotals } from '../types/workEntry';

interface WorkerWorkSummaryCardsProps {
  totals: WorkerWorkTotals;
  periodLabels: { day: string; week: string; month: string };
  onOpenHistory: (period: WorkHistoryPeriod) => void;
  cardOrder?: string[];
  hiddenCards?: string[];
}

export function WorkerWorkSummaryCards({ totals, periodLabels, onOpenHistory, cardOrder, hiddenCards = [] }: WorkerWorkSummaryCardsProps) {
  const cards = [
    { id: 'daily', label: 'Daily Earnings', period: periodLabels.day, value: totals.daily_total, history: 'day' as const, icon: '◷', tone: 'daily' },
    { id: 'weekly', label: 'Weekly', period: periodLabels.week, value: totals.weekly_total, history: 'week' as const, icon: '▦', tone: 'weekly' },
    { id: 'monthly', label: 'Monthly', period: periodLabels.month, value: totals.monthly_total, history: 'month' as const, icon: '◈', tone: 'monthly' },
  ];
  const orderedCards = [...cards].sort((a, b) => (cardOrder?.indexOf(a.id) ?? 0) - (cardOrder?.indexOf(b.id) ?? 0));
  const lifetimeHidden = hiddenCards.includes('lifetime');

  return (
    <>
      <style>{`
        .worker-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
        .worker-summary__card{--accent:99,102,241;position:relative;display:block;min-width:0;padding:15px;border:1px solid rgba(var(--accent),.16);border-radius:18px;background:linear-gradient(145deg,rgba(255,255,255,.99) 0%,rgba(249,250,252,.97) 52%,rgba(243,247,255,.95) 100%);box-shadow:0 12px 22px rgba(15,23,42,.07),0 3px 6px rgba(15,23,42,.045),inset 0 1px 0 rgba(255,255,255,.98),inset 0 -1px 0 rgba(148,163,184,.07);text-align:left;cursor:pointer;font:inherit;overflow:visible;isolation:isolate;transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease}
        .worker-summary__card::before{content:'';position:absolute;z-index:-1;inset:7px 9px -7px;border-radius:17px;background:rgba(var(--accent),.09);filter:blur(9px);opacity:.55;transition:opacity .16s ease,transform .16s ease}
        .worker-summary__card::after{content:'';position:absolute;top:0;left:16px;right:16px;height:1px;border-radius:999px;background:linear-gradient(90deg,rgba(255,255,255,.98),rgba(var(--accent),.46),rgba(255,255,255,0));box-shadow:0 1px 4px rgba(255,255,255,.75);pointer-events:none}
        .worker-summary__card:hover{transform:translateY(-2px);border-color:rgba(var(--accent),.28);box-shadow:0 17px 30px rgba(15,23,42,.10),0 5px 10px rgba(15,23,42,.055),inset 0 1px 0 rgba(255,255,255,1),inset 0 -1px 0 rgba(148,163,184,.08)}
        .worker-summary__card:hover::before{opacity:.82;transform:translateY(1px)}
        .worker-summary__card:active{transform:translateY(1px);box-shadow:0 7px 14px rgba(15,23,42,.08),inset 0 2px 4px rgba(15,23,42,.035)}
        .worker-summary__card:focus-visible{outline:2px solid rgba(79,70,229,.7);outline-offset:3px}
        .worker-summary__card--daily{--accent:79,70,229}
        .worker-summary__card--weekly{--accent:14,116,144}
        .worker-summary__card--monthly{--accent:13,148,136}
        .worker-summary__head{display:flex;align-items:center;gap:9px;min-width:0}
        .worker-summary__icon{display:grid;place-items:center;flex:0 0 31px;width:31px;height:31px;border:1px solid rgba(var(--accent),.18);border-radius:10px;background:linear-gradient(145deg,rgba(255,255,255,1),rgba(var(--accent),.08));color:rgb(var(--accent));font-size:14px;font-weight:950;line-height:1;box-shadow:0 5px 10px rgba(15,23,42,.07),inset 0 1px 0 rgba(255,255,255,1),inset 0 -1px 2px rgba(var(--accent),.08);text-shadow:0 1px 0 rgba(255,255,255,.95)}
        .worker-summary__label{display:block;min-width:0;color:#475569;font-size:10px;font-weight:900;letter-spacing:.055em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .worker-summary__value{display:block;margin-top:10px;color:#111827;font-size:clamp(21px,2.6vw,28px);line-height:1.04;font-weight:950;letter-spacing:-.055em;overflow-wrap:anywhere;text-shadow:0 1px 0 rgba(255,255,255,.95),0 2px 5px rgba(15,23,42,.10)}
        .worker-summary__period{display:block;margin-top:6px;color:#94a3b8;font-size:10px;font-weight:750;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .worker-summary__lifetime{--accent:37,99,235;grid-column:1 / -1;padding:17px;border-color:rgba(37,99,235,.22);background:linear-gradient(145deg,rgba(239,246,255,.98) 0%,rgba(255,255,255,.99) 46%,rgba(240,253,250,.98) 100%);box-shadow:0 17px 34px rgba(15,23,42,.10),0 5px 11px rgba(37,99,235,.07),inset 0 1px 0 rgba(255,255,255,1),inset 0 -1px 0 rgba(37,99,235,.07)}
        .worker-summary__lifetime::before{background:linear-gradient(90deg,rgba(37,99,235,.16),rgba(20,184,166,.12));filter:blur(12px);opacity:.9}
        .worker-summary__lifetime:hover{box-shadow:0 21px 40px rgba(15,23,42,.12),0 6px 14px rgba(37,99,235,.09),inset 0 1px 0 rgba(255,255,255,1),inset 0 -1px 0 rgba(37,99,235,.08)}
        .worker-summary__lifetime .worker-summary__head{align-items:flex-start}
        .worker-summary__lifetime .worker-summary__icon{flex-basis:35px;width:35px;height:35px;border-radius:11px;font-size:15px;background:linear-gradient(145deg,rgba(255,255,255,1),rgba(219,234,254,.8) 58%,rgba(204,251,241,.7));box-shadow:0 7px 14px rgba(37,99,235,.10),inset 0 1px 0 rgba(255,255,255,1),inset 0 -1px 2px rgba(37,99,235,.08)}
        .worker-summary__lifetime-label{display:block;color:#334155;font-size:10px;font-weight:950;letter-spacing:.1em;text-transform:uppercase}
        .worker-summary__lifetime-value{display:block;margin-top:6px;color:#0f172a;font-size:clamp(28px,4.8vw,40px);line-height:1;font-weight:950;letter-spacing:-.06em;overflow-wrap:anywhere;text-shadow:0 1px 0 rgba(255,255,255,1),0 3px 8px rgba(15,23,42,.11)}
        .worker-summary__lifetime-copy{display:block;margin-top:6px;color:#64748b;font-size:11px;line-height:1.4;font-weight:650}
        @media (max-width:759px){.worker-summary{grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.worker-summary__card{padding:13px;border-radius:16px}.worker-summary__icon{flex-basis:29px;width:29px;height:29px}.worker-summary__label{font-size:9px}.worker-summary__value{font-size:clamp(18px,4.8vw,25px)}.worker-summary__lifetime{grid-column:1 / -1;padding:15px}.worker-summary__lifetime-value{font-size:clamp(27px,7vw,36px)}}
        @media (max-width:520px){.worker-summary{grid-template-columns:1fr 1fr}.worker-summary__card:nth-child(3){grid-column:1 / -1}.worker-summary__lifetime{grid-column:1 / -1}.worker-summary__card{padding:14px}.worker-summary__value{font-size:clamp(21px,7vw,27px)}}
        @media (max-width:430px){.worker-summary{gap:9px}.worker-summary__card{padding:12px;border-radius:15px}.worker-summary__icon{flex-basis:28px;width:28px;height:28px}.worker-summary__lifetime{padding:14px}.worker-summary__lifetime-value{font-size:clamp(27px,10vw,35px)}}
      `}</style>
      <section className="worker-summary" aria-label="Worker Work totals">
        {orderedCards.filter(card => !hiddenCards.includes(card.id)).map((card) => (
          <button className={`worker-summary__card worker-summary__card--${card.tone}`} key={card.id} type="button" onClick={() => onOpenHistory(card.history)}>
            <span className="worker-summary__head">
              <span className="worker-summary__icon" aria-hidden="true">{card.icon}</span>
              <span className="worker-summary__label">{card.label}</span>
            </span>
            <span className="worker-summary__value">{formatWorkDecimal(card.value)}</span>
            <span className="worker-summary__period">{card.period}</span>
          </button>
        ))}
        {!lifetimeHidden && <button className="worker-summary__card worker-summary__lifetime" type="button" onClick={() => onOpenHistory('lifetime')} aria-label="Open Work History">
          <span className="worker-summary__head">
            <span className="worker-summary__icon" aria-hidden="true">∞</span>
            <span>
              <span className="worker-summary__lifetime-label">Lifetime / Grand Total</span>
              <span className="worker-summary__lifetime-value">{formatWorkDecimal(totals.lifetime_total)}</span>
            </span>
          </span>
          <span className="worker-summary__lifetime-copy">Cumulative total from persisted Work Entries. Tap to view Work History →</span>
        </button>}
      </section>
    </>
  );
}
