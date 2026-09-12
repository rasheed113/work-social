import type { WorkerFinanceSummary } from '../types/finance';

type Props = {
  todayEntries: number;
  weekEntries: number;
  remaining: string | number;
};

function money(value: string | number) {
  return `PKR ${Number(value || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`;
}

function workSignal(todayEntries: number, weekEntries: number) {
  if (todayEntries > 0) return { label: 'WORK ACTIVE', detail: `${todayEntries} real entry${todayEntries === 1 ? '' : 'ies'} today`, tone: 'lime' };
  if (weekEntries > 0) return { label: 'WORK QUIET', detail: `${weekEntries} real entr${weekEntries === 1 ? 'y' : 'ies'} this week`, tone: 'cyan' };
  return { label: 'NO RECENT WORK', detail: 'No real Worker work entries this week', tone: 'muted' };
}

function financeSignal(remaining: number) {
  if (remaining > 0) return { label: 'BALANCE OPEN', detail: `${money(remaining)} remaining`, tone: 'violet' };
  if (remaining < 0) return { label: 'RECEIVED AHEAD', detail: `${money(Math.abs(remaining))} above earnings`, tone: 'amber' };
  return { label: 'BALANCED', detail: 'Received equals recorded earnings', tone: 'lime' };
}

export function WorkerOverallHealthCard({ todayEntries, weekEntries, remaining }: Props) {
  const work = workSignal(todayEntries, weekEntries);
  const finance = financeSignal(Number(remaining || 0));

  return (
    <section className="wo-card wo-health-card">
      <style>{`.wo-health-card{position:relative;overflow:hidden}.wo-health-card:before{content:"";position:absolute;inset:-35% auto auto 55%;width:180px;height:180px;border-radius:50%;background:radial-gradient(circle,rgba(34,211,238,.16),transparent 68%);pointer-events:none}.wo-health-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:12px}.wo-health-signal{position:relative;padding:11px;border-radius:15px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.08);overflow:hidden}.wo-health-signal:after{content:"";position:absolute;left:0;right:0;bottom:0;height:2px;background:currentColor;opacity:.55}.wo-health-signal small{display:block;font-size:6px;color:#8192ae;font-weight:950;letter-spacing:.12em}.wo-health-signal strong{display:block;margin-top:6px;font-size:10px}.wo-health-signal span{display:block;margin-top:4px;font-size:7px;color:#9aaac0;line-height:1.35}.wo-health-signal.lime{color:#bef264}.wo-health-signal.cyan{color:#67e8f9}.wo-health-signal.violet{color:#c4b5fd}.wo-health-signal.amber{color:#fbbf24}.wo-health-signal.muted{color:#94a3b8}.wo-health-note{margin-top:8px;padding:8px 9px;border-left:3px solid #22d3ee;background:rgba(34,211,238,.055);color:#91a2bd;font-size:7px;line-height:1.45}@media(max-width:400px){.wo-health-grid{grid-template-columns:1fr}}`}</style>
      <div className="wo-eyebrow">04 · OVERALL HEALTH INTELLIGENCE</div>
      <h2>Real position signals</h2>
      <p className="wo-muted">Health is derived from live Worker work activity and the authoritative overall finance position — no artificial score.</p>
      <div className="wo-health-grid">
        <div className={`wo-health-signal ${work.tone}`}>
          <small>WORK SIGNAL</small>
          <strong>{work.label}</strong>
          <span>{work.detail}</span>
        </div>
        <div className={`wo-health-signal ${finance.tone}`}>
          <small>FINANCE SIGNAL</small>
          <strong>{finance.label}</strong>
          <span>{finance.detail}</span>
        </div>
      </div>
      <div className="wo-health-note">No hidden health score, no guessed completion, and no Contractor-domain data. These signals describe only what the current real Worker data supports.</div>
    </section>
  );
}
