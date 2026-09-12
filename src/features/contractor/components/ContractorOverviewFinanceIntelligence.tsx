import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { supabase } from '../../../lib/supabase/client';

type Finance = {
  receivable_payable: number | string;
  receivable_received: number | string;
  receivable_due: number | string;
  receivable_coverage: number | string;
  worker_payable: number | string;
  worker_paid: number | string;
  worker_applied: number | string;
  worker_due: number | string;
  worker_advance: number | string;
  worker_coverage: number | string;
  cash_in: number | string;
  cash_out: number | string;
  net_cash_flow: number | string;
};

type Tone = 'healthy' | 'attention' | 'outstanding' | 'cash' | 'insufficient';

const n = (v: number | string | null | undefined) => Number(v) || 0;
const money = (v: number | string | null | undefined) => `PKR ${new Intl.NumberFormat('en-PK', { maximumFractionDigits: 2 }).format(n(v))}`;
const pct = (v: number | string | null | undefined) => `${Math.max(0, Math.min(100, n(v))).toFixed(2)}%`;

function position(f: Finance | null): { tone: Tone; label: string; message: string } {
  if (!f) return { tone: 'insufficient', label: 'INSUFFICIENT DATA', message: 'Financial intelligence is not available yet.' };
  const receivable = n(f.receivable_payable);
  const received = n(f.receivable_received);
  const due = n(f.receivable_due);
  const workerDue = n(f.worker_due);
  const net = n(f.net_cash_flow);
  if (receivable === 0 && received === 0 && n(f.worker_payable) === 0 && n(f.worker_paid) === 0) return { tone: 'insufficient', label: 'INSUFFICIENT DATA', message: 'No financial baseline is available yet.' };
  if (due > 0 && workerDue > 0) return { tone: 'outstanding', label: 'DUAL EXPOSURE', message: `${money(due)} receivable remains due and ${money(workerDue)} worker obligations remain open.` };
  if (due > 0) return { tone: 'attention', label: 'COLLECTION PRESSURE', message: `${money(due)} remains due on contractor receivables.` };
  if (workerDue > 0) return { tone: 'attention', label: 'WORKER EXPOSURE', message: `${money(workerDue)} remains due across team worker payables.` };
  if (net > 0) return { tone: 'cash', label: 'CASH POSITIVE', message: 'Receivables are covered and current cash flow is positive.' };
  return { tone: 'healthy', label: 'BALANCED', message: 'Current receivables and worker obligations are covered.' };
}

