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
    <section aria-label="Worker Work totals" style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
      {cards.map((card) => (
        <button key={card.label} type="button" onClick={() => onOpenHistory(card.history)} style={{ padding: 15, border: '1px solid rgba(99,102,241,.14)', borderRadius: 18, background: 'rgba(255,255,255,.94)', boxShadow: '0 10px 28px rgba(15,23,42,.07)', minWidth: 0, textAlign: 'left', cursor: 'pointer', font: 'inherit' }}>
          <span style={{ display: 'block', color: '#64748b', fontSize: 11, fontWeight: 800 }}>{card.label}</span>
          <span style={{ display: 'block', marginTop: 7, fontSize: 'clamp(18px, 5vw, 25px)', fontWeight: 900, letterSpacing: '-.035em', overflowWrap: 'anywhere' }}>{formatWorkDecimal(card.value)}</span>
          <span style={{ display: 'block', marginTop: 5, color: '#94a3b8', fontSize: 10 }}>{card.period}</span>
        </button>
      ))}
      <button type="button" onClick={() => onOpenHistory('lifetime')} aria-label="Open Work History" style={{ gridColumn: '1 / -1', padding: 17, border: '1px solid rgba(14,116,144,.18)', borderRadius: 18, background: 'linear-gradient(145deg,rgba(239,246,255,.96),rgba(240,253,250,.94))', textAlign: 'left', cursor: 'pointer', font: 'inherit' }}>
        <span style={{ display: 'block', color: '#475569', fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase' }}>Lifetime / Grand Total</span>
        <span style={{ display: 'block', marginTop: 4, fontSize: 'clamp(27px, 8vw, 40px)', fontWeight: 950, letterSpacing: '-.045em', overflowWrap: 'anywhere' }}>{formatWorkDecimal(totals.lifetime_total)}</span>
        <span style={{ display: 'block', marginTop: 4, color: '#64748b', fontSize: 12 }}>Cumulative total from persisted Work Entries. Tap to view Work History →</span>
      </button>
    </section>
  );
}
