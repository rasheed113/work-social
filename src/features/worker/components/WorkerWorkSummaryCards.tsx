import type { WorkHistoryPeriod } from '../api/workEntries';
import { formatWorkDecimal } from '../logic/workEntryCalculations';
import type { WorkerWorkTotals } from '../types/workEntry';

interface WorkerWorkSummaryCardsProps {
  totals: WorkerWorkTotals;
  periodLabels: { day: string; week: string; month: string };
  onOpenHistory: (period: WorkHistoryPeriod) => void;
}

export function WorkerWorkSummaryCards({ totals, periodLabels, onOpenHistory }: WorkerWorkSummaryCardsProps) {
  const cards = [
    { label: 'Daily Earnings', period: periodLabels.day, value: totals.daily_total, history: 'day' as const },
    { label: 'Weekly', period: periodLabels.week, value: totals.weekly_total, history: 'week' as const },
    { label: 'Monthly', period: periodLabels.month, value: totals.monthly_total, history: 'month' as const },
  ];

  return (
    <>
      <style>{`
        .worker-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
        .worker-summary__card{position:relative;min-width:0;padding:18px;border:1px solid rgba(99,102,241,.15);border-radius:21px;background:linear-gradient(145deg,rgba(255,255,255,.97),rgba(248,250,252,.94));box-shadow:0 14px 32px rgba(15,23,42,.075),inset 0 1px 0 rgba(255,255,255,.95);text-align:left;cursor:pointer;font:inherit;overflow:hidden;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}
        .worker-summary__card::before{content:'';position:absolute;top:0;left:18px;right:18px;height:2px;border-radius:0 0 999px 999px;background:linear-gradient(90deg,rgba(99,102,241,.55),rgba(20,184,166,.35),transparent)}
        .worker-summary__card:hover{transform:translateY(-2px);border-color:rgba(99,102,241,.24);box-shadow:0 19px 38px rgba(15,23,42,.11),inset 0 1px 0 rgba(255,255,255,.98)}
        .worker-summary__card:active{transform:translateY(1px);box-shadow:0 9px 20px rgba(15,23,42,.08)}
        .worker-summary__card:focus-visible{outline:2px solid rgba(79,70,229,.7);outline-offset:3px}
        .worker-summary__label{display:block;color:#64748b;font-size:11px;font-weight:900;letter-spacing:.045em;text-transform:uppercase}
        .worker-summary__value{display:block;margin-top:9px;color:#111827;font-size:clamp(22px,3vw,31px);line-height:1.05;font-weight:950;letter-spacing:-.055em;overflow-wrap:anywhere;text-shadow:0 1px 0 rgba(255,255,255,.9),0 3px 8px rgba(15,23,42,.08)}
        .worker-summary__period{display:block;margin-top:7px;color:#94a3b8;font-size:10px;font-weight:700}
        .worker-summary__lifetime{grid-column:1 / -1;padding:22px;border-color:rgba(14,116,144,.17);background:linear-gradient(145deg,rgba(239,246,255,.98),rgba(248,250,252,.96) 48%,rgba(240,253,250,.96));box-shadow:0 18px 40px rgba(15,23,42,.09),inset 0 1px 0 rgba(255,255,255,.95)}
        .worker-summary__lifetime::before{background:linear-gradient(90deg,rgba(37,99,235,.7),rgba(20,184,166,.58),rgba(99,102,241,.18))}
        .worker-summary__lifetime-label{display:block;color:#475569;font-size:11px;font-weight:900;letter-spacing:.1em;text-transform:uppercase}
        .worker-summary__lifetime-value{display:block;margin-top:5px;color:#0f172a;font-size:clamp(32px,6vw,48px);line-height:1;font-weight:950;letter-spacing:-.065em;overflow-wrap:anywhere;text-shadow:0 1px 0 rgba(255,255,255,.95),0 5px 14px rgba(15,23,42,.10)}
        .worker-summary__lifetime-copy{display:block;margin-top:7px;color:#64748b;font-size:12px;line-height:1.5;font-weight:600}
        @media (max-width:759px){.worker-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.worker-summary__lifetime{grid-column:1 / -1}}
        @media (max-width:430px){.worker-summary{grid-template-columns:1fr;gap:11px}.worker-summary__card{padding:16px;border-radius:18px}.worker-summary__lifetime{grid-column:auto;padding:18px}.worker-summary__value{font-size:clamp(24px,9vw,31px)}.worker-summary__lifetime-value{font-size:clamp(31px,12vw,43px)}}
      `}</style>
      <section className="worker-summary" aria-label="Worker Work totals">
        {cards.map((card) => (
          <button className="worker-summary__card" key={card.label} type="button" onClick={() => onOpenHistory(card.history)}>
            <span className="worker-summary__label">{card.label}</span>
            <span className="worker-summary__value">{formatWorkDecimal(card.value)}</span>
            <span className="worker-summary__period">{card.period}</span>
          </button>
        ))}
        <button className="worker-summary__card worker-summary__lifetime" type="button" onClick={() => onOpenHistory('lifetime')} aria-label="Open Work History">
          <span className="worker-summary__lifetime-label">Lifetime / Grand Total</span>
          <span className="worker-summary__lifetime-value">{formatWorkDecimal(totals.lifetime_total)}</span>
          <span className="worker-summary__lifetime-copy">Cumulative total from persisted Work Entries. Tap to view Work History →</span>
        </button>
      </section>
    </>
  );
}
