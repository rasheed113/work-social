import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { navigate } from '../../../app/Router';
import { supabase } from '../../../lib/supabase/client';

type Summary = {
  total_payable: number | string;
  total_commission: number | string;
  total_received: number | string;
  paid_against_payable: number | string;
  due: number | string;
  advance_paid: number | string;
  payment_coverage: number | string;
};

type Position = {
  label: 'HEALTHY' | 'ATTENTION' | 'OUTSTANDING' | 'ADVANCE POSITION' | 'INSUFFICIENT DATA';
  tone: 'healthy' | 'attention' | 'outstanding' | 'advance' | 'insufficient';
  message: string;
};

const num = (value: number | string | null | undefined) => Number(value) || 0;
const money = (value: number | string | null | undefined) =>
  `PKR ${new Intl.NumberFormat('en-PK', { maximumFractionDigits: 2 }).format(num(value))}`;

function getPosition(summary: Summary | null): Position {
  if (!summary) {
    return { label: 'INSUFFICIENT DATA', tone: 'insufficient', message: 'Financial position is not available yet.' };
  }

  const payable = num(summary.total_payable);
  const received = num(summary.total_received);
  const due = num(summary.due);
  const advance = num(summary.advance_paid);
  const coverage = Math.max(0, Math.min(100, num(summary.payment_coverage)));

  // Stage 2 Finance remains authoritative. This is a state, not a health score.
  // With no financial baseline, zero cannot be distinguished from missing data.
  if (payable === 0 && received === 0 && due === 0 && advance === 0) {
    return { label: 'INSUFFICIENT DATA', tone: 'insufficient', message: 'No financial baseline is available yet.' };
  }
  if (payable === 0 && advance > 0) {
    return { label: 'ADVANCE POSITION', tone: 'advance', message: 'Received funds currently exceed the payable baseline.' };
  }
  if (due === 0 && payable > 0) {
    return { label: 'HEALTHY', tone: 'healthy', message: 'Current payable exposure is fully covered.' };
  }
  if (due > 0 && coverage >= 75) {
    return { label: 'ATTENTION', tone: 'attention', message: `${money(due)} remains due against the current payable baseline.` };
  }
  return { label: 'OUTSTANDING', tone: 'outstanding', message: `${money(due)} remains outstanding and coverage is below 75%.` };
}

const openFinance = () => navigate('/work/contractor?view=finance');

