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
    return <section className="cofi-card cofi-loading" aria-label="Loading Finance Intelligence"><div className="cofi-loading-line cofi-loading-title"/><div className="cofi-loading-line"/><div className="cofi-loading-grid"><span/><span/><span/><span/></div></section>;
  }

  if (error) {
    return <section className="cofi-card cofi-error" role="alert"><div className="cofi-eyebrow">FINANCE INTELLIGENCE</div><strong>Financial intelligence unavailable</strong><p>{error}</p><button type="button" onClick={() => void load()}>Retry</button></section>;
  }

  if (position.tone === 'insufficient') {
    return <section className="cofi-card cofi-insufficient" aria-label="Finance Intelligence"><div className="cofi-head"><div><div className="cofi-eyebrow">FINANCE INTELLIGENCE</div><h2>Overall financial position</h2></div><span className={`cofi-state ${position.tone}`}>INSUFFICIENT DATA</span></div><p className="cofi-empty-copy">{position.message} The Overview will not invent zero-valued finance intelligence.</p><button className="cofi-open" type="button" onClick={() => navigate('/work/contractor?view=finance')}>Open Finance <span>↗</span></button></section>;
  }

  const s = summary!;
  const coverage = Math.max(0, Math.min(100, num(s.payment_coverage)));

  return <section className={`cofi-card cofi-${position.tone}`} aria-label="Finance Intelligence">
    <div className="cofi-head"><div><div className="cofi-eyebrow">FINANCE INTELLIGENCE</div><h2>Overall financial position</h2><p>{position.message}</p></div><div className={`cofi-orbit ${position.tone}`} style={{ '--coverage': `${coverage}%` } as CSSProperties} aria-label={`${coverage.toFixed(0)} percent payment coverage`}><div className="cofi-orbit-core"><strong>{coverage.toFixed(0)}%</strong><span>coverage</span></div></div></div>
    <div className="cofi-metrics"><article><span>RECEIVED</span><strong>{money(s.total_received)}</strong><small>Actual received</small></article><article><span>PAYABLE</span><strong>{money(s.total_payable)}</strong><small>Current payable</small></article><article className={num(s.due)>0?'risk':''}><span>DUE</span><strong>{money(s.due)}</strong><small>Outstanding amount</small></article><article className={num(s.advance_paid)>0?'advance':''}><span>ADVANCE</span><strong>{money(s.advance_paid)}</strong><small>Received above payable</small></article></div>
    <div className="cofi-bottom"><div className="cofi-position"><span className={`cofi-state ${position.tone}`}>{position.label}</span><small>Server-authoritative Stage 2 Finance</small></div><button className="cofi-open" type="button" onClick={() => navigate('/work/contractor?view=finance')}>Open Finance <span>↗</span></button></div>
  </section>;
}

