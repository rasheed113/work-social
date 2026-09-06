import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase/client';
import { loadExpenseTransactionData } from '../data/expenseManagerTransactions';
import type { ExpenseTransactionRecord } from '../domain/transactions';

interface ExpenseActivityPageProps { onNavigate: (path: string) => void; }
type ActivityPeriod = 'today' | 'week' | 'month' | 'ytd' | 'up-to-date' | 'end-of-month';

const PERIODS: Array<{ id: ActivityPeriod; label: string }> = [
  { id: 'today', label: "Today's activity" },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'ytd', label: 'Year to date' },
  { id: 'up-to-date', label: 'Up to date' },
  { id: 'end-of-month', label: 'End of month' },
];

function dateKey(value: Date) { return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`; }
function boundsFor(period: ActivityPeriod) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  let start = monthStart;
  let end = monthEnd;
  if (period === 'today') start = end = now;
  if (period === 'week') { start = new Date(now); start.setDate(now.getDate() - ((now.getDay() + 6) % 7)); end = now; }
  if (period === 'ytd' || period === 'up-to-date') start = new Date(now.getFullYear(), 0, 1);
  if (period === 'up-to-date') end = now;
  if (period === 'end-of-month') { start = monthStart; end = monthEnd; }
  return { start: dateKey(start), end: dateKey(end) };
}
function money(amount: number, currency: string) { try { return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount); } catch { return `${currency} ${amount.toLocaleString()}`; } }

export function ExpenseActivityPage({ onNavigate }: ExpenseActivityPageProps) {
  const initial = new URLSearchParams(window.location.search).get('period') as ActivityPeriod | null;
  const [period, setPeriod] = useState<ActivityPeriod>(PERIODS.some((item) => item.id === initial) ? initial! : 'month');
  const [rows, setRows] = useState<ExpenseTransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const bounds = useMemo(() => boundsFor(period), [period]);

  useEffect(() => { let active = true; setLoading(true); setError(''); void supabase.auth.getUser().then(async ({ data, error: authError }) => { if (authError || !data.user) throw authError ?? new Error('Your signed-in session could not be resolved.'); const result = await loadExpenseTransactionData(data.user.id); if (!active) return; setRows(result.transactions.filter((row) => row.date >= bounds.start && row.date <= bounds.end)); }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load activity.'); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [bounds.end, bounds.start]);

  const totals = useMemo(() => rows.reduce((acc, row) => { const value = Number(row.amount) || 0; const bucket = row.type === 'income' ? 'income' : row.type === 'expense' ? 'expense' : 'transfer'; acc[bucket] += value; return acc; }, { income: 0, expense: 0, transfer: 0 }), [rows]);
  const incomeCurrency = rows.find((row) => row.type === 'income')?.account_currency || 'PKR';
  const expenseCurrency = rows.find((row) => row.type === 'expense')?.account_currency || 'PKR';
  const selectPeriod = (next: ActivityPeriod) => { setPeriod(next); window.history.replaceState({}, '', `/expense-manager/activity?period=${next}`); };

  return <section className="expense-activity" aria-labelledby="expense-activity-title"><style>{`
    .expense-activity{width:min(900px,100%);margin:0 auto;padding:0 2px 110px}.expense-activity__back{display:inline-flex;align-items:center;gap:6px;margin:0 0 10px;padding:7px 9px;border:1px solid rgba(148,163,184,.16);border-radius:10px;background:rgba(255,255,255,.76);color:#475569;font:inherit;font-size:10px;font-weight:850;cursor:pointer}.expense-activity__hero{margin-bottom:12px}.expense-activity__eyebrow{color:#2563eb;font-size:9px;font-weight:900;letter-spacing:.13em;text-transform:uppercase}.expense-activity h1{margin:4px 0;color:#0f172a;font-size:24px;font-weight:950;letter-spacing:-.04em}.expense-activity__copy{margin:0;color:#64748b;font-size:10px;font-weight:650}.expense-activity__periods{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-bottom:12px}.expense-activity__period{display:flex;align-items:center;justify-content:space-between;gap:6px;min-height:40px;padding:0 10px;border:1px solid rgba(148,163,184,.15);border-radius:12px;background:#fff;color:#475569;font:inherit;font-size:9px;font-weight:850;cursor:pointer}.expense-activity__period[data-active=true]{border-color:rgba(37,99,235,.2);background:#eff6ff;color:#1d4ed8}.expense-activity__period span:last-child{font-size:13px}.expense-activity__summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-bottom:12px}.expense-activity__metric{padding:10px 11px;border:1px solid rgba(148,163,184,.14);border-radius:13px;background:rgba(255,255,255,.9)}.expense-activity__metric span{display:block;color:#94a3b8;font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.08em}.expense-activity__metric strong{display:block;margin-top:4px;color:#172033;font-size:13px;font-weight:950}.expense-activity__metric[data-type=income] strong{color:#047857}.expense-activity__metric[data-type=expense] strong{color:#be123c}.expense-activity__list{overflow:hidden;border:1px solid rgba(148,163,184,.15);border-radius:16px;background:rgba(255,255,255,.9);box-shadow:0 10px 24px rgba(15,23,42,.05)}.expense-activity__row{display:grid;grid-template-columns:34px minmax(0,1fr) auto;align-items:center;gap:9px;padding:10px 11px;border-bottom:1px solid rgba(148,163,184,.1)}.expense-activity__row:last-child{border-bottom:0}.expense-activity__icon{width:34px;height:34px;display:grid;place-items:center;border-radius:10px;background:#f1f5f9;color:#334155;font-size:13px}.expense-activity__main{min-width:0}.expense-activity__name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#172033;font-size:10px;font-weight:900}.expense-activity__meta{margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#94a3b8;font-size:8px;font-weight:700}.expense-activity__amount{white-space:nowrap;color:#475569;font-size:10px;font-weight:950}.expense-activity__amount[data-type=income]{color:#047857}.expense-activity__amount[data-type=expense]{color:#be123c}.expense-activity__empty{padding:30px 15px;text-align:center;color:#64748b;font-size:10px;font-weight:700}.expense-activity__error{padding:18px;border-radius:14px;background:#fff1f2;color:#9f1239;font-size:10px;font-weight:750}@media(max-width:560px){.expense-activity__periods{grid-template-columns:repeat(2,minmax(0,1fr))}.expense-activity__summary{grid-template-columns:1fr}.expense-activity__row{grid-template-columns:32px minmax(0,1fr) auto}.expense-activity__icon{width:32px;height:32px}}
  `}</style>
    <button type="button" className="expense-activity__back" onClick={() => onNavigate('/expense-manager')}>‹ Overview</button>
    <header className="expense-activity__hero"><span className="expense-activity__eyebrow">Financial activity</span><h1 id="expense-activity-title">Activity</h1><p className="expense-activity__copy">Real persisted Expense Manager transactions for the selected period.</p></header>
    <div className="expense-activity__periods">{PERIODS.map((item) => <button type="button" className="expense-activity__period" data-active={period === item.id} key={item.id} onClick={() => selectPeriod(item.id)}><span>{item.label}</span><span>→</span></button>)}</div>
    <div className="expense-activity__summary"><div className="expense-activity__metric" data-type="income"><span>Income</span><strong>{rows.length ? money(totals.income, incomeCurrency) : '—'}</strong></div><div className="expense-activity__metric" data-type="expense"><span>Expenses</span><strong>{rows.length ? money(totals.expense, expenseCurrency) : '—'}</strong></div><div className="expense-activity__metric"><span>Transactions</span><strong>{rows.length}</strong></div></div>
    {loading && <div className="expense-activity__empty">Loading persisted activity…</div>}
    {!loading && error && <div className="expense-activity__error" role="alert">{error}</div>}
    {!loading && !error && !rows.length && <div className="expense-activity__empty">No persisted transactions in this period.</div>}
    {!loading && !error && rows.length > 0 && <div className="expense-activity__list">{rows.map((row) => { const sign = row.type === 'income' ? '+' : row.type === 'expense' ? '−' : '↔'; return <div className="expense-activity__row" key={row.id}><span className="expense-activity__icon" aria-hidden="true">{row.category_name ? row.category_name.slice(0, 1).toUpperCase() : row.type === 'transfer' ? '↔' : '•'}</span><div className="expense-activity__main"><div className="expense-activity__name">{row.category_name || (row.type === 'transfer' ? 'Transfer' : 'Uncategorised')}</div><div className="expense-activity__meta">{row.date} · {row.account_name || 'Account'}{row.note ? ` · ${row.note}` : ''}</div></div><strong className="expense-activity__amount" data-type={row.type}>{sign} {money(row.amount, row.account_currency || 'PKR')}</strong></div>; })}</div>}
  </section>;
}