export function ContractorOverviewFinanceIntelligence() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    const { data, error: rpcError } = await supabase.rpc('get_contractor_stage2_finance_summary', { p_team_id: null });
    if (rpcError) {
      console.error('get_contractor_stage2_finance_summary failed', rpcError);
      setError('We could not load the current financial position. Please try again.');
      setLoading(false);
      return;
    }
    setSummary((data?.[0] as Summary | undefined) ?? null);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);
  const position = useMemo(() => getPosition(summary), [summary]);

  if (loading) {
    return <section className="cofi cofi-loading" aria-label="Loading Finance Intelligence"><style>{styles}</style><div className="cofi-loading-core"><div className="cofi-loading-orb"/><div><div className="cofi-eyebrow">FINANCE INTELLIGENCE</div><div className="cofi-loading-title">Reading financial position…</div><div className="cofi-loading-copy">Loading the server-authoritative Stage 2 Finance summary.</div></div></div></section>;
  }

  if (error) {
    return <section className="cofi cofi-error" role="alert"><style>{styles}</style><div className="cofi-eyebrow">FINANCE INTELLIGENCE</div><strong>Financial intelligence unavailable</strong><p>{error}</p><button type="button" onClick={() => void load()}>Retry</button></section>;
  }

  if (position.tone === 'insufficient') {
    return <section className="cofi cofi-insufficient" aria-label="Finance Intelligence"><style>{styles}</style><div className="cofi-atmosphere"/><div className="cofi-insufficient-layout"><div className="cofi-empty-core"><div className="cofi-empty-inner"><span>—</span><small>NO BASELINE</small></div></div><div className="cofi-empty-copy"><div className="cofi-eyebrow">FINANCE INTELLIGENCE</div><h2>Overall financial position</h2><span className="cofi-state insufficient">INSUFFICIENT DATA</span><p>{position.message} The Overview will not invent zero-valued finance intelligence.</p><button className="cofi-open" type="button" onClick={openFinance}>Open Finance <span>↗</span></button></div></div></section>;
  }

  const s = summary!;
  const coverage = Math.max(0, Math.min(100, num(s.payment_coverage)));
  const coverageStyle = { '--coverage': `${coverage * 3.6}deg` } as CSSProperties;
  const due = num(s.due);
  const advance = num(s.advance_paid);

  return <section className={`cofi cofi-${position.tone}`} aria-label="Finance Intelligence">
    <style>{styles}</style>
    <div className="cofi-atmosphere" aria-hidden="true"><i/><b/><em/></div>
    <div className="cofi-topline"><div><div className="cofi-eyebrow">FINANCE INTELLIGENCE</div><h2>Overall financial position</h2><p>{position.message}</p></div><div className={`cofi-state ${position.tone}`}><i/>{position.label}</div></div>

    <div className="cofi-command">
      <div className="cofi-core-stage" aria-label={`${coverage.toFixed(0)} percent payment coverage`}>
        <div className="cofi-shadow-orb" aria-hidden="true"/>
        <div className="cofi-halo halo-a" aria-hidden="true"/>
        <div className="cofi-halo halo-b" aria-hidden="true"/>
        <div className="cofi-ring ring-back" aria-hidden="true"/>
        <div className="cofi-ring ring-track" aria-hidden="true"/>
        <div className="cofi-ring ring-progress" style={coverageStyle} aria-hidden="true"/>
        <div className="cofi-reflection" aria-hidden="true"/>
        <div className="cofi-chamber"><div className="cofi-chamber-glass"/><div className="cofi-core-value"><strong>{coverage.toFixed(0)}%</strong><span>COVERAGE</span><small>PAYMENT POSITION</small></div></div>
        <span className="cofi-marker marker-one" aria-hidden="true">01</span><span className="cofi-marker marker-two" aria-hidden="true">PAY</span><span className="cofi-marker marker-three" aria-hidden="true">LIVE</span>
      </div>

      <div className="cofi-intelligence">
        <div className="cofi-statement"><span>PRIMARY SIGNAL</span><strong>{position.label === 'OUTSTANDING' ? 'Financial pressure is active' : position.label === 'ATTENTION' ? 'Coverage is strong, exposure remains' : position.label === 'HEALTHY' ? 'Payable exposure is covered' : 'Received funds exceed baseline'}</strong><small>Derived only from the existing Finance summary.</small></div>
        <div className="cofi-metric-plane">
          <article className="cofi-node received"><div className="cofi-node-icon">↗</div><div><span>RECEIVED</span><strong>{money(s.total_received)}</strong><small>Actual realized money</small></div></article>
          <article className="cofi-node payable dominant"><div className="cofi-node-icon">◆</div><div><span>PAYABLE</span><strong>{money(s.total_payable)}</strong><small>Future financial obligation</small></div></article>
          <article className={`cofi-node due ${due > 0 ? 'risk' : ''}`}><div className="cofi-node-icon">!</div><div><span>DUE</span><strong>{money(s.due)}</strong><small>Outstanding amount</small></div></article>
          <article className={`cofi-node advance ${advance > 0 ? 'active' : ''}`}><div className="cofi-node-icon">◇</div><div><span>ADVANCE</span><strong>{money(s.advance_paid)}</strong><small>Received above payable</small></div></article>
        </div>
      </div>
    </div>

    <div className="cofi-bottom"><div className="cofi-source"><i/><div><span>SERVER-AUTHORITATIVE</span><small>Stage 2 Finance · all teams</small></div></div><button className="cofi-open" type="button" onClick={openFinance}>Open Finance <span>↗</span></button></div>
  </section>;
}