const styles = `.cofi-card{position:relative;overflow:hidden;padding:15px;border-radius:22px;border:1px solid rgba(255,255,255,.94);background:linear-gradient(145deg,rgba(255,255,255,.95),rgba(239,246,255,.78) 56%,rgba(245,243,255,.82));box-shadow:0 22px 48px rgba(15,23,42,.085),inset 0 1px 0 #fff;color:#172033}.cofi-card:before{content:"";position:absolute;right:-75px;top:-85px;width:220px;height:220px;border-radius:50%;background:radial-gradient(circle,rgba(99,102,241,.18),transparent 68%);pointer-events:none}.cofi-head{position:relative;display:flex;justify-content:space-between;align-items:center;gap:14px}.cofi-eyebrow{font-size:8px;font-weight:950;letter-spacing:.18em;color:#4f46e5}.cofi-head h2{margin:4px 0 0;font-size:19px;line-height:1.05;font-weight:950;letter-spacing:-.035em}.cofi-head p{margin:6px 0 0;max-width:520px;font-size:9px;line-height:1.45;color:#64748b;font-weight:750}.cofi-orbit{--coverage:0%;position:relative;flex:0 0 86px;width:86px;height:86px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(from -45deg,#06b6d4 var(--coverage),#4f46e5 0 55%,#e2e8f0 0);box-shadow:0 16px 30px rgba(37,99,235,.16),inset 0 2px 4px rgba(255,255,255,.9)}.cofi-orbit:after{content:"";position:absolute;inset:4px;border-radius:50%;border:1px solid rgba(255,255,255,.9);box-shadow:0 0 22px rgba(79,70,229,.16)}.cofi-orbit-core{position:relative;z-index:1;width:64px;height:64px;border-radius:50%;display:grid;place-items:center;align-content:center;text-align:center;background:radial-gradient(circle at 35% 25%,#fff,#eef2ff);box-shadow:inset 0 -4px 8px rgba(15,23,42,.055),0 5px 12px rgba(15,23,42,.08)}.cofi-orbit-core strong{font-size:18px;line-height:1;font-weight:950;color:#172554}.cofi-orbit-core span{margin-top:3px;font-size:6px;letter-spacing:.08em;text-transform:uppercase;color:#64748b;font-weight:900}.cofi-metrics{position:relative;display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-top:13px}.cofi-metrics article{min-width:0;padding:10px;border-radius:15px;border:1px solid rgba(255,255,255,.92);background:rgba(255,255,255,.68);box-shadow:inset 0 1px 0 #fff,0 8px 18px rgba(15,23,42,.045)}.cofi-metrics span{display:block;font-size:7px;letter-spacing:.11em;color:#64748b;font-weight:950}.cofi-metrics strong{display:block;margin-top:4px;font-size:13px;line-height:1.1;font-weight:950;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cofi-metrics small{display:block;margin-top:4px;font-size:7px;color:#94a3b8;font-weight:750}.cofi-metrics article.risk{border-color:rgba(245,158,11,.2);background:linear-gradient(145deg,rgba(255,251,235,.84),rgba(255,255,255,.68))}.cofi-metrics article.risk strong{color:#b45309}.cofi-metrics article.advance{border-color:rgba(124,58,237,.17);background:linear-gradient(145deg,rgba(245,243,255,.85),rgba(255,255,255,.68))}.cofi-metrics article.advance strong{color:#6d28d9}.cofi-bottom{position:relative;display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:11px;padding-top:10px;border-top:1px solid rgba(148,163,184,.16)}.cofi-position{display:flex;align-items:center;gap:7px;min-width:0}.cofi-position small{font-size:7px;color:#94a3b8;font-weight:800}.cofi-state{display:inline-flex;align-items:center;min-height:22px;padding:0 8px;border-radius:999px;font-size:7px;letter-spacing:.09em;font-weight:950;white-space:nowrap}.cofi-state.healthy{color:#047857;background:#ecfdf5;border:1px solid #bbf7d0}.cofi-state.attention{color:#a16207;background:#fffbeb;border:1px solid #fde68a}.cofi-state.outstanding{color:#b91c1c;background:#fef2f2;border:1px solid #fecaca}.cofi-state.advance{color:#6d28d9;background:#f5f3ff;border:1px solid #ddd6fe}.cofi-state.insufficient{color:#64748b;background:#f8fafc;border:1px solid #e2e8f0}.cofi-open{min-height:35px;padding:0 11px;border-radius:10px;border:1px solid rgba(79,70,229,.18);background:linear-gradient(145deg,#eef2ff,#e0e7ff);color:#4338ca;font:inherit;font-size:8px;font-weight:950;cursor:pointer;white-space:nowrap}.cofi-open span{margin-left:4px}.cofi-insufficient .cofi-empty-copy{position:relative;margin:12px 0 0;max-width:650px;font-size:9px;line-height:1.5;color:#64748b}.cofi-insufficient .cofi-open{position:relative;margin-top:12px}.cofi-loading{min-height:160px}.cofi-loading-line{height:9px;width:55%;border-radius:99px;background:#e9eef5;animation:cofi-pulse 1.4s ease-in-out infinite}.cofi-loading-title{width:30%;height:7px}.cofi-loading-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-top:20px}.cofi-loading-grid span{height:58px;border-radius:14px;background:#eef2f7;animation:cofi-pulse 1.4s ease-in-out infinite}.cofi-loading-grid span:nth-child(2){animation-delay:.08s}.cofi-loading-grid span:nth-child(3){animation-delay:.16s}.cofi-loading-grid span:nth-child(4){animation-delay:.24s}.cofi-error{padding:20px}.cofi-error strong{position:relative;display:block;margin-top:6px;font-size:14px}.cofi-error p{position:relative;margin:6px 0 0;font-size:9px;color:#64748b}.cofi-error button{position:relative;margin-top:11px;min-height:35px;padding:0 12px;border:0;border-radius:10px;background:#4f46e5;color:#fff;font:inherit;font-size:8px;font-weight:950;cursor:pointer}@keyframes cofi-pulse{50%{opacity:.5}}@media(max-width:700px){.cofi-metrics{grid-template-columns:1fr 1fr}}@media(max-width:430px){.cofi-head{align-items:flex-start}.cofi-orbit{flex-basis:72px;width:72px;height:72px}.cofi-orbit-core{width:54px;height:54px}.cofi-orbit-core strong{font-size:15px}.cofi-bottom{align-items:stretch;flex-direction:column}.cofi-open{width:100%}.cofi-position{justify-content:space-between}.cofi-loading-grid{grid-template-columns:1fr 1fr}}@media(prefers-reduced-motion:reduce){.cofi-loading-line,.cofi-loading-grid span{animation:none}}`;

export const contractorOverviewFinanceIntelligenceStyles = styles;
