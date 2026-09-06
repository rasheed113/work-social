import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase/client';
import type { ExpenseOverviewData } from '../domain/overview';

type Props = { data: ExpenseOverviewData; periodLabel: string };
type Tx = { amount: number | string; date: string; account_id: string | null; created_at: string };
type Candle = { date: string; values: number[] };

const money = (n: number, c: string) => { try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: c, maximumFractionDigits: 2 }).format(n); } catch { return `${c} ${n.toFixed(2)}`; } };
const label = (d: string, full = false) => new Intl.DateTimeFormat(undefined, full ? { weekday: 'short', month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric' }).format(new Date(`${d}T12:00:00`));

function CandleChart({ data, currency }: { data: ExpenseOverviewData; currency: string }) {
  const [rows, setRows] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState(0);
  useEffect(() => {
    let live = true;
    (async () => {
      setLoading(true); setError(null);
      const { data: auth, error: ae } = await supabase.auth.getUser();
      if (ae) throw ae;
      if (!auth.user) throw new Error('Signed-in session could not be resolved.');
      const { data: tx, error: te } = await supabase.from('expense_transactions').select('amount,date,account_id,created_at').eq('user_id', auth.user.id).eq('type', 'expense').gte('date', data.period_start).lte('date', data.period_end).order('date').order('created_at');
      if (te) throw te;
      const expenses = (tx ?? []) as Tx[];
      const ids = [...new Set(expenses.map(x => x.account_id).filter((x): x is string => Boolean(x)))];
      const currencies = new Map<string, string>();
      if (ids.length) {
        const { data: accounts, error: ce } = await supabase.from('expense_accounts').select('id,currency').eq('user_id', auth.user.id).in('id', ids);
        if (ce) throw ce;
        for (const a of accounts ?? []) currencies.set(a.id, a.currency);
      }
      const filtered = expenses.filter(x => (currencies.get(x.account_id ?? '') ?? '') === currency && Number(x.amount) > 0);
      if (live) { setRows(filtered); setSelected(Math.max(0, new Set(filtered.map(x => x.date)).size - 1)); }
    })().catch(e => live && setError(e instanceof Error ? e.message : 'Unable to load expense chart data.')).finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [currency, data.period_start, data.period_end]);

  const candles = useMemo<Candle[]>(() => {
    const map = new Map<string, number[]>();
    for (const r of rows) { const a = Number(r.amount); if (!Number.isFinite(a) || a <= 0) continue; (map.get(r.date) ?? (map.set(r.date, []), map.get(r.date)!)).push(a); }
    return [...map.entries()].map(([date, values]) => ({ date, values }));
  }, [rows]);

  if (loading) return <div className="expense-candle-state">Loading real expense activity…</div>;
  if (error) return <div className="expense-candle-state error">{error}</div>;
  if (!candles.length) return <div className="expense-candle-state">No persisted {currency} expenses in this period.</div>;
  const active = candles[Math.min(selected, candles.length - 1)];
  const width = 920, height = 300, left = 52, right = 18, top = 18, bottom = 42, plotW = width - left - right, plotH = height - top - bottom;
  const max = Math.max(1, ...candles.flatMap(c => c.values));
  const min = 0, step = plotW / candles.length, body = Math.max(10, Math.min(24, step * .48));
  const y = (v: number) => top + (max - v) / Math.max(max - min, 1) * plotH;
  return <div className="expense-candle"><div className="expense-candle-chart-wrap"><svg className="expense-candle-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Overall ${currency} expense candlestick chart`}>
    <line x1={left} x2={width - right} y1={top + plotH} y2={top + plotH} className="expense-candle-axis" />
    {candles.map((c, i) => { const open = c.values[0], close = c.values[c.values.length - 1], high = Math.max(...c.values), low = Math.min(...c.values); const x = left + i * step + step / 2; return <g key={c.date} tabIndex={0} role="button" className={`expense-candle-bar${i === selected ? ' selected' : ''}`} onClick={() => setSelected(i)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(i); } }} aria-label={`${label(c.date, true)} ${money(c.values.reduce((a,b)=>a+b,0),currency)}`}>
      <line x1={x} x2={x} y1={y(high)} y2={y(low)} className="expense-candle-wick" />
      <rect x={x-body/2} y={Math.min(y(open),y(close))} width={body} height={Math.max(6,Math.abs(y(close)-y(open)))} rx="2" className={`expense-candle-body ${close >= open ? 'up' : 'down'}`} />
      {i % Math.max(1, Math.ceil(candles.length / 8)) === 0 && <text x={x} y={height - 15} textAnchor="middle" className="expense-candle-label">{label(c.date)}</text>}
      <title>{`${c.date} · ${money(c.values.reduce((a,b)=>a+b,0),currency)} · ${c.values.length} expense transaction${c.values.length === 1 ? '' : 's'}`}</title>
    </g>; })}
  </svg></div><div className="expense-candle-detail"><div><small>{label(active.date, true)}</small><strong>{money(active.values.reduce((a,b)=>a+b,0), currency)}</strong><span>{active.values.length} expense transaction{active.values.length === 1 ? '' : 's'}</span></div><div className="expense-candle-ohlc"><span>O <b>{money(active.values[0],currency)}</b></span><span>H <b>{money(Math.max(...active.values),currency)}</b></span><span>L <b>{money(Math.min(...active.values),currency)}</b></span><span>C <b>{money(active.values[active.values.length-1],currency)}</b></span></div></div></div>;
}

const style = `.expense-fi-card{grid-column:span 12;min-width:0;border:1px solid #e2e8f0;border-radius:20px;background:#fff;padding:16px;box-sizing:border-box;box-shadow:0 12px 28px rgba(15,23,42,.06)}.expense-fi-head{display:flex;justify-content:space-between;gap:12px;margin-bottom:12px}.expense-fi-eyebrow{margin:0 0 3px;color:#2563eb;font-size:9px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.expense-fi-title{margin:0;color:#0f172a;font-size:15px;font-weight:950}.expense-fi-period{padding:5px 8px;border:1px solid #e2e8f0;border-radius:999px;color:#64748b;font-size:9px;height:max-content}.expense-candle-chart-wrap{width:100%;overflow:hidden;border-radius:16px;background:#0b1220;padding:7px;box-sizing:border-box}.expense-candle-svg{display:block;width:100%;height:auto;min-height:210px}.expense-candle-axis{stroke:#334155;stroke-width:1}.expense-candle-wick{stroke:#cbd5e1;stroke-width:2}.expense-candle-body{stroke-width:1}.expense-candle-body.up{fill:#22c55e;stroke:#86efac}.expense-candle-body.down{fill:#ef4444;stroke:#fca5a5}.expense-candle-bar{outline:none;cursor:pointer}.expense-candle-bar.selected .expense-candle-wick{stroke:#fff;stroke-width:3}.expense-candle-bar.selected .expense-candle-body{stroke:#fff;stroke-width:2}.expense-candle-label{fill:#94a3b8;font-size:10px}.expense-candle-detail{display:flex;justify-content:space-between;gap:14px;margin-top:10px;padding:10px 12px;border:1px solid #e2e8f0;border-radius:13px;background:#f8fafc}.expense-candle-detail small,.expense-candle-detail span{display:block;color:#64748b;font-size:9px}.expense-candle-detail strong{display:block;margin:3px 0;color:#0f172a;font-size:16px}.expense-candle-ohlc{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px 12px;align-content:center;color:#64748b;font-size:9px}.expense-candle-ohlc b{color:#0f172a}.expense-candle-state{padding:24px 4px;color:#64748b;font-size:10px}.expense-candle-state.error{color:#be123c}.expense-fi-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}.expense-fi-metric{padding:9px 10px;border:1px solid #e2e8f0;border-radius:12px}.expense-fi-metric small{display:block;color:#94a3b8;font-size:8px;text-transform:uppercase}.expense-fi-metric strong{display:block;margin-top:4px;font-size:11px}.expense-fi-metric.income strong{color:#047857}.expense-fi-metric.expense strong{color:#be123c}.expense-health-card{grid-column:span 12;border:1px solid #e2e8f0;border-radius:20px;background:#fff;padding:16px}.expense-health-body{display:flex;gap:18px;align-items:center}.expense-health-ring{width:112px;height:112px;flex:0 0 112px;border-radius:50%;display:grid;place-items:center;border:10px solid #cbd5e1}.expense-health-ring.positive{border-color:#a7f3d0}.expense-health-ring.negative{border-color:#fecdd3}.expense-health-copy h3{margin:0;font-size:16px}.expense-health-copy p{margin:6px 0;color:#64748b;font-size:10px;line-height:1.5}@media(max-width:520px){.expense-candle-detail,.expense-health-body{flex-direction:column;align-items:flex-start}}`;

export function FinancialInsightCard({ data, periodLabel }: Props) {
  const [currencies, setCurrencies] = useState<string[]>([]);
  const [currency, setCurrency] = useState('');
  useEffect(() => { let live = true; (async () => { const { data: auth } = await supabase.auth.getUser(); if (!auth.user) return; const { data: tx } = await supabase.from('expense_transactions').select('account_id').eq('user_id', auth.user.id).eq('type','expense').gte('date',data.period_start).lte('date',data.period_end); const ids=[...new Set((tx??[]).map(x=>x.account_id).filter(Boolean))] as string[]; if(!ids.length){if(live){setCurrencies([]);setCurrency('')}return;} const {data:accounts}=await supabase.from('expense_accounts').select('id,currency').eq('user_id',auth.user.id).in('id',ids); const list=[...new Set((accounts??[]).map(x=>x.currency).filter(Boolean))].sort(); if(live){setCurrencies(list);setCurrency(x=>list.includes(x)?x:(list[0]??''));}})(); return()=>{live=false}; },[data.period_start,data.period_end]);
  const period = data.period_currencies.find(x => x.currency === currency);
  return <article className="expense-fi-card"><style>{style}</style><div className="expense-fi-head"><div><p className="expense-fi-eyebrow">Financial insight</p><h2 className="expense-fi-title">Overall expense activity</h2></div><span className="expense-fi-period">{periodLabel}</span></div>{currencies.length>1&&<div style={{display:'flex',gap:6,marginBottom:10}}>{currencies.map(c=><button key={c} type="button" onClick={()=>setCurrency(c)} style={{border:'1px solid #cbd5e1',borderRadius:999,padding:'5px 9px',background:c===currency?'#0f172a':'#fff',color:c===currency?'#fff':'#334155',fontSize:9,fontWeight:800}}>{c}</button>)}</div>}{currency?<><CandleChart data={data} currency={currency}/><div className="expense-fi-metrics"><div className="expense-fi-metric income"><small>Income</small><strong>{money(period?.income??0,currency)}</strong></div><div className="expense-fi-metric expense"><small>Total spending</small><strong>{money(period?.expenses??0,currency)}</strong></div></div></>:<div className="expense-candle-state">No persisted expense activity in this period.</div>}</article>;
}

export function DeterministicIntelligenceCard({ data, periodLabel }: Props) {
  const p=data.period_currencies.length===1?data.period_currencies[0]:null; const flow=p?p.income-p.expenses:null; const positive=flow!==null&&flow>0; const negative=flow!==null&&flow<0;
  return <article className="expense-health-card"><div className="expense-fi-head"><div><p className="expense-fi-eyebrow">Deterministic intelligence</p><h2 className="expense-fi-title">Financial health</h2></div><span className="expense-fi-period">{periodLabel}</span></div><div className="expense-health-body"><div className={`expense-health-ring ${positive?'positive':negative?'negative':''}`}><strong>{flow===null?'↔':positive?'✓':negative?'!':'—'}</strong></div><div className="expense-health-copy"><h3>{flow===null?'Currency-separated cash flow':positive?'Cash-flow positive':negative?'Cash-flow negative':'Cash-flow neutral'}</h3><p>{flow===null?'Cash flow remains separated by currency; no exchange rate is invented.':positive?'Income is greater than spending for the selected period.':negative?'Spending is greater than income for the selected period.':'Income and spending are balanced for the selected period.'}</p>{p&&<p><b>Cash flow:</b> {flow>0?'+':''}{money(flow,p.currency)}</p>}</div></div></article>;
}