const styles = `
.cofi{position:relative;isolation:isolate;overflow:hidden;min-height:290px;padding:17px;border-radius:28px;border:1px solid rgba(255,255,255,.88);color:#eaf2ff;background:linear-gradient(145deg,#0b1224 0%,#10172d 44%,#17152f 100%);box-shadow:0 30px 72px rgba(15,23,42,.24),0 10px 28px rgba(79,70,229,.12),inset 0 1px 0 rgba(255,255,255,.15),inset 0 -28px 55px rgba(2,6,23,.34)}
.cofi:after{content:"";position:absolute;inset:1px;border-radius:27px;border:1px solid rgba(148,163,184,.1);pointer-events:none;z-index:8}.cofi-atmosphere{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:-1}.cofi-atmosphere:before,.cofi-atmosphere:after{content:"";position:absolute;border-radius:50%;filter:blur(3px)}.cofi-atmosphere:before{width:330px;height:230px;left:-90px;top:-130px;background:radial-gradient(circle,rgba(34,211,238,.2),transparent 68%)}.cofi-atmosphere:after{width:360px;height:280px;right:-150px;bottom:-160px;background:radial-gradient(circle,rgba(124,58,237,.25),transparent 67%)}.cofi-atmosphere i{position:absolute;width:180px;height:180px;right:19%;top:4%;border-radius:50%;background:radial-gradient(circle,rgba(99,102,241,.1),transparent 67%);filter:blur(2px)}.cofi-atmosphere b{position:absolute;left:47%;top:-90px;width:1px;height:470px;background:linear-gradient(transparent,rgba(125,211,252,.11),transparent);transform:rotate(38deg)}.cofi-atmosphere em{position:absolute;right:9%;top:17%;width:2px;height:2px;border-radius:50%;background:#a5f3fc;box-shadow:-80px 24px 0 rgba(165,243,252,.45),-135px 112px 0 rgba(129,140,248,.32),45px 142px 0 rgba(167,139,250,.35),-190px 64px 0 rgba(103,232,249,.22)}
.cofi-topline{position:relative;z-index:3;display:flex;justify-content:space-between;align-items:flex-start;gap:14px}.cofi-eyebrow{font-size:8px;font-weight:950;letter-spacing:.22em;color:#67e8f9}.cofi-topline h2{margin:4px 0 0;font-size:20px;line-height:1.04;font-weight:950;letter-spacing:-.04em;color:#f8fbff}.cofi-topline p{margin:6px 0 0;max-width:510px;font-size:9px;line-height:1.45;color:#9aa9c3;font-weight:700}.cofi-state{display:inline-flex;align-items:center;gap:6px;min-height:25px;padding:0 9px;border-radius:999px;border:1px solid rgba(148,163,184,.2);background:rgba(15,23,42,.58);box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 8px 18px rgba(0,0,0,.12);font-size:7px;letter-spacing:.11em;font-weight:950;white-space:nowrap}.cofi-state i{width:5px;height:5px;border-radius:50%;background:#94a3b8;box-shadow:0 0 0 4px rgba(148,163,184,.08)}.cofi-state.healthy{color:#a7f3d0;border-color:rgba(16,185,129,.2)}.cofi-state.healthy i{background:#34d399;box-shadow:0 0 0 4px rgba(52,211,153,.1)}.cofi-state.attention{color:#fde68a;border-color:rgba(245,158,11,.22)}.cofi-state.attention i{background:#fbbf24;box-shadow:0 0 0 4px rgba(251,191,36,.1)}.cofi-state.outstanding{color:#fecaca;border-color:rgba(248,113,113,.22)}.cofi-state.outstanding i{background:#fb7185;box-shadow:0 0 0 4px rgba(251,113,133,.1)}.cofi-state.advance{color:#ddd6fe;border-color:rgba(167,139,250,.24)}.cofi-state.advance i{background:#a78bfa;box-shadow:0 0 0 4px rgba(167,139,250,.1)}
.cofi-command{position:relative;z-index:2;display:grid;grid-template-columns:minmax(220px,.78fr) minmax(0,1.42fr);gap:17px;align-items:center;margin-top:12px;padding:11px;border:1px solid rgba(148,163,184,.13);border-radius:23px;background:linear-gradient(145deg,rgba(15,23,42,.58),rgba(30,41,72,.28));box-shadow:inset 0 1px 0 rgba(255,255,255,.07),inset 0 -18px 34px rgba(2,6,23,.25),0 15px 32px rgba(2,6,23,.18)}
.cofi-core-stage{position:relative;min-height:205px;display:grid;place-items:center;perspective:700px}.cofi-shadow-orb{position:absolute;width:145px;height:38px;bottom:8px;border-radius:50%;background:rgba(0,0,0,.48);filter:blur(12px);transform:rotateX(70deg)}.cofi-halo{position:absolute;border-radius:50%;border:1px solid rgba(103,232,249,.11)}.halo-a{width:184px;height:184px;box-shadow:0 0 42px rgba(34,211,238,.08),inset 0 0 22px rgba(99,102,241,.04);animation:cofi-breathe 6s ease-in-out infinite}.halo-b{width:157px;height:157px;border-style:dashed;border-color:rgba(167,139,250,.14);transform:rotateX(62deg) rotateZ(22deg);animation:cofi-drift 9s ease-in-out infinite}
.cofi-ring{position:absolute;border-radius:50%;transform:rotate(-38deg);transform-style:preserve-3d}.ring-back{width:165px;height:165px;border:1px solid rgba(148,163,184,.16);box-shadow:inset 0 0 24px rgba(56,189,248,.03),0 8px 22px rgba(0,0,0,.22)}.ring-track{width:151px;height:151px;border:9px solid rgba(51,65,85,.64);box-shadow:inset 0 2px 3px rgba(255,255,255,.06),0 0 0 1px rgba(2,6,23,.5)}.ring-progress{width:151px;height:151px;border:9px solid transparent;border-top-color:#67e8f9;border-right-color:#818cf8;border-bottom-color:rgba(129,140,248,.16);border-left-color:rgba(103,232,249,.06);filter:drop-shadow(0 0 8px rgba(34,211,238,.28)) drop-shadow(0 0 16px rgba(99,102,241,.16));clip-path:polygon(50% 50%,0 0,100% 0,100% 100%,0 100%,0 0);transform:rotate(-90deg);--arc:var(--coverage);mask:conic-gradient(from -90deg,#000 0 var(--coverage),transparent var(--coverage) 360deg);-webkit-mask:conic-gradient(from -90deg,#000 0 var(--coverage),transparent var(--coverage) 360deg)}
.cofi-reflection{position:absolute;width:73px;height:14px;top:34px;left:calc(50% - 37px);border-radius:50%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.22),transparent);filter:blur(3px);transform:rotate(-24deg);animation:cofi-sweep 5.5s ease-in-out infinite}.cofi-chamber{position:relative;width:115px;height:115px;border-radius:50%;display:grid;place-items:center;transform:translateZ(25px);background:radial-gradient(circle at 31% 21%,rgba(255,255,255,.16),rgba(30,41,72,.92) 38%,rgba(5,11,26,.98) 78%);border:1px solid rgba(255,255,255,.14);box-shadow:inset 0 4px 10px rgba(255,255,255,.08),inset 0 -10px 22px rgba(0,0,0,.45),0 18px 28px rgba(0,0,0,.32),0 0 28px rgba(79,70,229,.13)}.cofi-chamber:before{content:"";position:absolute;inset:9px;border-radius:50%;border:1px solid rgba(103,232,249,.12);box-shadow:inset 0 0 15px rgba(34,211,238,.05)}.cofi-chamber-glass{position:absolute;inset:15px;border-radius:50%;background:radial-gradient(circle at 35% 25%,rgba(255,255,255,.09),transparent 32%);border:1px solid rgba(148,163,184,.08)}.cofi-core-value{position:relative;z-index:2;display:grid;place-items:center;text-align:center}.cofi-core-value strong{font-size:28px;line-height:1;color:#f8fbff;font-weight:950;letter-spacing:-.05em;text-shadow:0 0 18px rgba(103,232,249,.18)}.cofi-core-value span{margin-top:5px;font-size:7px;letter-spacing:.22em;color:#67e8f9;font-weight:950}.cofi-core-value small{margin-top:5px;font-size:5px;letter-spacing:.12em;color:#64748b;font-weight:900}.cofi-marker{position:absolute;z-index:5;padding:4px 6px;border:1px solid rgba(148,163,184,.13);border-radius:7px;background:rgba(2,6,23,.58);box-shadow:0 7px 14px rgba(0,0,0,.2);font-size:5px;letter-spacing:.12em;color:#64748b;font-weight:950}.marker-one{top:25px;left:18px}.marker-two{right:18px;top:55px;color:#67e8f9}.marker-three{left:31px;bottom:26px;color:#a78bfa}
.cofi-intelligence{min-width:0}.cofi-statement{padding:8px 10px 10px;border-bottom:1px solid rgba(148,163,184,.11)}.cofi-statement span{font-size:6px;letter-spacing:.17em;color:#64748b;font-weight:950}.cofi-statement strong{display:block;margin-top:4px;font-size:13px;line-height:1.15;color:#eef4ff;font-weight:900;letter-spacing:-.02em}.cofi-statement small{display:block;margin-top:4px;color:#64748b;font-size:7px;font-weight:750}.cofi-metric-plane{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:8px}.cofi-node{position:relative;display:flex;align-items:center;gap:8px;min-width:0;padding:9px;border-radius:15px;border:1px solid rgba(148,163,184,.12);background:linear-gradient(145deg,rgba(30,41,59,.7),rgba(15,23,42,.55));box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 9px 17px rgba(0,0,0,.15);transition:transform .22s ease,border-color .22s ease,box-shadow .22s ease}.cofi-node:hover{transform:translateY(-2px);border-color:rgba(129,140,248,.28);box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 13px 22px rgba(0,0,0,.2)}.cofi-node.dominant{background:linear-gradient(145deg,rgba(49,46,129,.44),rgba(15,23,42,.68));border-color:rgba(129,140,248,.2);box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 11px 23px rgba(67,56,202,.14)}.cofi-node.risk{background:linear-gradient(145deg,rgba(69,10,10,.44),rgba(15,23,42,.68));border-color:rgba(248,113,113,.2)}.cofi-node.active{border-color:rgba(167,139,250,.24);background:linear-gradient(145deg,rgba(76,29,149,.34),rgba(15,23,42,.68))}.cofi-node-icon{width:24px;height:24px;flex:0 0 24px;display:grid;place-items:center;border-radius:8px;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.08);color:#67e8f9;font-size:9px;font-weight:950;box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}.cofi-node.received .cofi-node-icon{color:#6ee7b7}.cofi-node.due .cofi-node-icon{color:#fbbf24}.cofi-node.risk .cofi-node-icon{color:#fb7185}.cofi-node.advance .cofi-node-icon{color:#c4b5fd}.cofi-node span{display:block;font-size:6px;letter-spacing:.13em;color:#71819b;font-weight:950}.cofi-node strong{display:block;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:1.05;color:#f1f5f9;font-weight:950}.cofi-node small{display:block;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#64748b;font-size:6px;font-weight:750}.cofi-bottom{position:relative;z-index:3;display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:10px;padding:9px 10px;border-top:1px solid rgba(148,163,184,.1)}.cofi-source{display:flex;align-items:center;gap:7px;min-width:0}.cofi-source>i{width:6px;height:6px;border-radius:50%;background:#22d3ee;box-shadow:0 0 0 4px rgba(34,211,238,.08),0 0 11px rgba(34,211,238,.45);animation:cofi-breathe 3s ease-in-out infinite}.cofi-source span{display:block;font-size:6px;letter-spacing:.14em;color:#64748b;font-weight:950}.cofi-source small{display:block;margin-top:2px;color:#71819b;font-size:7px;font-weight:750}.cofi-open{min-height:34px;padding:0 12px;border-radius:10px;border:1px solid rgba(129,140,248,.25);background:linear-gradient(145deg,rgba(99,102,241,.24),rgba(34,211,238,.09));color:#dbeafe;font:inherit;font-size:8px;font-weight:950;cursor:pointer;white-space:nowrap;box-shadow:inset 0 1px 0 rgba(255,255,255,.1),0 8px 16px rgba(0,0,0,.18);transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease}.cofi-open:hover{transform:translateY(-2px);border-color:rgba(103,232,249,.32);box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 12px 20px rgba(0,0,0,.22)}.cofi-open span{margin-left:4px;color:#67e8f9}.cofi-insufficient{min-height:245px}.cofi-insufficient-layout{position:relative;z-index:2;display:grid;grid-template-columns:190px 1fr;gap:18px;align-items:center;min-height:205px}.cofi-empty-core{width:158px;height:158px;margin:auto;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 30% 22%,rgba(255,255,255,.09),rgba(15,23,42,.8));border:1px solid rgba(148,163,184,.15);box-shadow:inset 0 5px 12px rgba(255,255,255,.04),inset 0 -16px 28px rgba(0,0,0,.3),0 20px 32px rgba(0,0,0,.25)}.cofi-empty-inner{width:116px;height:116px;border-radius:50%;display:grid;place-items:center;align-content:center;background:#080f20;border:1px solid rgba(148,163,184,.1);box-shadow:inset 0 0 24px rgba(99,102,241,.08)}.cofi-empty-inner span{font-size:27px;color:#64748b}.cofi-empty-inner small{margin-top:6px;font-size:6px;letter-spacing:.16em;color:#64748b;font-weight:950}.cofi-empty-copy h2{margin:4px 0 7px;font-size:20px;color:#f8fbff}.cofi-empty-copy p{max-width:560px;margin:8px 0 0;color:#94a3b8;font-size:9px;line-height:1.5}.cofi-empty-copy .cofi-open{margin-top:12px}.cofi-loading{display:grid;place-items:center}.cofi-loading-core{display:flex;align-items:center;gap:14px}.cofi-loading-orb{width:72px;height:72px;border-radius:50%;border:1px solid rgba(103,232,249,.2);box-shadow:0 0 30px rgba(34,211,238,.12),inset 0 0 18px rgba(99,102,241,.12);animation:cofi-breathe 2.2s ease-in-out infinite}.cofi-loading-title{margin-top:5px;font-size:15px;font-weight:950;color:#eef4ff}.cofi-loading-copy{margin-top:5px;font-size:8px;color:#64748b}.cofi-error{min-height:180px;padding:22px}.cofi-error strong{position:relative;display:block;margin-top:6px;font-size:15px;color:#f8fbff}.cofi-error p{position:relative;margin:6px 0 0;font-size:9px;color:#94a3b8}.cofi-error button{position:relative;margin-top:12px;min-height:34px;padding:0 12px;border:1px solid rgba(129,140,248,.25);border-radius:10px;background:#1e1b4b;color:#dbeafe;font:inherit;font-size:8px;font-weight:950;cursor:pointer}
@keyframes cofi-breathe{0%,100%{transform:scale(1);opacity:.78}50%{transform:scale(1.025);opacity:1}}@keyframes cofi-drift{0%,100%{transform:rotateX(62deg) rotateZ(22deg) translate3d(0,0,0)}50%{transform:rotateX(62deg) rotateZ(26deg) translate3d(2px,-2px,0)}}@keyframes cofi-sweep{0%,72%,100%{opacity:0;transform:translateX(-22px) rotate(-24deg)}42%{opacity:1;transform:translateX(22px) rotate(-24deg)}}
@media(max-width:700px){.cofi{padding:14px;border-radius:24px}.cofi-command{grid-template-columns:1fr;gap:8px}.cofi-core-stage{min-height:190px}.cofi-intelligence{padding-top:0}.cofi-topline p{max-width:390px}.cofi-metric-plane{grid-template-columns:1fr 1fr}}
@media(max-width:470px){.cofi-topline{flex-direction:column}.cofi-state{align-self:flex-start}.cofi-command{margin-top:10px;padding:8px}.cofi-core-stage{min-height:178px}.ring-back{width:148px;height:148px}.ring-track,.ring-progress{width:136px;height:136px}.cofi-chamber{width:104px;height:104px}.cofi-chamber:before{inset:8px}.cofi-halo.halo-a{width:164px;height:164px}.cofi-halo.halo-b{width:142px;height:142px}.cofi-core-value strong{font-size:25px}.cofi-marker{display:none}.cofi-metric-plane{grid-template-columns:1fr}.cofi-bottom{align-items:stretch;flex-direction:column}.cofi-open{width:100%}.cofi-insufficient-layout{grid-template-columns:1fr;gap:6px;padding:12px 0}.cofi-empty-core{width:126px;height:126px}.cofi-empty-inner{width:92px;height:92px}.cofi-empty-copy{text-align:left}.cofi-empty-copy h2{font-size:18px}}
@media(prefers-reduced-motion:reduce){.cofi *{animation:none!important;transition:none!important}}
`;

export const contractorOverviewFinanceIntelligenceStyles = styles;
