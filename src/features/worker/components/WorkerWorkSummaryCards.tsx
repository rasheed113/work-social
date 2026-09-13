import type { WorkHistoryPeriod } from '../api/workEntries';
import { formatWorkDecimal } from '../logic/workEntryCalculations';
import type { WorkDecimal, WorkerWorkTotals } from '../types/workEntry';

interface WorkerWorkSummaryCardsProps {
  totals: WorkerWorkTotals;
  periodLabels: { day: string; week: string; month: string };
  onOpenHistory: (period: WorkHistoryPeriod) => void;
  cardOrder?: string[];
  hiddenCards?: string[];
}

type Breakdown = { personal: WorkDecimal; team: WorkDecimal; total: WorkDecimal };

type RingProps = { personal: WorkDecimal; team: WorkDecimal; total: WorkDecimal; label: string; period: string };

function WorkRing({ personal, team, total, label, period }: RingProps) {
  const totalNumber = Math.max(0, Number(total) || 0);
  const personalNumber = Math.max(0, Number(personal) || 0);
  const teamNumber = Math.max(0, Number(team) || 0);
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const personalLength = totalNumber > 0 ? Math.min(circumference, circumference * (personalNumber / totalNumber)) : 0;
  const teamLength = totalNumber > 0 ? Math.min(circumference - personalLength, circumference * (teamNumber / totalNumber)) : 0;

  return (
    <span className="worker-summary__ring-wrap" aria-hidden="true">
      <svg className="worker-summary__ring" viewBox="0 0 112 112" role="presentation">
        <circle className="worker-summary__ring-track" cx="56" cy="56" r={radius} />
        {personalLength > 0 && <circle className="worker-summary__ring-personal" cx="56" cy="56" r={radius} strokeDasharray={`${personalLength} ${circumference - personalLength}`} />}
        {teamLength > 0 && <circle className="worker-summary__ring-team" cx="56" cy="56" r={radius} strokeDasharray={`${teamLength} ${circumference - teamLength}`} strokeDashoffset={-personalLength} />}
      </svg>
      <span className="worker-summary__ring-core">
        <span className="worker-summary__ring-label">{label}</span>
        <strong>{formatWorkDecimal(total)}</strong>
        <small>{period}</small>
      </span>
    </span>
  );
}

function MiniMetric({ code, label, value, accent }: { code: string; label: string; value: WorkDecimal; accent: string }) {
  return (
    <span className="worker-summary__metric">
      <span className={`worker-summary__metric-dot worker-summary__metric-dot--${accent}`} />
      <span className="worker-summary__metric-copy"><b>{code}</b>{label}</span>
      <strong>{formatWorkDecimal(value)}</strong>
    </span>
  );
}

