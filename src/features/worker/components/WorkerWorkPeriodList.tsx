import type { WorkerWorkPeriod } from '../api/workEntries';
import { formatWorkDecimal } from '../logic/workEntryCalculations';

type Props = { periods: WorkerWorkPeriod[]; period: 'day' | 'week' | 'month' };

function formatPeriod(period: Props['period'], start: string, end: string) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (period === 'day') return startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  if (period === 'month') return startDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  return `${startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${new Date(endDate.getTime() - 1).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

export function WorkerWorkPeriodList({ periods, period }: Props) {
  return (
    <div style={{ display: 'grid', gap: 10 }} aria-label={`${period} work periods`}>
      {periods.map((item) => (
        <article key={item.period_start} style={{ padding: 16, border: '1px solid rgba(99,102,241,.14)', borderRadius: 16, background: 'rgba(255,255,255,.92)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 850 }}>{formatPeriod(period, item.period_start, item.period_end)}</div>
              <div style={{ marginTop: 4, color: '#64748b', fontSize: 12 }}>Worker work earnings</div>
            </div>
            <div style={{ fontWeight: 950, fontSize: 20, letterSpacing: '-.03em' }}>{formatWorkDecimal(item.period_total)}</div>
          </div>
        </article>
      ))}
    </div>
  );
}
