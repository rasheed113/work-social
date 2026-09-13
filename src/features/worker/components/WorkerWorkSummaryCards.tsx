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
    { label: 'Today', period: periodLabels.day, value: totals.daily_total, history: 'day' as const, icon: '◷', tone: 'today' },
    { label: 'This Week', period: periodLabels.week, value: totals.weekly_total, history: 'week' as const, icon: '✦', tone: 'week' },
    { label: 'Month', period: periodLabels.month, value: totals.monthly_total, history: 'month' as const, icon: '◈', tone: 'month' },
  ];

  return (
    <>
      <style>{`
        .worker-summary{position:relative;display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:10px;margin-top:2px;padding:12px;border:1px solid rgba(96,165,250,.20);border-radius:24px;background:radial-gradient(circle at 50% 0%,rgba(56,189,248,.10),transparent 34%),linear-gradient(145deg,rgba(248,250,255,.98),rgba(241,245,249,.98) 58%,rgba(247,245,255,.98));box-shadow:0 22px 44px rgba(15,23,42,.11),0 7px 16px rgba(37,99,235,.07),inset 0 1px 0 rgba(255,255,255,.98),inset 0 -1px 0 rgba(99,102,241,.08);overflow:hidden;isolation:isolate}
        .worker-summary::before{content:'';position:absolute;inset:-35% 15% 42%;z-index:-2;background:radial-gradient(circle,rgba(34,211,238,.18),rgba(59,130,246,.08) 34%,transparent 68%);filter:blur(20px);pointer-events:none}
        .worker-summary::after{content:'';position:absolute;top:0;left:22px;right:22px;height:1px;border-radius:999px;background:linear-gradient(90deg,transparent,rgba(125,211,252,.78),rgba(139,92,246,.52),transparent);box-shadow:0 0 12px rgba(56,189,248,.28);pointer-events:none}

        .worker-summary__card{--accent:59,130,246;position:relative;display:block;min-width:0;border:1px solid rgba(var(--accent),.16);border-radius:17px;background:linear-gradient(145deg,rgba(255,255,255,.88),rgba(248,250,252,.72));box-shadow:0 10px 20px rgba(15,23,42,.055),inset 0 1px 0 rgba(255,255,255,.96),inset 0 -1px 0 rgba(var(--accent),.07);text-align:left;cursor:pointer;font:inherit;overflow:hidden;isolation:isolate;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}
        .worker-summary__card::before{content:'';position:absolute;inset:auto -20% -45% 15%;height:80%;z-index:-1;background:radial-gradient(circle,rgba(var(--accent),.13),transparent 68%);filter:blur(13px);pointer-events:none}
        .worker-summary__card::after{content:'';position:absolute;top:0;left:14px;right:14px;height:1px;background:linear-gradient(90deg,rgba(255,255,255,.95),rgba(var(--accent),.48),transparent);pointer-events:none}
        .worker-summary__card:hover{transform:translateY(-2px);border-color:rgba(var(--accent),.28);box-shadow:0 16px 28px rgba(15,23,42,.09),0 5px 11px rgba(var(--accent),.08),inset 0 1px 0 rgba(255,255,255,1)}
        .worker-summary__card:active{transform:translateY(1px)}
        .worker-summary__card:focus-visible{outline:2px solid rgba(56,189,248,.78);outline-offset:3px}
        .worker-summary__card--today{grid-column:span 4;--accent:6,182,212;padding:13px}
        .worker-summary__card--week{grid-column:span 8;--accent:59,130,246;min-height:242px;padding:18px 18px 17px;background:radial-gradient(circle at 50% 58%,rgba(34,211,238,.10),transparent 27%),linear-gradient(145deg,rgba(239,246,255,.98),rgba(255,255,255,.94) 46%,rgba(245,243,255,.96));border-color:rgba(59,130,246,.25);box-shadow:0 19px 36px rgba(15,23,42,.10),0 7px 18px rgba(37,99,235,.10),inset 0 1px 0 rgba(255,255,255,1),inset 0 -1px 0 rgba(99,102,241,.08)}
        .worker-summary__card--month{grid-column:span 4;--accent:124,58,237;padding:13px}

        .worker-summary__head{display:flex;align-items:center;gap:8px;min-width:0}
        .worker-summary__icon{display:grid;place-items:center;flex:0 0 29px;width:29px;height:29px;border:1px solid rgba(var(--accent),.20);border-radius:9px;background:linear-gradient(145deg,rgba(255,255,255,.98),rgba(var(--accent),.10));color:rgb(var(--accent));font-size:12px;font-weight:950;line-height:1;box-shadow:0 5px 10px rgba(15,23,42,.06),inset 0 1px 0 rgba(255,255,255,1);text-shadow:0 1px 0 rgba(255,255,255,.9)}
        .worker-summary__label{display:block;min-width:0;color:#475569;font-size:9px;font-weight:950;letter-spacing:.11em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .worker-summary__value{display:block;margin-top:12px;color:#0f172a;font-size:clamp(22px,4vw,30px);line-height:1.02;font-weight:950;letter-spacing:-.06em;overflow-wrap:anywhere;text-shadow:0 1px 0 rgba(255,255,255,1),0 3px 8px rgba(15,23,42,.10)}
        .worker-summary__period{display:block;margin-top:6px;color:#94a3b8;font-size:9px;font-weight:750;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

        .worker-summary__week-orbit{position:absolute;inset:46px 20px 18px;display:grid;place-items:center;pointer-events:none}
        .worker-summary__week-orbit::before,.worker-summary__week-orbit::after{content:'';position:absolute;border:1px solid rgba(59,130,246,.18);border-radius:50%;transform:rotate(-18deg)}
        .worker-summary__week-orbit::before{width:min(205px,76%);aspect-ratio:1;border-right-color:rgba(34,211,238,.52);border-bottom-color:rgba(139,92,246,.28);box-shadow:0 0 24px rgba(56,189,248,.10),inset 0 0 20px rgba(59,130,246,.045)}
        .worker-summary__week-orbit::after{width:min(154px,57%);aspect-ratio:1;border-left-color:rgba(139,92,246,.46);border-top-color:rgba(34,211,238,.30);transform:rotate(28deg);box-shadow:0 0 18px rgba(139,92,246,.08)}
        .worker-summary__week-core{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;justify-content:center;width:min(132px,48%);aspect-ratio:1;padding:12px;border:1px solid rgba(96,165,250,.28);border-radius:34%;box-sizing:border-box;background:radial-gradient(circle at 38% 26%,rgba(255,255,255,.96),rgba(239,246,255,.78) 48%,rgba(224,231,255,.68));box-shadow:0 16px 32px rgba(37,99,235,.13),0 4px 10px rgba(15,23,42,.08),inset 0 1px 0 rgba(255,255,255,1),inset 0 -1px 7px rgba(99,102,241,.10);text-align:center}
        .worker-summary__week-core::before{content:'';position:absolute;inset:9px;border:1px solid rgba(34,211,238,.14);border-radius:28%;box-shadow:inset 0 0 16px rgba(59,130,246,.07);pointer-events:none}
        .worker-summary__week-label{position:relative;z-index:1;color:#2563eb;font-size:9px;font-weight:950;letter-spacing:.16em;text-transform:uppercase}
        .worker-summary__week-value{position:relative;z-index:1;margin-top:7px;color:#0f172a;font-size:clamp(30px,7vw,48px);line-height:.92;font-weight:950;letter-spacing:-.075em;overflow-wrap:anywhere;text-shadow:0 1px 0 #fff,0 4px 10px rgba(37,99,235,.13)}
        .worker-summary__week-period{position:relative;z-index:1;margin-top:8px;color:#64748b;font-size:9px;font-weight:800;line-height:1.2;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .worker-summary__week-status{position:absolute;right:13px;top:13px;display:inline-flex;align-items:center;gap:5px;padding:5px 7px;border:1px solid rgba(34,197,94,.18);border-radius:999px;background:rgba(240,253,244,.72);color:#15803d;font-size:8px;font-weight:950;letter-spacing:.08em;text-transform:uppercase;box-shadow:inset 0 1px 0 rgba(255,255,255,.9)}
        .worker-summary__week-status::before{content:'';width:5px;height:5px;border-radius:50%;background:#22c55e;box-shadow:0 0 8px rgba(34,197,94,.45)}
        .worker-summary__week-caption{position:absolute;left:14px;top:14px;color:#64748b;font-size:8px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}

        .worker-summary__lifetime{grid-column:1 / -1;display:flex;align-items:center;justify-content:space-between;gap:16px;--accent:37,99,235;padding:13px 15px;border-color:rgba(37,99,235,.16);background:linear-gradient(110deg,rgba(239,246,255,.76),rgba(255,255,255,.80) 54%,rgba(245,243,255,.76))}
        .worker-summary__lifetime .worker-summary__head{flex:1 1 auto}
        .worker-summary__lifetime-label{display:block;color:#475569;font-size:8px;font-weight:950;letter-spacing:.12em;text-transform:uppercase}
        .worker-summary__lifetime-value{display:block;margin-top:3px;color:#0f172a;font-size:clamp(20px,4vw,28px);line-height:1;font-weight:950;letter-spacing:-.055em;overflow-wrap:anywhere}
        .worker-summary__lifetime-copy{flex:0 1 290px;color:#64748b;font-size:9px;line-height:1.4;font-weight:700;text-align:right}

        @media (max-width:680px){
          .worker-summary{grid-template-columns:repeat(2,minmax(0,1fr));padding:10px;border-radius:21px}
          .worker-summary__card--week{grid-column:1 / -1;min-height:226px;order:-1}
          .worker-summary__card--today,.worker-summary__card--month{grid-column:span 1}
          .worker-summary__week-orbit{inset:44px 12px 13px}
          .worker-summary__lifetime{grid-column:1 / -1;align-items:flex-start;flex-direction:column;gap:7px}
          .worker-summary__lifetime-copy{flex-basis:auto;text-align:left;max-width:none}
        }
        @media (max-width:430px){
          .worker-summary{gap:8px;padding:9px;border-radius:19px}
          .worker-summary__card--week{min-height:208px;padding:15px}
          .worker-summary__week-orbit{inset:42px 8px 10px}
          .worker-summary__week-core{width:min(122px,48%)}
          .worker-summary__week-status{right:10px;top:10px}
          .worker-summary__week-caption{left:11px;top:11px}
          .worker-summary__card--today,.worker-summary__card--month{padding:12px}
          .worker-summary__value{font-size:clamp(21px,8vw,27px)}
          .worker-summary__period{font-size:8px}
        }
        @media (prefers-reduced-motion: reduce){
          .worker-summary__card{transition:none}
        }
      `}</style>
      <section className="worker-summary" aria-label="Worker Work totals">
        {cards.map((card) => (
          <button className={`worker-summary__card worker-summary__card--${card.tone}`} key={card.label} type="button" onClick={() => onOpenHistory(card.history)}>
            {card.tone === 'week' ? (
              <>
                <span className="worker-summary__week-caption">Live work command core</span>
                <span className="worker-summary__week-status">Active period</span>
                <span className="worker-summary__week-orbit" aria-hidden="true">
                  <span className="worker-summary__week-core">
                    <span className="worker-summary__week-label">This Week</span>
                    <span className="worker-summary__week-value">{formatWorkDecimal(card.value)}</span>
                    <span className="worker-summary__week-period">{card.period}</span>
                  </span>
                </span>
              </>
            ) : (
              <>
                <span className="worker-summary__head">
                  <span className="worker-summary__icon" aria-hidden="true">{card.icon}</span>
                  <span className="worker-summary__label">{card.label}</span>
                </span>
                <span className="worker-summary__value">{formatWorkDecimal(card.value)}</span>
                <span className="worker-summary__period">{card.period}</span>
              </>
            )}
          </button>
        ))}

        <button className="worker-summary__card worker-summary__lifetime" type="button" onClick={() => onOpenHistory('lifetime')} aria-label="Open Work History">
          <span className="worker-summary__head">
            <span className="worker-summary__icon" aria-hidden="true">∞</span>
            <span>
              <span className="worker-summary__lifetime-label">Lifetime / Grand Total</span>
              <span className="worker-summary__lifetime-value">{formatWorkDecimal(totals.lifetime_total)}</span>
            </span>
          </span>
          <span className="worker-summary__lifetime-copy">Cumulative total from persisted Work Entries. Tap to view Work History →</span>
        </button>
      </section>
    </>
  );
}