export function ContractorOverviewFinanceIntelligence() {
  const [finance, setFinance] = useState<Finance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    const { data, error: rpcError } = await supabase.rpc('get_contractor_overview_finance_intelligence');
    if (rpcError) {
      console.error('get_contractor_overview_finance_intelligence failed', rpcError);
      setError('We could not load the current financial intelligence. Please try again.');
      setLoading(false);
      return;
    }
    setFinance((data?.[0] as Finance | undefined) ?? null);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);
  const state = useMemo(() => position(finance), [finance]);

  if (loading) return <section className="cofi cofi-loading" aria-label="Loading Finance Intelligence"><style>{styles}</style><div className="cofi-loader"/><div><span className="cofi-eyebrow">FINANCE INTELLIGENCE</span><strong>Reading all financial layers…</strong></div></section>;
  if (error) return <section className="cofi cofi-error" role="alert"><style>{styles}</style><span className="cofi-eyebrow">FINANCE INTELLIGENCE</span><strong>Financial intelligence unavailable</strong><p>{error}</p><button type="button" onClick={() => void load()}>Retry</button></section>;
  if (!finance) return null;

  const f = finance;
  const collection = Math.max(0, Math.min(100, n(f.receivable_coverage)));
  const worker = Math.max(0, Math.min(100, n(f.worker_coverage)));
  const ringStyle = { '--coverage': `${collection * 3.6}deg` } as CSSProperties;

  return <section className={`cofi cofi-${state.tone}`} aria-label="Finance Intelligence">
    <style>{styles}</style>
    <div className="cofi-atmosphere" aria-hidden="true"><i/><b/><em/></div>
    <header className="cofi-head">
      <div><span className="cofi-eyebrow">FINANCE INTELLIGENCE · ALL TEAMS</span><h2>Financial health</h2><p>{state.message}</p></div>
      <span className={`cofi-state ${state.tone}`}><i/>{state.label}</span>
    </header>

    <div className="cofi-command">
      <div className="cofi-core-stage" aria-label={`${pct(collection)} collection coverage`}>
        <div className="cofi-shadow"/><div className="cofi-halo halo-a"/><div className="cofi-halo halo-b"/>
        <div className="cofi-ring ring-back"/><div className="cofi-ring ring-track"/><div className="cofi-ring ring-progress" style={ringStyle}/>
        <div className="cofi-chamber"><div className="cofi-glass"/><div className="cofi-core-value"><strong>{pct(collection)}</strong><span>COLLECTION COVERAGE</span></div></div>
        <span className="cofi-marker marker-one">01</span><span className="cofi-marker marker-two">LIVE</span>
      </div>

      <div className="cofi-data">
        <div className="cofi-primary"><span>BUSINESS SIGNAL</span><strong>{state.label === 'CASH POSITIVE' ? 'Cash generation is ahead of worker outflow' : state.message}</strong></div>
        <div className="cofi-metrics">
          <article className="cofi-node"><b>↗</b><div><span>CASH IN</span><strong>{money(f.cash_in)}</strong></div></article>
          <article className="cofi-node"><b>↘</b><div><span>CASH OUT</span><strong>{money(f.cash_out)}</strong></div></article>
          <article className={`cofi-node ${n(f.receivable_due) > 0 ? 'risk' : ''}`}><b>!</b><div><span>RECEIVABLE DUE</span><strong>{money(f.receivable_due)}</strong></div></article>
          <article className={`cofi-node ${n(f.worker_due) > 0 ? 'risk' : ''}`}><b>◈</b><div><span>WORKER DUE</span><strong>{money(f.worker_due)}</strong></div></article>
        </div>
        <div className="cofi-secondary">
          <span>WORKER COVERAGE <strong>{pct(worker)}</strong></span>
          <span>ADVANCE <strong>{money(f.worker_advance)}</strong></span>
          <span>NET CASH FLOW <strong>{money(f.net_cash_flow)}</strong></span>
        </div>
      </div>
    </div>

    <footer className="cofi-bottom"><div className="cofi-source"><i/><span>SERVER-AUTHORITATIVE · ALL TEAMS · STAGE 2 + STAGE 3</span></div><span className="cofi-coverage-label">COLLECTION {pct(collection)} · WORKER {pct(worker)}</span></footer>
  </section>;
}

