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
const money = (value: number | string | null | undefined) => `PKR ${new Intl.NumberFormat('en-PK', { maximumFractionDigits: 2 }).format(num(value))}`;

function getPosition(summary: Summary | null): Position {
  if (!summary) return { label: 'INSUFFICIENT DATA', tone: 'insufficient', message: 'Financial position is not available yet.' };
  const payable = num(summary.total_payable);
  const received = num(summary.total_received);
  const due = num(summary.due);
  const advance = num(summary.advance_paid);
  const coverage = Math.max(0, Math.min(100, num(summary.payment_coverage)));
  if (payable === 0 && received === 0 && due === 0 && advance === 0) return { label: 'INSUFFICIENT DATA', tone: 'insufficient', message: 'No financial baseline is available yet.' };
  if (payable === 0 && advance > 0) return { label: 'ADVANCE POSITION', tone: 'advance', message: 'Received funds currently exceed the payable baseline.' };
  if (due === 0 && payable > 0) return { label: 'HEALTHY', tone: 'healthy', message: 'Current payable exposure is fully covered.' };
  if (due > 0 && coverage >= 75) return { label: 'ATTENTION', tone: 'attention', message: `${money(due)} remains due against the current payable baseline.` };
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

  if (loading) return <section className="cofi cofi-loading" aria-label="Loading Finance Intelligence"><style>{styles}</style><div className="cofi-loader-orb"/><div><div className="cofi-eyebrow">FINANCE INTELLIGENCE</div><strong>Reading financial position…</strong></div></section>;
  if (error) return <section className="cofi cofi-error" role="alert"><style>{styles}</style><div className="cofi-eyebrow">FINANCE INTELLIGENCE</div><strong>Financial intelligence unavailable</strong><p>{error}</p><button type="button" onClick={() => void load()}>Retry</button></section>;
  if (position.tone === 'insufficient') return <section className="cofi cofi-insufficient" aria-label="Finance Intelligence"><style>{styles}</style><div className="cofi-empty-core"><span>—</span><small>NO BASELINE</small></div><div><div className="cofi-eyebrow">FINANCE INTELLIGENCE · ALL TEAMS</div><h2>Overall financial position</h2><span className={`cofi-state ${position.tone}`}>{position.label}</span><p>{position.message}</p><button className="cofi-open" type="button" onClick={openFinance}>Open All Finance <span>↗</span></button></div></section>;

  const s = summary!;
  const coverage = Math.max(0, Math.min(100, num(s.payment_coverage)));
  const coverageStyle = { '--coverage': `${coverage * 3.6}deg` } as CSSProperties;
  const due = num(s.due);
  const advance = num(s.advance_paid);

  return <section className={`cofi cofi-${position.tone}`} aria-label="Finance Intelligence">
    <style>{styles}</style>
    <div className="cofi-atmosphere" aria-hidden="true"><i/><b/><em/></div>
    <div className="cofi-head">
      <div><div className="cofi-eyebrow">FINANCE INTELLIGENCE · ALL TEAMS</div><h2>Overall financial position</h2><p>{position.message}</p></div>
      <span className={`cofi-state ${position.tone}`}><i/>{position.label}</span>
    </div>

    <div className="cofi-command">
      <div className="cofi-core-stage" aria-label={`${coverage.toFixed(2)} percent payment coverage`}>
        <div className="cofi-shadow"/><div className="cofi-halo halo-a"/><div className="cofi-halo halo-b"/>
        <div className="cofi-ring ring-back"/><div className="cofi-ring ring-track"/><div className="cofi-ring ring-progress" style={coverageStyle}/>
        <div className="cofi-reflection"/><div className="cofi-chamber"><div className="cofi-glass"/><div className="cofi-core-value"><strong>{coverage.toFixed(2)}%</strong><span>COVERAGE</span></div></div>
        <span className="cofi-marker marker-one">01</span><span className="cofi-marker marker-two">PAY</span><span className="cofi-marker marker-three">LIVE</span>
      </div>

      <div className="cofi-data">
        <div className="cofi-primary"><span>PRIMARY SIGNAL</span><strong>{position.label === 'OUTSTANDING' ? 'Financial pressure is active' : position.label === 'ATTENTION' ? 'Coverage is strong, exposure remains' : position.label === 'HEALTHY' ? 'Payable exposure is covered' : 'Received funds exceed baseline'}</strong></div>
        <div className="cofi-metrics">
          <article className="cofi-node received"><b>↗</b><div><span>RECEIVED</span><strong>{money(s.total_received)}</strong></div></article>
          <article className="cofi-node payable dominant"><b>◆</b><div><span>PAYABLE</span><strong>{money(s.total_payable)}</strong></div></article>
          <article className={`cofi-node due ${due > 0 ? 'risk' : ''}`}><b>!</b><div><span>DUE</span><strong>{money(s.due)}</strong></div></article>
          <article className={`cofi-node advance ${advance > 0 ? 'active' : ''}`}><b>◇</b><div><span>ADVANCE</span><strong>{money(s.advance_paid)}</strong></div></article>
        </div>
      </div>
    </div>

    <div className="cofi-bottom"><div className="cofi-source"><i/><span>SERVER-AUTHORITATIVE · ALL TEAMS</span></div><button className="cofi-open" type="button" onClick={openFinance}>Open All Finance <span>↗</span></button></div>
  </section>;
}

