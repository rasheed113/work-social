import { useEffect, useMemo, useState } from 'react';
import { navigate } from '../../../app/Router';
import { supabase } from '../../../lib/supabase/client';

type Summary = {
  daily_earnings: number;
  weekly_earnings: number;
  monthly_earnings: number;
  total_earnings: number;
  received_amount: number;
  current_balance: number;
  advance_amount: number;
};

type Context = { team_id: number; team_number: number; team_name: string; team_purpose: string };
type Earning = { id: string; item_name: string; quantity: number; rate: number; total: number; occurred_at: string };
type Received = { id: string; amount: number; received_at: string; note: string | null };
type Period = 'today' | 'week' | 'month';

const money = (value: number) => `PKR ${Number(value || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`;
const dateText = (value: string) => new Date(value).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
const timeText = (value: string) => new Date(value).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
const teamNumberFromPath = () => {
  const match = window.location.pathname.match(/^\/work\/team-work\/(\d+)\/finance\/?$/);
  return match ? Number(match[1]) : null;
};

export function WorkerTeamFinancePage() {
  const teamNumber = teamNumberFromPath();
  const [context, setContext] = useState<Context | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [received, setReceived] = useState<Received[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showReceivedForm, setShowReceivedForm] = useState(false);
  const [showReceivedHistory, setShowReceivedHistory] = useState(false);
  const [showPayments, setShowPayments] = useState(false);
  const [paymentPeriod, setPaymentPeriod] = useState<Period>('today');
  const [amount, setAmount] = useState('');
  const [receivedAt, setReceivedAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState('');

  const load = async () => {
    if (!teamNumber) { setError('Team Finance workspace is unavailable.'); setLoading(false); return; }
    setLoading(true); setError('');
    const [{ data: ctx, error: ctxError }, { data: sum, error: sumError }, { data: earn, error: earnError }, { data: rec, error: recError }] = await Promise.all([
      supabase.rpc('get_worker_team_work_context', { p_team_number: teamNumber }),
      supabase.rpc('get_worker_team_finance_summary', { p_team_number: teamNumber }),
      supabase.rpc('get_worker_team_finance_earnings_history', { p_team_number: teamNumber, p_period: 'all' }),
      supabase.rpc('get_worker_team_finance_received_history', { p_team_number: teamNumber }),
    ]);
    const firstContext = (ctx ?? [])[0] as Context | undefined;
    if (ctxError || sumError || earnError || recError || !firstContext) {
      setError(ctxError?.message || sumError?.message || earnError?.message || recError?.message || 'Team Finance could not be loaded.');
      setLoading(false);
      return;
    }
    setContext(firstContext);
    setSummary(((sum ?? [])[0] ?? null) as Summary | null);
    setEarnings((earn ?? []) as Earning[]);
    setReceived((rec ?? []) as Received[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [teamNumber]);

  const history = useMemo(() => [
    ...earnings.map(item => ({ kind: 'earning' as const, id: item.id, at: item.occurred_at, title: item.item_name, detail: `${item.quantity} × ${money(item.rate)}`, amount: Number(item.total || 0) })),
    ...received.map(item => ({ kind: 'received' as const, id: item.id, at: item.received_at, title: 'Received Amount', detail: item.note || 'Manual received entry', amount: Number(item.amount || 0) })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()), [earnings, received]);

  const submitReceived = async () => {
    if (!teamNumber || saving) return;
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) { setFormError('Received amount must be greater than zero.'); return; }
    setSaving(true); setFormError('');
    const { error: mutationError } = await supabase.rpc('add_worker_team_finance_received', {
      p_team_number: teamNumber,
      p_amount: parsed,
      p_received_at: new Date(receivedAt).toISOString(),
      p_note: note.trim() || null,
    });
    if (mutationError) { setFormError(mutationError.message); setSaving(false); return; }
    setAmount(''); setNote(''); setReceivedAt(new Date().toISOString().slice(0, 16)); setSaving(false); setShowReceivedForm(false);
    await load();
  };

  const paymentItems = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    if (paymentPeriod === 'today') start.setHours(0, 0, 0, 0);
    if (paymentPeriod === 'week') {
      start.setHours(0, 0, 0, 0);
      const day = start.getDay();
      start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
    }
    if (paymentPeriod === 'month') { start.setDate(1); start.setHours(0, 0, 0, 0); }
    return earnings.filter(item => new Date(item.occurred_at) >= start);
  }, [earnings, paymentPeriod]);
  const paymentTotal = paymentItems.reduce((sum, item) => sum + Number(item.total || 0), 0);

  if (loading) return <main className="wtf-page"><div className="wtf-state">Opening Team Finance…</div></main>;
  if (error || !context || !summary) return <main className="wtf-page"><div className="wtf-state wtf-error"><strong>Team Finance unavailable</strong><p>{error || 'Financial data could not be loaded.'}</p><button onClick={() => navigate(`/work/team-work/${teamNumber ?? ''}`)}>← Back to Team</button></div></main>;

  return (
    <main className="wtf-page">
      <style>{`
        .wtf-page{min-height:100dvh;padding:14px 12px 118px;box-sizing:border-box;background:radial-gradient(circle at 5% 0,rgba(59,130,246,.18),transparent 30%),radial-gradient(circle at 96% 9%,rgba(168,85,247,.18),transparent 31%),linear-gradient(180deg,#07111f,#0b1220 48%,#10152a);color:#eef2ff}.wtf-shell{width:min(940px,100%);margin:auto}.wtf-top{display:flex;align-items:center;gap:10px;margin-bottom:13px}.wtf-back{width:40px;height:40px;border:1px solid rgba(255,255,255,.16);border-radius:13px;background:linear-gradient(145deg,rgba(255,255,255,.15),rgba(255,255,255,.05));color:#fff;font-size:22px;font-weight:950}.wtf-kicker{font-size:8px;font-weight:950;letter-spacing:.18em;color:#67e8f9}.wtf-title{margin:5px 0 0;font-size:clamp(26px,7vw,40px);line-height:1;letter-spacing:-.055em}.wtf-sub{margin:7px 0 0;color:#94a3b8;font-size:10px}.wtf-hero{position:relative;overflow:hidden;padding:18px;border:1px solid rgba(125,211,252,.16);border-radius:24px;background:linear-gradient(145deg,rgba(30,41,59,.94),rgba(15,23,42,.88));box-shadow:0 28px 65px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,255,255,.1);margin-bottom:12px}.wtf-hero:after{content:'';position:absolute;width:220px;height:220px;right:-90px;top:-110px;border-radius:50%;background:radial-gradient(circle,rgba(34,211,238,.2),rgba(139,92,246,.08) 58%,transparent 72%)}.wtf-hero-label{color:#a5f3fc;font-size:8px;font-weight:950;letter-spacing:.14em}.wtf-hero-name{margin:6px 0 0;font-size:22px;font-weight:950}.wtf-team-id{margin-top:5px;color:#64748b;font-size:8px;font-weight:900;letter-spacing:.12em}.wtf-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.wtf-card{position:relative;overflow:hidden;padding:15px;border:1px solid rgba(255,255,255,.1);border-radius:19px;background:linear-gradient(145deg,rgba(30,41,59,.9),rgba(15,23,42,.82));box-shadow:0 16px 35px rgba(0,0,0,.25),inset 0 1px 0 rgba(255,255,255,.08)}.wtf-card span{display:block;color:#94a3b8;font-size:8px;font-weight:950;letter-spacing:.12em}.wtf-card strong{display:block;margin-top:8px;font-size:19px;letter-spacing:-.04em}.wtf-card small{display:block;margin-top:5px;color:#64748b;font-size:8px}.wtf-earn strong{color:#67e8f9}.wtf-received strong{color:#86efac}.wtf-balance strong{color:#fbbf24}.wtf-advance strong{color:#c4b5fd}.wtf-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:11px 0}.wtf-btn{min-height:45px;border:1px solid rgba(255,255,255,.12);border-radius:14px;color:#f8fafc;font:inherit;font-size:9px;font-weight:950;background:linear-gradient(145deg,rgba(59,130,246,.25),rgba(139,92,246,.2));box-shadow:0 12px 25px rgba(0,0,0,.2),inset 0 1px 0 rgba(255,255,255,.08)}.wtf-btn-primary{background:linear-gradient(145deg,#0891b2,#4f46e5)}.wtf-section{margin-top:12px;padding:16px;border:1px solid rgba(255,255,255,.1);border-radius:20px;background:rgba(15,23,42,.74);box-shadow:0 18px 35px rgba(0,0,0,.2),inset 0 1px 0 rgba(255,255,255,.06)}.wtf-section-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.wtf-section h2{margin:0;font-size:17px}.wtf-history{display:grid;gap:8px;margin-top:12px}.wtf-history-item{display:flex;align-items:center;gap:10px;padding:11px;border:1px solid rgba(255,255,255,.07);border-radius:14px;background:rgba(30,41,59,.55)}.wtf-dot{width:9px;height:9px;border-radius:50%;flex:0 0 9px}.wtf-dot-earning{background:#22d3ee;box-shadow:0 0 13px rgba(34,211,238,.65)}.wtf-dot-received{background:#4ade80;box-shadow:0 0 13px rgba(74,222,128,.55)}.wtf-history-main{min-width:0;flex:1}.wtf-history-title{font-size:10px;font-weight:900}.wtf-history-detail{margin-top:3px;color:#64748b;font-size:8px}.wtf-history-date{margin-top:3px;color:#475569;font-size:7px}.wtf-history-amount{font-size:10px;font-weight:950}.wtf-received-amount{color:#86efac}.wtf-earning-amount{color:#67e8f9}.wtf-modal-backdrop{position:fixed;inset:0;z-index:3000;display:grid;place-items:center;padding:15px;background:rgba(2,6,23,.72);backdrop-filter:blur(12px)}.wtf-modal{width:min(650px,100%);max-height:88dvh;overflow:auto;padding:18px;border:1px solid rgba(255,255,255,.14);border-radius:24px;background:linear-gradient(145deg,#111c30,#0b1220);box-shadow:0 35px 100px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.08)}.wtf-modal-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.wtf-modal h3{margin:0;font-size:22px}.wtf-modal p{margin:6px 0 0;color:#64748b;font-size:9px}.wtf-close{width:36px;height:36px;border:1px solid rgba(255,255,255,.1);border-radius:11px;background:rgba(255,255,255,.06);color:#fff;font-weight:950}.wtf-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin:15px 0}.wtf-tab{min-height:38px;border:1px solid rgba(255,255,255,.09);border-radius:11px;background:rgba(255,255,255,.04);color:#94a3b8;font:inherit;font-size:8px;font-weight:950}.wtf-tab-active{background:linear-gradient(145deg,#0891b2,#4f46e5);color:#fff;border-color:transparent}.wtf-period-total{padding:16px;border-radius:17px;background:linear-gradient(145deg,rgba(34,211,238,.14),rgba(139,92,246,.14));border:1px solid rgba(103,232,249,.13)}.wtf-period-total span{color:#94a3b8;font-size:8px;font-weight:950;letter-spacing:.12em}.wtf-period-total strong{display:block;margin-top:7px;font-size:27px}.wtf-form{display:grid;gap:9px;margin-top:14px}.wtf-input{width:100%;box-sizing:border-box;padding:12px;border:1px solid rgba(255,255,255,.11);border-radius:12px;background:rgba(2,6,23,.5);color:#fff;font:inherit;font-size:10px;outline:none}.wtf-input:focus{border-color:rgba(34,211,238,.5)}.wtf-error-text{color:#fca5a5;font-size:9px;font-weight:800}.wtf-modal-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}.wtf-empty{padding:18px;text-align:center;color:#64748b;font-size:9px;border:1px dashed rgba(255,255,255,.1);border-radius:14px}@media(max-width:500px){.wtf-grid{grid-template-columns:1fr}.wtf-actions{grid-template-columns:1fr}.wtf-modal-actions{grid-template-columns:1fr}}
      `}</style>
      <div className="wtf-shell">
        <div className="wtf-top"><button className="wtf-back" onClick={() => navigate(`/work/team-work/${teamNumber ?? ''}`)}>‹</button><div><div className="wtf-kicker">TEAM FINANCE · {context.team_number}</div><h1 className="wtf-title">{context.team_name}</h1><div className="wtf-sub">Worker Team Finance · personal finance stays separate</div></div></div>
        <section className="wtf-hero"><div className="wtf-hero-label">FINANCIAL POSITION</div><div className="wtf-hero-name">{context.team_name}</div><div className="wtf-team-id">TEAM ID · {context.team_number}</div></section>
        <div className="wtf-grid">
          <article className="wtf-card wtf-earn"><span>TOTAL EARNINGS</span><strong>{money(summary.total_earnings)}</strong><small>Today {money(summary.daily_earnings)} · Week {money(summary.weekly_earnings)} · Month {money(summary.monthly_earnings)}</small></article>
          <button className="wtf-card wtf-received" onClick={() => setShowReceivedHistory(true)}><span>RECEIVED AMOUNT</span><strong>{money(summary.received_amount)}</strong><small>Tap to view received history</small></button>
          <article className="wtf-card wtf-balance"><span>CURRENT BALANCE</span><strong>{money(summary.current_balance)}</strong><small>Earnings minus received</small></article>
          <article className="wtf-card wtf-advance"><span>ADVANCE</span><strong>{money(summary.advance_amount)}</strong><small>Extra received above earnings</small></article>
        </div>
        <div className="wtf-actions"><button className="wtf-btn wtf-btn-primary" onClick={() => { setFormError(''); setShowReceivedForm(true); }}>+ ADD RECEIVED</button><button className="wtf-btn" onClick={() => setShowPayments(true)}>VIEW PAYMENTS →</button></div>
        <section className="wtf-section"><div className="wtf-section-head"><h2>Finance History</h2><span className="wtf-kicker">REAL DATA</span></div><div className="wtf-history">{history.length === 0 ? <div className="wtf-empty">No Team Finance activity yet.</div> : history.map(item => <div className="wtf-history-item" key={`${item.kind}-${item.id}`}><span className={`wtf-dot ${item.kind === 'earning' ? 'wtf-dot-earning' : 'wtf-dot-received'}`} /><div className="wtf-history-main"><div className="wtf-history-title">{item.kind === 'earning' ? 'WORK EARNING · ' : ''}{item.title}</div><div className="wtf-history-detail">{item.detail}</div><div className="wtf-history-date">{dateText(item.at)} · {timeText(item.at)}</div></div><strong className={item.kind === 'earning' ? 'wtf-history-amount wtf-earning-amount' : 'wtf-history-amount wtf-received-amount'}>+ {money(item.amount)}</strong></div>)}</div></section>
      </div>

      {showReceivedForm && <div className="wtf-modal-backdrop"><section className="wtf-modal"><div className="wtf-modal-top"><div><h3>Add Received Amount</h3><p>This record belongs only to the selected Worker Team.</p></div><button className="wtf-close" onClick={() => !saving && setShowReceivedForm(false)}>×</button></div><div className="wtf-form"><input className="wtf-input" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount (PKR)" disabled={saving}/><input className="wtf-input" type="datetime-local" value={receivedAt} onChange={e => setReceivedAt(e.target.value)} disabled={saving}/><input className="wtf-input" value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)" disabled={saving}/>{formError && <div className="wtf-error-text">{formError}</div>}</div><div className="wtf-modal-actions"><button className="wtf-btn" onClick={() => setShowReceivedForm(false)} disabled={saving}>Cancel</button><button className="wtf-btn wtf-btn-primary" onClick={() => void submitReceived()} disabled={saving}>{saving ? 'Saving…' : 'Save Received'}</button></div></section></div>}

      {showReceivedHistory && <div className="wtf-modal-backdrop"><section className="wtf-modal"><div className="wtf-modal-top"><div><h3>Received History</h3><p>Only real received records for this Worker + Team.</p></div><button className="wtf-close" onClick={() => setShowReceivedHistory(false)}>×</button></div><div className="wtf-history">{received.length === 0 ? <div className="wtf-empty">No received amount has been recorded yet.</div> : received.map(item => <div className="wtf-history-item" key={item.id}><span className="wtf-dot wtf-dot-received" /><div className="wtf-history-main"><div className="wtf-history-title">Received Amount</div><div className="wtf-history-detail">{item.note || 'Manual received entry'}</div><div className="wtf-history-date">{dateText(item.received_at)} · {timeText(item.received_at)}</div></div><strong className="wtf-history-amount wtf-received-amount">{money(Number(item.amount || 0))}</strong></div>)}</div></section></div>}

      {showPayments && <div className="wtf-modal-backdrop"><section className="wtf-modal"><div className="wtf-modal-top"><div><h3>Payments</h3><p>Worker earnings viewer — received money is shown separately.</p></div><button className="wtf-close" onClick={() => setShowPayments(false)}>×</button></div><div className="wtf-tabs">{(['today','week','month'] as Period[]).map(period => <button key={period} className={`wtf-tab ${paymentPeriod === period ? 'wtf-tab-active' : ''}`} onClick={() => setPaymentPeriod(period)}>{period === 'today' ? 'TODAY' : period === 'week' ? 'WEEK · MON–SUN' : 'MONTH'}</button>)}</div><div className="wtf-period-total"><span>{paymentPeriod === 'today' ? 'TODAY EARNINGS' : paymentPeriod === 'week' ? 'WEEK EARNINGS' : 'MONTH EARNINGS'}</span><strong>{money(paymentTotal)}</strong></div><div className="wtf-history">{paymentItems.length === 0 ? <div className="wtf-empty">No earnings in this period.</div> : paymentItems.map(item => <div className="wtf-history-item" key={item.id}><span className="wtf-dot wtf-dot-earning" /><div className="wtf-history-main"><div className="wtf-history-title">{item.item_name}</div><div className="wtf-history-detail">{item.quantity} × {money(Number(item.rate || 0))}</div><div className="wtf-history-date">{dateText(item.occurred_at)} · {timeText(item.occurred_at)}</div></div><strong className="wtf-history-amount wtf-earning-amount">{money(Number(item.total || 0))}</strong></div>)}</div></section></div>}
    </main>
  );
}