export function WorkerWorkSummaryCards({ totals, periodLabels, onOpenHistory, cardOrder, hiddenCards = [] }: WorkerWorkSummaryCardsProps) {
  const cards: Array<{ id: string; label: string; period: string; history: WorkHistoryPeriod; icon: string; tone: string; breakdown: Breakdown }> = [
    { id: 'daily', label: 'Today', period: periodLabels.day, history: 'day', icon: '◷', tone: 'today', breakdown: { personal: totals.daily_personal_total ?? '0', team: totals.daily_team_total ?? '0', total: totals.daily_total } },
    { id: 'weekly', label: 'This Week', period: periodLabels.week, history: 'week', icon: '✦', tone: 'week', breakdown: { personal: totals.weekly_personal_total ?? '0', team: totals.weekly_team_total ?? '0', total: totals.weekly_total } },
    { id: 'monthly', label: 'Month', period: periodLabels.month, history: 'month', icon: '◈', tone: 'month', breakdown: { personal: totals.monthly_personal_total ?? '0', team: totals.monthly_team_total ?? '0', total: totals.monthly_total } },
    { id: 'lifetime', label: 'Grand Total', period: 'All persisted work', history: 'lifetime', icon: '∞', tone: 'lifetime', breakdown: { personal: totals.lifetime_personal_total ?? '0', team: totals.lifetime_team_total ?? '0', total: totals.lifetime_total } },
  ];
  const orderedCards = [...cards].sort((a, b) => { const ai = cardOrder?.indexOf(a.id) ?? -1; const bi = cardOrder?.indexOf(b.id) ?? -1; if (ai === -1 && bi === -1) return 0; if (ai === -1) return 1; if (bi === -1) return -1; return ai - bi; });

  return (
    <>
      <style>{`
        .worker-summary{position:relative;display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:11px;margin-top:2px;padding:12px;border:1px solid rgba(96,165,250,.22);border-radius:25px;background:radial-gradient(circle at 50% 15%,rgba(34,211,238,.12),transparent 34%),radial-gradient(circle at 88% 90%,rgba(139,92,246,.10),transparent 30%),linear-gradient(145deg,rgba(248,250,255,.98),rgba(241,245,249,.97) 55%,rgba(247,245,255,.98));box-shadow:0 24px 48px rgba(15,23,42,.12),0 8px 18px rgba(37,99,235,.08),inset 0 1px 0 rgba(255,255,255,.98);overflow:hidden;isolation:isolate}
        .worker-summary::before{content:'';position:absolute;inset:-45% 10% 40%;z-index:-1;background:radial-gradient(circle,rgba(34,211,238,.18),rgba(99,102,241,.08) 35%,transparent 68%);filter:blur(25px);pointer-events:none}
        .worker-summary::after{content:'';position:absolute;top:0;left:24px;right:24px;height:1px;background:linear-gradient(90deg,transparent,rgba(34,211,238,.75),rgba(139,92,246,.58),transparent);box-shadow:0 0 14px rgba(56,189,248,.28);pointer-events:none}
        .worker-summary__card{position:relative;display:block;min-width:0;border:1px solid rgba(96,165,250,.17);border-radius:19px;background:linear-gradient(145deg,rgba(255,255,255,.88),rgba(248,250,252,.70));box-shadow:0 12px 23px rgba(15,23,42,.065),inset 0 1px 0 rgba(255,255,255,.98),inset 0 -1px 0 rgba(99,102,241,.07);text-align:left;cursor:pointer;font:inherit;overflow:hidden;isolation:isolate;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}
        .worker-summary__card::after{content:'';position:absolute;top:0;left:15px;right:15px;height:1px;background:linear-gradient(90deg,rgba(255,255,255,.95),rgba(56,189,248,.42),transparent);pointer-events:none}
        .worker-summary__card:hover{transform:translateY(-2px);border-color:rgba(56,189,248,.30);box-shadow:0 18px 31px rgba(15,23,42,.10),0 5px 14px rgba(56,189,248,.09),inset 0 1px 0 rgba(255,255,255,1)}
        .worker-summary__card:active{transform:translateY(1px)}
        .worker-summary__card:focus-visible{outline:2px solid rgba(56,189,248,.78);outline-offset:3px}
        .worker-summary__card--week{grid-column:span 8;min-height:255px;padding:16px 17px;--accent:59,130,246;background:radial-gradient(circle at 50% 58%,rgba(34,211,238,.12),transparent 29%),linear-gradient(145deg,rgba(239,246,255,.98),rgba(255,255,255,.93) 48%,rgba(245,243,255,.97));border-color:rgba(59,130,246,.25)}
        .worker-summary__card--today{grid-column:span 4;padding:14px;--accent:6,182,212}
        .worker-summary__card--month{grid-column:span 4;padding:14px;--accent:124,58,237}
        .worker-summary__head{display:flex;align-items:center;gap:8px;min-width:0}
        .worker-summary__icon{display:grid;place-items:center;flex:0 0 30px;width:30px;height:30px;border:1px solid rgba(var(--accent),.20);border-radius:10px;background:linear-gradient(145deg,rgba(255,255,255,.98),rgba(var(--accent),.11));color:rgb(var(--accent));font-size:12px;font-weight:950;box-shadow:0 5px 11px rgba(15,23,42,.06),inset 0 1px 0 rgba(255,255,255,1)}
        .worker-summary__label{color:#475569;font-size:9px;font-weight:950;letter-spacing:.12em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .worker-summary__value{display:block;margin-top:12px;color:#0f172a;font-size:clamp(22px,4vw,31px);line-height:1;font-weight:950;letter-spacing:-.065em}
        .worker-summary__period{display:block;margin-top:6px;color:#94a3b8;font-size:9px;font-weight:750;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .worker-summary__mini-bar{height:7px;margin-top:14px;border-radius:999px;background:rgba(148,163,184,.13);overflow:hidden;box-shadow:inset 0 1px 3px rgba(15,23,42,.06)}
        .worker-summary__mini-fill{height:100%;width:var(--fill);border-radius:inherit;background:linear-gradient(90deg,rgba(34,211,238,.80),rgba(59,130,246,.85),rgba(139,92,246,.80));box-shadow:0 0 12px rgba(56,189,248,.18)}
        .worker-summary__mini-meta{display:flex;justify-content:space-between;gap:8px;margin-top:7px;color:#64748b;font-size:8px;font-weight:850}
        .worker-summary__week-caption{position:absolute;left:15px;top:14px;color:#64748b;font-size:8px;font-weight:950;letter-spacing:.13em;text-transform:uppercase}
        .worker-summary__week-status{position:absolute;right:13px;top:12px;display:inline-flex;align-items:center;gap:5px;padding:5px 8px;border:1px solid rgba(34,197,94,.18);border-radius:999px;background:rgba(240,253,244,.76);color:#15803d;font-size:8px;font-weight:950;letter-spacing:.08em;text-transform:uppercase}
        .worker-summary__week-status::before{content:'';width:5px;height:5px;border-radius:50%;background:#22c55e;box-shadow:0 0 8px rgba(34,197,94,.45)}
        .worker-summary__week-chart{position:absolute;inset:35px 18px 13px;display:grid;place-items:center;pointer-events:none}
        .worker-summary__ring-wrap{position:relative;display:grid;place-items:center;width:min(184px,54%);aspect-ratio:1}
        .worker-summary__ring{width:100%;height:100%;transform:rotate(-90deg);filter:drop-shadow(0 5px 9px rgba(37,99,235,.12))}
        .worker-summary__ring circle{fill:none;stroke-width:9}
        .worker-summary__ring-track{stroke:rgba(148,163,184,.14)}
        .worker-summary__ring-personal{stroke:#06b6d4;stroke-linecap:round}
        .worker-summary__ring-team{stroke:#8b5cf6;stroke-linecap:round}
        .worker-summary__ring-core{position:absolute;display:flex;flex-direction:column;align-items:center;justify-content:center;width:57%;aspect-ratio:1;border:1px solid rgba(96,165,250,.25);border-radius:31%;background:radial-gradient(circle at 35% 25%,rgba(255,255,255,.98),rgba(239,246,255,.80) 48%,rgba(224,231,255,.68));box-shadow:0 15px 31px rgba(37,99,235,.13),inset 0 1px 0 rgba(255,255,255,1),inset 0 -1px 8px rgba(99,102,241,.10)}
        .worker-summary__ring-label{color:#2563eb;font-size:8px;font-weight:950;letter-spacing:.14em;text-transform:uppercase}
        .worker-summary__ring-core strong{margin-top:6px;color:#0f172a;font-size:clamp(28px,6vw,43px);line-height:.9;font-weight:950;letter-spacing:-.075em;text-shadow:0 1px 0 #fff,0 4px 10px rgba(37,99,235,.12)}
        .worker-summary__ring-core small{margin-top:7px;max-width:90px;color:#64748b;font-size:8px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .worker-summary__legend{position:absolute;left:50%;bottom:2px;display:flex;gap:6px;transform:translateX(-50%);max-width:92%;padding:5px 8px;border:1px solid rgba(96,165,250,.15);border-radius:999px;background:rgba(255,255,255,.74);box-shadow:0 6px 14px rgba(37,99,235,.07);white-space:nowrap}
        .worker-summary__legend span{color:#64748b;font-size:8px;font-weight:900}.worker-summary__legend b{color:#1e3a8a;font-weight:950}
        .worker-summary__metrics{display:grid;gap:6px;margin-top:13px}
        .worker-summary__metric{display:grid;grid-template-columns:7px minmax(0,1fr) auto;align-items:center;gap:7px;padding:7px 8px;border:1px solid rgba(148,163,184,.10);border-radius:10px;background:rgba(248,250,252,.68)}
        .worker-summary__metric-dot{width:6px;height:6px;border-radius:50%;box-shadow:0 0 8px currentColor}.worker-summary__metric-dot--cyan{color:#06b6d4;background:#06b6d4}.worker-summary__metric-dot--violet{color:#8b5cf6;background:#8b5cf6}.worker-summary__metric-dot--blue{color:#3b82f6;background:#3b82f6}
        .worker-summary__metric-copy{display:flex;gap:5px;min-width:0;color:#64748b;font-size:8px;font-weight:800}.worker-summary__metric-copy b{color:#475569;font-size:8px;font-weight:950}.worker-summary__metric strong{color:#111827;font-size:12px;font-weight:950;white-space:nowrap}
        .worker-summary__lifetime{grid-column:1 / -1;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 15px;--accent:37,99,235;background:linear-gradient(110deg,rgba(239,246,255,.78),rgba(255,255,255,.82) 54%,rgba(245,243,255,.78))}
        .worker-summary__lifetime-label{display:block;color:#475569;font-size:8px;font-weight:950;letter-spacing:.12em;text-transform:uppercase}.worker-summary__lifetime-value{display:block;margin-top:3px;color:#0f172a;font-size:clamp(20px,4vw,28px);line-height:1;font-weight:950;letter-spacing:-.055em}.worker-summary__lifetime-copy{flex:0 1 310px;color:#64748b;font-size:9px;line-height:1.4;font-weight:700;text-align:right}
        @media (max-width:680px){.worker-summary{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;padding:10px;border-radius:21px}.worker-summary__card--week{grid-column:1 / -1;min-height:244px;order:-1}.worker-summary__card--today,.worker-summary__card--month{grid-column:span 1}.worker-summary__week-chart{inset:36px 10px 11px}.worker-summary__ring-wrap{width:min(176px,56%)}.worker-summary__lifetime{grid-column:1 / -1;align-items:flex-start;flex-direction:column;gap:7px}.worker-summary__lifetime-copy{flex-basis:auto;text-align:left;max-width:none}}
        @media (max-width:430px){.worker-summary{gap:8px;padding:9px;border-radius:19px}.worker-summary__card--week{min-height:225px;padding:14px}.worker-summary__week-caption{left:11px;top:11px}.worker-summary__week-status{right:10px;top:10px}.worker-summary__week-chart{inset:35px 5px 9px}.worker-summary__ring-wrap{width:min(160px,57%)}.worker-summary__ring-core strong{font-size:clamp(26px,8vw,38px)}.worker-summary__metric{padding:6px}.worker-summary__metric-copy{font-size:7px}.worker-summary__metric strong{font-size:11px}.worker-summary__value{font-size:clamp(21px,8vw,27px)}.worker-summary__period{font-size:8px}}
        @media (prefers-reduced-motion: reduce){.worker-summary__card{transition:none}}
      `}</style>
      <section className="worker-summary" aria-label="Personal Work, Team Work and Total">
        {orderedCards.filter(card => !hiddenCards.includes(card.id)).map(card => {
          const totalNumber = Math.max(0, Number(card.breakdown.total) || 0);
          const personalNumber = Math.max(0, Number(card.breakdown.personal) || 0);
          const teamNumber = Math.max(0, Number(card.breakdown.team) || 0);
          const fill = totalNumber > 0 ? `${Math.min(100, Math.max(0, ((personalNumber + teamNumber) / totalNumber) * 100))}%` : '0%';
          return (
            <button className={`worker-summary__card worker-summary__card--${card.tone}`} key={card.id} type="button" onClick={() => onOpenHistory(card.history)} aria-label={`${card.label}: Personal Work ${formatWorkDecimal(card.breakdown.personal)}, Team Work ${formatWorkDecimal(card.breakdown.team)}, Total ${formatWorkDecimal(card.breakdown.total)}`}>
              {card.tone === 'week' ? (
                <>
                  <span className="worker-summary__week-caption">Live work command chart</span>
                  <span className="worker-summary__week-status">Active period</span>
                  <span className="worker-summary__week-chart"><WorkRing personal={card.breakdown.personal} team={card.breakdown.team} total={card.breakdown.total} label="This Week" period={card.period} /><span className="worker-summary__legend"><span>PW <b>{formatWorkDecimal(card.breakdown.personal)}</b></span><span>TW <b>{formatWorkDecimal(card.breakdown.team)}</b></span></span></span>
                </>
              ) : (
                <>
                  <span className="worker-summary__head"><span className="worker-summary__icon" aria-hidden="true">{card.icon}</span><span className="worker-summary__label">{card.label}</span></span>
                  <span className="worker-summary__value">{formatWorkDecimal(card.breakdown.total)}</span>
                  <span className="worker-summary__period">{card.period}</span>
                  <span className="worker-summary__mini-bar" aria-hidden="true"><span className="worker-summary__mini-fill" style={{ ['--fill' as string]: fill }} /></span>
                  <span className="worker-summary__mini-meta"><span>PERSONAL {formatWorkDecimal(card.breakdown.personal)}</span><span>TEAM {formatWorkDecimal(card.breakdown.team)}</span></span>
                  <span className="worker-summary__metrics"><MiniMetric code="PW" label="Personal Work" value={card.breakdown.personal} accent="cyan" /><MiniMetric code="TW" label="Team Work" value={card.breakdown.team} accent="violet" /><MiniMetric code="TL" label="Total" value={card.breakdown.total} accent="blue" /></span>
                </>
              )}
            </button>
          );
        })}
        {!hiddenCards.includes('lifetime') && (
          <button className="worker-summary__card worker-summary__lifetime" type="button" onClick={() => onOpenHistory('lifetime')} aria-label="Open Work History">
            <span><span className="worker-summary__lifetime-label">Lifetime / Grand Total</span><span className="worker-summary__lifetime-value">{formatWorkDecimal(totals.lifetime_total)}</span></span>
            <span className="worker-summary__lifetime-copy">Cumulative total from persisted Work Entries. Tap to view Work History →</span>
          </button>
        )}
      </section>
    </>
  );
}