const styles = `
.cofi{position:relative;isolation:isolate;overflow:hidden;min-height:225px;padding:14px;border-radius:26px;border:1px solid rgba(148,163,184,.2);color:#eaf2ff;background:linear-gradient(145deg,#081122,#10182f 52%,#17142f);box-shadow:0 26px 58px rgba(2,6,23,.28),0 8px 24px rgba(79,70,229,.12),inset 0 1px 0 rgba(255,255,255,.14),inset 0 -24px 42px rgba(0,0,0,.3)}
.cofi:after{content:"";position:absolute;inset:1px;border:1px solid rgba(255,255,255,.06);border-radius:25px;pointer-events:none}.cofi-atmosphere{position:absolute;inset:0;z-index:-1;overflow:hidden}.cofi-atmosphere:before,.cofi-atmosphere:after{content:"";position:absolute;border-radius:50%;filter:blur(4px)}.cofi-atmosphere:before{width:300px;height:190px;left:-100px;top:-110px;background:radial-gradient(circle,rgba(34,211,238,.2),transparent 68%)}.cofi-atmosphere:after{width:300px;height:220px;right:-120px;bottom:-130px;background:radial-gradient(circle,rgba(124,58,237,.22),transparent 68%)}.cofi-atmosphere i{position:absolute;width:150px;height:150px;right:20%;top:-30px;border-radius:50%;background:radial-gradient(circle,rgba(99,102,241,.09),transparent 68%)}.cofi-atmosphere b{position:absolute;left:50%;top:-100px;width:1px;height:420px;background:linear-gradient(transparent,rgba(103,232,249,.12),transparent);transform:rotate(35deg)}.cofi-atmosphere em{position:absolute;right:10%;top:20%;width:2px;height:2px;border-radius:50%;background:#a5f3fc;box-shadow:-70px 30px 0 rgba(165,243,252,.35),-120px 100px 0 rgba(167,139,250,.3),30px 120px 0 rgba(103,232,249,.2)}
.cofi-head{position:relative;z-index:2;display:flex;justify-content:space-between;align-items:flex-start;gap:10px}.cofi-eyebrow{font-size:7px;font-weight:950;letter-spacing:.2em;color:#67e8f9}.cofi h2{margin:3px 0 0;font-size:17px;line-height:1.05;letter-spacing:-.035em;font-weight:950;color:#f8fbff}.cofi-head p{margin:5px 0 0;max-width:460px;font-size:8px;line-height:1.35;color:#94a3b8;font-weight:700}.cofi-state{display:inline-flex;align-items:center;gap:5px;min-height:22px;padding:0 8px;border-radius:999px;border:1px solid rgba(148,163,184,.18);background:rgba(2,6,23,.48);font-size:6px;letter-spacing:.1em;font-weight:950;white-space:nowrap}.cofi-state i{width:5px;height:5px;border-radius:50%;background:#94a3b8}.cofi-state.outstanding{color:#fecaca;border-color:rgba(248,113,113,.24)}.cofi-state.outstanding i{background:#fb7185;box-shadow:0 0 9px rgba(251,113,133,.55)}.cofi-state.attention{color:#fde68a;border-color:rgba(245,158,11,.22)}.cofi-state.attention i{background:#fbbf24}.cofi-state.healthy{color:#a7f3d0;border-color:rgba(16,185,129,.22)}.cofi-state.healthy i{background:#34d399}.cofi-state.advance{color:#ddd6fe;border-color:rgba(167,139,250,.24)}.cofi-state.advance i{background:#a78bfa}.cofi-state.insufficient{color:#94a3b8}
.cofi-command{position:relative;z-index:2;display:grid;grid-template-columns:180px 1fr;gap:12px;align-items:center;margin-top:9px;padding:8px;border:1px solid rgba(148,163,184,.12);border-radius:20px;background:linear-gradient(145deg,rgba(15,23,42,.68),rgba(30,41,72,.25));box-shadow:inset 0 1px 0 rgba(255,255,255,.06),inset 0 -14px 28px rgba(0,0,0,.22),0 12px 24px rgba(0,0,0,.16)}
.cofi-core-stage{position:relative;min-height:164px;display:grid;place-items:center;perspective:650px}.cofi-shadow{position:absolute;bottom:4px;width:115px;height:28px;border-radius:50%;background:rgba(0,0,0,.5);filter:blur(10px);transform:rotateX(70deg)}.cofi-halo{position:absolute;border-radius:50%;border:1px solid rgba(103,232,249,.1)}.halo-a{width:153px;height:153px;box-shadow:0 0 34px rgba(34,211,238,.07);animation:cofi-breathe 6s ease-in-out infinite}.halo-b{width:132px;height:132px;border-style:dashed;border-color:rgba(167,139,250,.13);transform:rotateX(62deg) rotateZ(20deg);animation:cofi-drift 9s ease-in-out infinite}.cofi-ring{position:absolute;border-radius:50%;transform-style:preserve-3d}.ring-back{width:142px;height:142px;border:1px solid rgba(148,163,184,.15);box-shadow:0 8px 18px rgba(0,0,0,.25),inset 0 0 20px rgba(56,189,248,.03)}.ring-track{width:130px;height:130px;border:8px solid rgba(51,65,85,.68);box-shadow:inset 0 2px 3px rgba(255,255,255,.06)}.ring-progress{--coverage:0deg;width:130px;height:130px;border:8px solid transparent;border-top-color:#67e8f9;border-right-color:#818cf8;border-bottom-color:rgba(129,140,248,.12);transform:rotate(-90deg);mask:conic-gradient(from 0deg,#000 0 var(--coverage),transparent var(--coverage) 360deg);-webkit-mask:conic-gradient(from 0deg,#000 0 var(--coverage),transparent var(--coverage) 360deg);filter:drop-shadow(0 0 7px rgba(34,211,238,.3))}.cofi-chamber{position:relative;width:101px;height:101px;border-radius:50%;display:grid;place-items:center;transform:translateZ(22px);background:radial-gradient(circle at 30% 20%,rgba(255,255,255,.14),rgba(30,41,72,.9) 40%,#050b1a 80%);border:1px solid rgba(255,255,255,.13);box-shadow:inset 0 4px 9px rgba(255,255,255,.07),inset 0 -10px 20px rgba(0,0,0,.48),0 16px 25px rgba(0,0,0,.34),0 0 24px rgba(79,70,229,.14)}.cofi-glass{position:absolute;inset:12px;border-radius:50%;border:1px solid rgba(103,232,249,.1);background:radial-gradient(circle at 30% 20%,rgba(255,255,255,.08),transparent 35%)}.cofi-core-value{position:relative;z-index:2;display:grid;place-items:center;text-align:center}.cofi-core-value strong{font-size:22px;line-height:1;color:#f8fbff;font-weight:950;letter-spacing:-.05em;text-shadow:0 0 15px rgba(103,232,249,.18)}.cofi-core-value span{margin-top:4px;font-size:6px;letter-spacing:.2em;color:#67e8f9;font-weight:950}.cofi-reflection{position:absolute;z-index:4;width:62px;height:10px;top:29px;border-radius:50%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.22),transparent);filter:blur(2px);transform:rotate(-24deg);animation:cofi-sweep 5s ease-in-out infinite}.cofi-marker{position:absolute;z-index:5;padding:3px 5px;border:1px solid rgba(148,163,184,.12);border-radius:6px;background:rgba(2,6,23,.6);font-size:4px;letter-spacing:.1em;color:#64748b;font-weight:950;box-shadow:0 5px 10px rgba(0,0,0,.2)}.marker-one{top:16px;left:7px}.marker-two{right:7px;top:46px;color:#67e8f9}.marker-three{left:18px;bottom:17px;color:#a78bfa}
.cofi-data{min-width:0}.cofi-primary{padding:5px 6px 7px;border-bottom:1px solid rgba(148,163,184,.1)}.cofi-primary span{font-size:5px;letter-spacing:.16em;color:#64748b;font-weight:950}.cofi-primary strong{display:block;margin-top:3px;font-size:11px;color:#eef4ff;font-weight:900}.cofi-metrics{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:7px}.cofi-node{display:flex;align-items:center;gap:6px;min-width:0;padding:7px;border-radius:12px;border:1px solid rgba(148,163,184,.11);background:linear-gradient(145deg,rgba(30,41,59,.68),rgba(15,23,42,.56));box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 7px 13px rgba(0,0,0,.14)}.cofi-node b{width:20px;height:20px;flex:0 0 20px;display:grid;place-items:center;border-radius:7px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.07);font-size:7px;color:#67e8f9}.cofi-node.received b{color:#6ee7b7}.cofi-node.payable b{color:#c4b5fd}.cofi-node.due b{color:#fbbf24}.cofi-node.risk{border-color:rgba(248,113,113,.2);background:linear-gradient(145deg,rgba(69,10,10,.4),rgba(15,23,42,.65))}.cofi-node.risk b{color:#fb7185}.cofi-node.advance.active{border-color:rgba(167,139,250,.22)}.cofi-node span{display:block;font-size:5px;letter-spacing:.12em;color:#71819b;font-weight:950}.cofi-node strong{display:block;margin-top:2px;font-size:10px;line-height:1.05;color:#f1f5f9;font-weight:950;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cofi-node.dominant{background:linear-gradient(145deg,rgba(49,46,129,.4),rgba(15,23,42,.66));border-color:rgba(129,140,248,.2)}
.cofi-bottom{position:relative;z-index:3;display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:7px;padding:7px 6px 0;border-top:1px solid rgba(148,163,184,.09)}.cofi-source{display:flex;align-items:center;gap:6px;min-width:0}.cofi-source i{width:5px;height:5px;border-radius:50%;background:#22d3ee;box-shadow:0 0 0 3px rgba(34,211,238,.08),0 0 9px rgba(34,211,238,.4)}.cofi-source span{font-size:5px;letter-spacing:.12em;color:#64748b;font-weight:950}.cofi-open{min-height:29px;padding:0 10px;border-radius:9px;border:1px solid rgba(129,140,248,.24);background:linear-gradient(145deg,rgba(99,102,241,.23),rgba(34,211,238,.08));color:#dbeafe;font:inherit;font-size:7px;font-weight:950;cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,255,255,.09),0 7px 14px rgba(0,0,0,.17)}.cofi-open span{margin-left:3px;color:#67e8f9}.cofi-insufficient{display:grid;grid-template-columns:150px 1fr;gap:14px;align-items:center;min-height:200px}.cofi-empty-core{width:125px;height:125px;margin:auto;border-radius:50%;display:grid;place-items:center;align-content:center;background:radial-gradient(circle at 30% 20%,rgba(255,255,255,.08),rgba(15,23,42,.82));border:1px solid rgba(148,163,184,.14);box-shadow:inset 0 5px 10px rgba(255,255,255,.04),inset 0 -15px 25px rgba(0,0,0,.3),0 18px 28px rgba(0,0,0,.25)}.cofi-empty-core span{font-size:25px;color:#64748b}.cofi-empty-core small{margin-top:5px;font-size:5px;letter-spacing:.14em;color:#64748b;font-weight:950}.cofi-insufficient h2{margin:3px 0 6px}.cofi-insufficient p{margin:7px 0 0;font-size:8px;color:#94a3b8;line-height:1.4}.cofi-loading{min-height:150px;display:flex;align-items:center;justify-content:center;gap:12px}.cofi-loader-orb{width:54px;height:54px;border-radius:50%;border:1px solid rgba(103,232,249,.2);box-shadow:0 0 24px rgba(34,211,238,.12),inset 0 0 15px rgba(99,102,241,.1);animation:cofi-breathe 2s ease-in-out infinite}.cofi-loading strong{display:block;margin-top:4px;font-size:13px;color:#eef4ff}.cofi-error{min-height:150px;padding:18px}.cofi-error strong{display:block;margin-top:5px;font-size:14px;color:#f8fbff}.cofi-error p{margin:5px 0;font-size:8px;color:#94a3b8}.cofi-error button{min-height:30px;padding:0 10px;border:1px solid rgba(129,140,248,.24);border-radius:9px;background:#1e1b4b;color:#dbeafe;font:inherit;font-size:7px;font-weight:950}
@keyframes cofi-breathe{0%,100%{transform:scale(1);opacity:.78}50%{transform:scale(1.025);opacity:1}}@keyframes cofi-drift{0%,100%{transform:rotateX(62deg) rotateZ(20deg)}50%{transform:rotateX(62deg) rotateZ(24deg) translate3d(2px,-2px,0)}}@keyframes cofi-sweep{0%,72%,100%{opacity:0;transform:translateX(-20px) rotate(-24deg)}42%{opacity:1;transform:translateX(20px) rotate(-24deg)}}
@media(max-width:650px){.cofi{padding:12px;border-radius:23px}.cofi-command{grid-template-columns:145px 1fr;gap:8px;padding:7px}.cofi-core-stage{min-height:150px}.ring-back{width:128px;height:128px}.ring-track,.ring-progress{width:116px;height:116px}.cofi-chamber{width:91px;height:91px}.cofi-core-value strong{font-size:19px}.cofi-halo.halo-a{width:140px;height:140px}.cofi-halo.halo-b{width:122px;height:122px}.cofi-marker{display:none}.cofi-node{padding:6px}.cofi-node b{width:18px;height:18px;flex-basis:18px}.cofi-node strong{font-size:9px}.cofi-source span{font-size:4px}}
@media(max-width:470px){.cofi-head{flex-direction:column}.cofi-state{align-self:flex-start}.cofi-command{grid-template-columns:1fr}.cofi-core-stage{min-height:145px}.cofi-metrics{grid-template-columns:1fr 1fr}.cofi-node small{display:none}.cofi-bottom{align-items:stretch;flex-direction:column}.cofi-open{width:100%}.cofi-insufficient{grid-template-columns:1fr;text-align:left;padding:10px}.cofi-empty-core{width:105px;height:105px}.cofi-empty-core small{font-size:4px}}
@media(prefers-reduced-motion:reduce){.cofi *{animation:none!important;transition:none!important}}
`;
