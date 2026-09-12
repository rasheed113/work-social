import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase/client';

type WorkProps = {
  taken: number;
  completed: number;
  remaining: number;
  activeWorkers: number;
  inProgressTeams: number;
  totalTeams: number;
};

type Finance = {
  receivable_due: number | string;
  receivable_coverage: number | string;
  cash_in: number | string;
  cash_out: number | string;
  net_cash_flow: number | string;
  worker_due: number | string;
};

type HealthFinance = {
  due: number | string;
  payment_coverage: number | string;
};

type Channel = 'work' | 'finance' | 'health';

const num = (value: unknown) => Math.max(0, Number(value) || 0);
const pieces = (value: unknown) => num(value).toLocaleString('en-PK', { maximumFractionDigits: 0 });
const money = (value: unknown) => `PKR ${num(value).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;
const percent = (value: unknown) => `${Math.max(0, Math.min(100, num(value))).toFixed(2)}%`;

export function ContractorOverviewDiscoPulseRibbon(props: WorkProps) {
  const [channel, setChannel] = useState<Channel>('work');
  const [finance, setFinance] = useState<Finance | null>(null);
  const [healthFinance, setHealthFinance] = useState<HealthFinance | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const offsetRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [{ data: financeData, error: financeError }, { data: healthData, error: healthError }] = await Promise.all([
        supabase.rpc('get_contractor_overview_finance_intelligence'),
        supabase.rpc('get_contractor_stage2_finance_summary', { p_team_id: null }),
      ]);
      if (cancelled) return;
      if (!financeError) setFinance((financeData?.[0] as Finance | undefined) ?? null);
      if (!healthError) setHealthFinance((healthData?.[0] as HealthFinance | undefined) ?? null);
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    offsetRef.current = 0;
    if (trackRef.current) trackRef.current.style.transform = 'translate3d(0,0,0)';

    let last = performance.now();
    let cycleWidth = 0;

    const tick = (now: number) => {
      const track = trackRef.current;
      if (!track) {
        frameRef.current = requestAnimationFrame(tick);
        return;
      }

      if (cycleWidth <= 0) cycleWidth = track.scrollWidth / 2;
      if (cycleWidth > 0) {
        const delta = Math.min(64, Math.max(0, now - last));
        offsetRef.current += (24 * delta) / 1000;
        if (offsetRef.current >= cycleWidth) {
          offsetRef.current %= cycleWidth;
          setChannel((current) => current === 'work' ? 'finance' : current === 'finance' ? 'health' : 'work');
          cycleWidth = 0;
        }
        track.style.transform = `translate3d(${-offsetRef.current}px,0,0)`;
      }

      last = now;
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [channel]);

  const health = useMemo(() => {
    const due = num(healthFinance?.due);
    const coverage = Math.max(0, Math.min(100, num(healthFinance?.payment_coverage)));
    const workPressure = props.remaining > 0;
    const financePressure = due > 0;
    const idleWithBacklog = props.remaining > 0 && props.inProgressTeams === 0;
    const attentionCount = [workPressure, financePressure, idleWithBacklog].filter(Boolean).length;
    return { due, coverage, attentionCount };
  }, [healthFinance, props.remaining, props.inProgressTeams]);

  const content = useMemo(() => {
    if (channel === 'work') {
      return [
        { value: `${pieces(props.taken)} TAKEN`, tone: 'cyan' },
        { value: `${pieces(props.completed)} COMPLETED`, tone: 'violet' },
        { value: `${pieces(props.remaining)} REMAINING`, tone: 'pink' },
        { value: `${props.inProgressTeams}/${props.totalTeams} TEAMS IN PROGRESS`, tone: 'blue' },
        { value: `${props.activeWorkers} ACTIVE WORKERS`, tone: 'mint' },
      ];
    }

    if (channel === 'finance') {
      return [
        { value: `${money(finance?.receivable_due)} RECEIVABLE DUE`, tone: 'pink' },
        { value: `${percent(finance?.receivable_coverage)} COLLECTION COVERAGE`, tone: 'cyan' },
        { value: `${money(finance?.cash_in)} CASH IN`, tone: 'mint' },
        { value: `${money(finance?.cash_out)} CASH OUT`, tone: 'violet' },
        { value: `${money(finance?.net_cash_flow)} NET CASH FLOW`, tone: 'blue' },
        { value: `${money(finance?.worker_due)} WORKER DUE`, tone: 'amber' },
      ];
    }

    return [
      { value: `${health.attentionCount} LIVE SIGNALS`, tone: health.attentionCount > 0 ? 'pink' : 'mint' },
      { value: `${pieces(props.remaining)} PCS OPEN`, tone: 'cyan' },
      { value: `${props.inProgressTeams}/${props.totalTeams} TEAMS IN PROGRESS`, tone: 'violet' },
      { value: `${props.activeWorkers} ACTIVE WORKERS`, tone: 'mint' },
      { value: health.due > 0 ? `${money(health.due)} COLLECTION PRESSURE` : 'RECEIVABLES COVERED', tone: health.due > 0 ? 'amber' : 'mint' },
      { value: `${percent(health.coverage)} PAYMENT COVERAGE`, tone: 'blue' },
    ];
  }, [channel, finance, health, props]);

  const label = channel === 'work' ? '⚡ WORK' : channel === 'finance' ? '◈ FINANCE' : '♥ HEALTH';

  return (
    <section className={`codpr codpr-${channel}`} aria-label={`${label.replace(/^[^ ]+ /, '')} live ticker`}>
      <div className="codpr-glow" aria-hidden="true" />
      <div className="codpr-label"><i />{label}</div>
      <div className="codpr-window">
        <div ref={trackRef} className="codpr-track">
          {[...content, ...content].map((item, index) => (
            <span className={`codpr-item codpr-${item.tone}`} key={`${channel}-${index}`}>
              {item.value}<b>·</b>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

const styles = `
.codpr{position:relative;display:flex;align-items:center;gap:0;min-height:31px;margin:11px 0 2px;overflow:hidden;border:1px solid rgba(148,163,184,.16);border-radius:12px;background:linear-gradient(105deg,rgba(5,12,27,.98),rgba(17,24,48,.94) 52%,rgba(10,15,32,.98));box-shadow:0 11px 25px rgba(2,6,23,.18),inset 0 1px 0 rgba(255,255,255,.09),inset 0 -7px 15px rgba(0,0,0,.25)}
.codpr:before,.codpr:after{content:"";position:absolute;z-index:4;top:0;bottom:0;width:28px;pointer-events:none}.codpr:before{left:0;background:linear-gradient(90deg,#07101f,transparent)}.codpr:after{right:0;background:linear-gradient(270deg,#07101f,transparent)}
.codpr-glow{position:absolute;inset:-20px;pointer-events:none;background:radial-gradient(circle at 18% 50%,rgba(34,211,238,.12),transparent 24%),radial-gradient(circle at 75% 50%,rgba(139,92,246,.1),transparent 27%);filter:blur(9px)}
.codpr-label{position:relative;z-index:5;display:flex;align-items:center;gap:6px;flex:0 0 auto;height:25px;margin-left:3px;padding:0 10px;border-radius:9px;background:linear-gradient(135deg,rgba(30,41,72,.98),rgba(49,46,129,.9));border:1px solid rgba(255,255,255,.11);box-shadow:0 5px 13px rgba(0,0,0,.25),inset 0 1px 0 rgba(255,255,255,.13);color:#f8fbff;font-size:7px;font-weight:950;letter-spacing:.13em;white-space:nowrap;text-shadow:0 0 10px rgba(103,232,249,.25)}
.codpr-label i{width:5px;height:5px;flex:0 0 5px;border-radius:50%;background:#67e8f9;box-shadow:0 0 8px #67e8f9;animation:codpr-live 1.8s ease-in-out infinite}
.codpr-finance .codpr-label{background:linear-gradient(135deg,rgba(49,46,129,.98),rgba(88,28,135,.9))}.codpr-finance .codpr-label i{background:#c4b5fd;box-shadow:0 0 8px #c4b5fd}.codpr-health .codpr-label{background:linear-gradient(135deg,rgba(6,78,59,.98),rgba(22,78,99,.9))}.codpr-health .codpr-label i{background:#6ee7b7;box-shadow:0 0 8px #6ee7b7}
.codpr-window{position:relative;z-index:2;min-width:0;flex:1;overflow:hidden;height:29px;display:flex;align-items:center;mask-image:linear-gradient(90deg,transparent,#000 18px,#000 calc(100% - 18px),transparent);-webkit-mask-image:linear-gradient(90deg,transparent,#000 18px,#000 calc(100% - 18px),transparent)}
.codpr-track{display:flex;width:max-content;align-items:center;will-change:transform}
.codpr-item{display:inline-flex;align-items:center;gap:9px;padding-left:17px;font-size:7px;line-height:1;letter-spacing:.055em;font-weight:900;white-space:nowrap;text-shadow:0 0 12px currentColor}.codpr-item b{font-size:10px;opacity:.45;color:#cbd5e1;text-shadow:none}.codpr-cyan{color:#67e8f9}.codpr-violet{color:#c4b5fd}.codpr-pink{color:#f9a8d4}.codpr-blue{color:#93c5fd}.codpr-mint{color:#6ee7b7}.codpr-amber{color:#fcd34d}
@keyframes codpr-live{0%,100%{opacity:.45;transform:scale(.82)}50%{opacity:1;transform:scale(1.18)}}
@media(max-width:620px){.codpr{min-height:29px;margin-top:9px}.codpr-label{height:23px;padding:0 8px;font-size:6px}.codpr-item{font-size:6.5px;padding-left:14px;gap:7px}}
@media(prefers-reduced-motion:reduce){.codpr-label i{animation:none!important}}
`;

if (typeof document !== 'undefined' && !document.getElementById('codpr-styles')) {
  const style = document.createElement('style');
  style.id = 'codpr-styles';
  style.textContent = styles;
  document.head.appendChild(style);
}
