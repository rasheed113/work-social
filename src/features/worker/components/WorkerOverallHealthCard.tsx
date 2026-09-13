type Props = {
  todayEntries: number;
  weekEntries: number;
  remaining: string | number;
};

function money(value: string | number) {
  return `PKR ${Number(value || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`;
}

function workSignal(todayEntries: number, weekEntries: number) {
  if (todayEntries > 0) return { label: 'WORK ACTIVE', detail: `${todayEntries} real entr${todayEntries === 1 ? 'y' : 'ies'} today`, tone: 'lime' };
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
      <style>{`.wo-health-card{position:relative;overflow:hidden}.wo-health-card:before{content:"";position:absolute;inset:-70px -45px auto auto;width:220px;height:220px;border-radius:50%;background:radial-gradient(circle,rgba(34,211,238,.2),rgba(124,58,237,.08) 42%,transparent 70%);pointer-events:none}.wo-health-card:after{content:"";position:absolute;inset:auto -20px -90px auto;width:180px;height:180px;border-radius:50%;background:radial-gradient(circle,rgba(167,139,250,.13),transparent 68%);pointer-events:none}.wo-health-grid{position:relative;z-index:1;display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:13px}.wo-health-signal{position:relative;min-height:92px;padding:12px;border-radius:17px;background:linear-gradient(145deg,rgba(255,255,255,.065),rgba(255,255,255,.025));border:1px solid rgba(255,255,255,.1);box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 10px 24px rgba(0,0,0,.12);overflow:hidden}.wo-health-signal:before{content:"";position:absolute;top:0;left:0;width:34px;height:2px;background:currentColor;box-shadow:0 0 14px currentColor;opacity:.9}.wo-health-signal:after{content:"";position:absolute;left:0;right:0;bottom:0;height:2px;background:currentColor;opacity:.38}.wo-health-signal small{display:block;font-size:6px;color:#8192ae;font-weight:950;letter-spacing:.14em}.wo-health-signal strong{display:block;margin-top:7px;font-size:10px;letter-spacing:.02em}.wo-health-signal span{display:block;margin-top:5px;font-size:7px;color:#9aaac0;line-height:1.4}.wo-health-signal.lime{color:#bef264}.wo-health-signal.cyan{color:#67e8f9}.wo-health-signal.violet{color:#c4b5fd}.wo-health-signal.amber{color:#fbbf24}.wo-health-signal.muted{color:#94a3b8}.wo-health-note{position:relative;z-index:1;margin-top:9px;padding:9px 10px;border:1px solid rgba(34,211,238,.1);border-left:3px solid #22d3ee;border-radius:11px;background:linear-gradient(90deg,rgba(34,211,238,.07),rgba(34,211,238,.02));color:#91a2bd;font-size:7px;line-height:1.5}@media(max-width:400px){.wo-health-grid{grid-template-columns:1fr}.wo-health-signal{min-height:82px}}`}</style>
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