const styles = `
.cofi{position:relative;isolation:isolate;overflow:hidden;min-height:220px;padding:14px;border-radius:26px;border:1px solid rgba(148,163,184,.2);color:#eaf2ff;background:linear-gradient(145deg,#07101f,#10182f 52%,#17132e);box-shadow:0 26px 58px rgba(2,6,23,.3),0 8px 24px rgba(79,70,229,.12),inset 0 1px 0 rgba(255,255,255,.14),inset 0 -24px 42px rgba(0,0,0,.3)}
.cofi:after{content:"";position:absolute;inset:1px;border:1px solid rgba(255,255,255,.06);border-radius:25px;pointer-events:none}.cofi-atmosphere{position:absolute;inset:0;z-index:-1;overflow:hidden}.cofi-atmosphere:before,.cofi-atmosphere:after{content:"";position:absolute;border-radius:50%;filter:blur(4px)}.cofi-atmosphere:before{width:300px;height:190px;left:-100px;top:-110px;background:radial-gradient(circle,rgba(34,211,238,.2),transparent 68%)}.cofi-atmosphere:after{width:300px;height:220px;right:-120px;bottom:-130px;background:radial-gradient(circle,rgba(124,58,237,.22),transparent 68%)}.cofi-atmosphere i{position:absolute;width:150px;height:150px;right:20%;top:-30px;border-radius:50%;background:radial-gradient(circle,rgba(99,102,241,.09),transparent 68%)}.cofi-atmosphere b{position:absolute;left:50%;top:-100px;width:1px;height:420px;background:linear-gradient(transparent,rgba(103,232,249,.12),transparent);transform:rotate(35deg)}.cofi-atmosphere em{position:absolute;right:10%;top:20%;width:2px;height:2px;border-radius:50%;background:#a5f3fc;box-shadow:-70px 30px 0 rgba(165,243,252,.35),-120px 100px 0 rgba(167,139,250,.3),30px 120px 0 rgba(103,232,249,.2)}
.cofi-head{position:relative;z-index:2;display:flex;justify-content:space-between;align-items:flex-start;gap:10px}.cofi-eyebrow{font-size:7px;font-weight:950;letter-spacing:.2em;color:#67e8f9}.cofi h2{margin:3px 0 0;font-size:17px;line-height:1.05;letter-spacing:-.035em;font-weight:950;color:#f8fbff}.cofi-head p{margin:5px 0 0;max-width:500px;font-size:8px;line-height:1.35;color:#94a3b8;font-weight:700}.cofi-state{display:inline-flex;align-items:center;gap:5px;min-height:22px;padding:0 8px;border-radius:999px;border:1px solid rgba(148,163,184,.18);background:rgba(2,6,23,.48);font-size:6px;letter-spacing:.1em;font-weight:950;white-space:nowrap}.cofi-state i{width:5px;height:5px;border-radius:50%;background:#94a3b8}.cofi-state.outstanding{color:#fecaca;border-color:rgba(248,113,113,.24)}.cofi-state.outstanding i{background:#fb7185;box-shadow:0 0 9px rgba(251,113,133,.55)}.cofi-state.attention{color:#fde68a;border-color:rgba(245,158,11,.22)}.cofi-state.attention i{background:#fbbf24}.cofi-state.healthy{color:#a7f3d0;border-color:rgba(16,185,129,.22)}.cofi-state.healthy i{background:#34d399}.cofi-state.cash{color:#a5f3fc;border-color:rgba(34,211,238,.22)}.cofi-state.cash i{background:#22d3ee;box-shadow:0 0 9px rgba(34,211,238,.55)}.cofi-state.insufficient{color:#94a3b8}
.cofi-command{position:relative;z-index:2;display:grid;grid-template-columns:180px 1fr;gap:12px;align-items:center;margin-top:9px;padding:8px;border:1px solid rgba(148,163,184,.12);border-radius:20px;background:linear-gradient(145deg,rgba(15,23,42,.68),rgba(30,41,72,.25));box-shadow:inset 0 1px 0 rgba(255,255,255,.06),inset 0 -14px 28px rgba(0,0,0,.22),0 12px 24px rgba(0,0,0,.16)}
.cofi-core-stage{position:relative;min-height:158px;display:grid;place-items:center;perspective:650px}.cofi-shadow{position:absolute;bottom:4px;width:115px;height:28px;border-radius:50%;background:rgba(0,0,0,.5);filter:blur(10px);transform:rotateX(70deg)}.cofi-halo{position:absolute;border-radius:50%;border:1px solid rgba(103,232,249,.1)}.halo-a{width:153px;height:153px;box-shadow:0 0 34px rgba(34,211,238,.07);animation:cofi-breathe 6s ease-in-out infinite}.halo-b{width:132px;height:132px;border-style:dashed;border-color:rgba(167,139,250,.13);transform:rotateX(62deg) rotateZ(20deg);animation:cofi-drift 9s ease-in-out infinite}.cofi-ring{position:absolute;border-radius:50%;transform-style:preserve-3d}.ring-back{width:142px;height:142px;border:1px solid rgba(148,163,184,.15);box-shadow:0 8px 18px rgba(0,0,0,.25),inset 0 0 20px rgba(56,189,248,.03)}.ring-track{width:130px;height:130px;border:8px solid rgba(51,65,85,.68);box-shadow:inset 0 2px 3px rgba(255,255,255,.06)}.ring-progress{--coverage:0deg;width:130px;height:130px;border:8px solid transparent;border-top-color:#67e8f9;border-right-color:#818cf8;border-bottom-color:rgba(129,140,248,.12);transform:rotate(-90deg);mask:conic-gradient(from 0deg,#000 0 var(--coverage),transparent var(--coverage) 360deg);-webkit-mask:conic-gradient(from 0deg,#000 0 var(--coverage),transparent var(--coverage) 360deg);filter:drop-shadow(0 0 7px rgba(34,211,238,.3))}.cofi-chamber{position:relative;width:101px;height:101px;border-radius:50%;display:grid;place-items:center;transform:translateZ(22px);background:radial-gradient(circle at 30% 20%,rgba(255,255,255,.14),rgba(30,41,72,.9) 40%,#050b1a 80%);border:1px solid rgba(255,255,255,.13);box-shadow:inset 0 4px 9px rgba(255,255,255,.07),inset 0 -10px 20px rgba(0,0,0,.48),0 16px 25px rgba(0,0,0,.34),0 0 24px rgba(79,70,229,.14)}.cofi-glass{position:absolute;inset:12px;border-radius:50%;border:1px solid rgba(103,232,249,.1);background:radial-gradient(circle at 30% 20%,rgba(255,255,255,.08),transparent 35%)}.cofi-core-value{position:relative;z-index:2;display:grid;place-items:center;text-align:center}.cofi-core-value strong{font-size:21px;line-height:1;color:#f8fbff;font-weight:950;letter-spacing:-.05em;text-shadow:0 0 15px rgba(103,232,249,.18)}.cofi-core-value span{margin-top:4px;font-size:5px;letter-spacing:.16em;color:#67e8f9;font-weight:950}.cofi-marker{position:absolute;z-index:5;padding:3px 5px;border-radius:6px;background:rgba(2,6,23,.7);border:1px solid rgba(103,232,249,.14);font-size:5px;letter-spacing:.12em;color:#94a3b8}.marker-one{left:9px;top:20px}.marker-two{right:8px;bottom:20px}.cofi-data{min-width:0}.cofi-primary{padding:8px 9px;border-radius:13px;background:rgba(2,6,23,.35);border:1px solid rgba(148,163,184,.11);box-shadow:inset 0 1px 0 rgba(255,255,255,.04)}.cofi-primary span{display:block;font-size:5px;letter-spacing:.16em;color:#64748b;font-weight:950}.cofi-primary strong{display:block;margin-top:3px;font-size:9px;line-height:1.25;color:#e2e8f0;font-weight:850}.cofi-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:7px}.cofi-node{display:flex;align-items:center;gap:7px;min-width:0;padding:8px;border-radius:12px;background:linear-gradient(145deg,rgba(15,23,42,.7),rgba(30,41,59,.3));border:1px solid rgba(148,163,184,.1);box-shadow:inset 0 1px 0 rgba(255,255,255,.04)}.cofi-node b{display:grid;place-items:center;width:22px;height:22px;flex:none;border-radius:8px;background:rgba(34,211,238,.1);color:#67e8f9;font-size:9px}.cofi-node.risk b{background:rgba(251,113,133,.12);color:#ffe4e6}.cofi-node span{display:block;font-size:5px;letter-spacing:.12em;color:#64748b;font-weight:950}.cofi-node strong{display:block;margin-top:2px;font-size:8px;color:#f8fafc;font-weight:900}.cofi-secondary{display:flex;flex-wrap:wrap;justify-content:space-between;gap:7px;margin-top:7px;font-size:5px;letter-spacing:.1em;color:#64748b;font-weight:900}.cofi-secondary strong{color:#cbd5e1}.cofi-bottom{position:relative;z-index:2;display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:8px;padding:6px 2px 0}.cofi-source{display:flex;align-items:center;gap:5px;font-size:5px;letter-spacing:.12em;color:#64748b;font-weight:900}.cofi-source i{width:5px;height:5px;border-radius:50%;background:#22d3ee;box-shadow:0 0 8px rgba(34,211,238,.5)}.cofi-coverage-label{font-size:5px;letter-spacing:.1em;color:#67e8f9;font-weight:950}.cofi-loading,.cofi-error{display:flex;align-items:center;gap:10px}.cofi-loader{width:28px;height:28px;border-radius:50%;border:3px solid rgba(148,163,184,.16);border-top-color:#67e8f9;animation:cofi-spin 1s linear infinite}.cofi-error p{margin:4px 0;color:#94a3b8;font-size:8px}.cofi-error button{margin-left:auto;border:1px solid rgba(103,232,249,.2);background:rgba(34,211,238,.08);color:#a5f3fc;border-radius:9px;padding:6px 9px;font-size:7px;font-weight:900}@keyframes cofi-spin{to{transform:rotate(360deg)}}@keyframes cofi-breathe{50%{transform:scale(1.035);opacity:.75}}@keyframes cofi-drift{50%{transform:rotateX(62deg) rotateZ(200deg) scale(.96)}}@media(max-width:620px){.cofi{padding:12px}.cofi-command{grid-template-columns:1fr;gap:4px}.cofi-core-stage{min-height:145px}.cofi-head{display:block}.cofi-state{margin-top:7px}.cofi-head p{max-width:none}.cofi-bottom{align-items:flex-start;flex-direction:column}.cofi-coverage-label{align-self:flex-end}}@media(max-width:380px){.cofi-metrics{grid-template-columns:1fr}.cofi-secondary{display:grid;grid-template-columns:1fr 1fr}.cofi-secondary span:last-child{grid-column:1/-1}}
`;