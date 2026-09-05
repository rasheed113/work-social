import { useEffect, useMemo, useState } from 'react';
import { loadExpenseOverview } from '../data/expenseManagerOverview';
import type { ExpenseOverviewData, ExpenseOverviewPeriodCurrency } from '../domain/overview';
import { getExpensePeriodBounds } from '../domain/overview';

interface ExpenseOverviewDashboardProps {
  onNavigate: (path: string) => void;
}

const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

function formatCurrency(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${numberFormatter.format(amount)}`;
  }
}

function formatDate(date: string) {
  const value = new Date(`${date}T12:00:00`);
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(value);
}

function monthLabel(anchor: Date) {
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(anchor);
}

function periodCurrencyLabel(rows: ExpenseOverviewPeriodCurrency[]) {
  return rows.length === 1 ? rows[0].currency : rows.length > 1 ? 'Multiple currencies' : '—';
}

function periodRows(data: ExpenseOverviewData) {
  return data.period_currencies.length ? data.period_currencies : [];
}

export function ExpenseOverviewDashboard({ onNavigate }: ExpenseOverviewDashboardProps) {
  const [anchor, setAnchor] = useState(() => new Date());
  const [data, setData] = useState<ExpenseOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const bounds = useMemo(() => getExpensePeriodBounds(anchor), [anchor]);
  const currentMonth = useMemo(() => {
    const now = new Date();
    return now.getFullYear() === anchor.getFullYear() && now.getMonth() === anchor.getMonth();
  }, [anchor]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    loadExpenseOverview(bounds.start, bounds.end)
      .then((next) => {
        if (active) setData(next);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Unable to load your financial overview.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [bounds.end, bounds.start]);

  const primaryCurrency = data?.currencies.length === 1 ? data.currencies[0].currency : null;
  const periods = data ? periodRows(data) : [];
  const singlePeriod = periods.length === 1 ? periods[0] : null;
  const spendingTotal = data?.expenses ?? 0;
  const chartCategories = useMemo(
    () => singlePeriod && data ? data.top_categories.filter((item) => item.currency === singlePeriod.currency) : [],
    [data, singlePeriod],
  );
  const categoryTotal = chartCategories.reduce((sum, item) => sum + item.amount, 0);
  const chartGradient = useMemo(() => {
    if (!chartCategories.length || categoryTotal <= 0) return 'conic-gradient(#e2e8f0 0deg 360deg)';
    let cursor = 0;
    const stops = chartCategories.map((item, index) => {
      const next = cursor + (item.amount / categoryTotal) * 360;
      const hue = (index * 53 + 205) % 360;
      const stop = `hsl(${hue} 72% 52%) ${cursor}deg ${next}deg`;
      cursor = next;
      return stop;
    });
    return `conic-gradient(${stops.join(',')})`;
  }, [categoryTotal, chartCategories]);

  const shiftMonth = (delta: number) => {
    setAnchor((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  };

  return (
    <section className="expense-overview" aria-label="Expense Manager overview">
      <style>{`
        .expense-overview{width:min(1120px,100%);margin:0 auto;padding:0 2px 28px;box-sizing:border-box}
        .expense-overview__toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 16px}
        .expense-overview__period{display:flex;align-items:center;gap:8px;min-width:0}
        .expense-overview__period-button{width:38px;height:38px;display:grid;place-items:center;border:1px solid rgba(148,163,184,.2);border-radius:12px;background:rgba(255,255,255,.82);color:#334155;font-size:18px;font-weight:900;cursor:pointer;box-shadow:0 5px 14px rgba(15,23,42,.05)}
        .expense-overview__period-button:disabled{opacity:.4;cursor:not-allowed}
        .expense-overview__period-label{min-width:145px;text-align:center;color:#0f172a;font-size:14px;font-weight:900;letter-spacing:-.02em}
        .expense-overview__add{min-height:40px;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:0 14px;border:1px solid rgba(37,99,235,.2);border-radius:13px;background:linear-gradient(135deg,#2563eb,#4f46e5);color:#fff;font:inherit;font-size:12px;font-weight:900;box-shadow:0 8px 18px rgba(37,99,235,.18);cursor:pointer;white-space:nowrap}
        .expense-overview__grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:12px}
        .expense-overview__card{min-width:0;border:1px solid rgba(148,163,184,.17);border-radius:20px;background:linear-gradient(145deg,rgba(255,255,255,.96),rgba(248,250,252,.88));box-shadow:0 12px 28px rgba(15,23,42,.06),inset 0 1px 0 rgba(255,255,255,.95);padding:16px;box-sizing:border-box}
        .expense-overview__balance{grid-column:span 12;background:linear-gradient(145deg,#111827,#1e293b 58%,#312e81);color:#fff;border-color:rgba(255,255,255,.12);box-shadow:0 18px 38px rgba(15,23,42,.2),inset 0 1px 0 rgba(255,255,255,.12)}
        .expense-overview__balance-top{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}
        .expense-overview__eyebrow{margin:0 0 7px;color:rgba(226,232,240,.72);font-size:10px;font-weight:850;letter-spacing:.13em;text-transform:uppercase}
        .expense-overview__balance-value{margin:0;font-size:clamp(28px,7vw,42px);line-height:1.02;letter-spacing:-.055em;font-weight:950}
        .expense-overview__balance-meta{margin:8px 0 0;color:rgba(226,232,240,.7);font-size:11px;font-weight:650}
        .expense-overview__balance-currencies{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end}
        .expense-overview__currency-pill{padding:6px 8px;border:1px solid rgba(255,255,255,.12);border-radius:999px;background:rgba(255,255,255,.07);color:rgba(255,255,255,.86);font-size:9px;font-weight:850}
        .expense-overview__metric{grid-column:span 6}
        .expense-overview__metric-label{margin:0;color:#64748b;font-size:10px;font-weight:850;text-transform:uppercase;letter-spacing:.09em}
        .expense-overview__metric-value{margin:7px 0 0;color:#0f172a;font-size:21px;line-height:1.05;font-weight:950;letter-spacing:-.04em}
        .expense-overview__metric-value--income{color:#047857}.expense-overview__metric-value--expense{color:#be123c}
        .expense-overview__metric-note{margin:6px 0 0;color:#94a3b8;font-size:10px;font-weight:650}
        .expense-overview__wide{grid-column:span 12}
        .expense-overview__half{grid-column:span 12}
        .expense-overview__card-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 13px}
        .expense-overview__card-title{margin:0;color:#172033;font-size:14px;font-weight:900;letter-spacing:-.02em}
        .expense-overview__card-action{border:0;background:transparent;color:#2563eb;font:inherit;font-size:10px;font-weight:850;cursor:pointer;padding:5px}
        .expense-overview__spending{display:flex;align-items:center;gap:18px}
        .expense-overview__donut{position:relative;width:128px;height:128px;flex:0 0 128px;border-radius:50%;background:#e2e8f0;box-shadow:inset 0 0 0 1px rgba(15,23,42,.04)}
        .expense-overview__donut::after{content:'';position:absolute;inset:27px;border-radius:50%;background:#fff;box-shadow:0 2px 8px rgba(15,23,42,.06)}
        .expense-overview__legend{min-width:0;display:grid;gap:8px;flex:1}
        .expense-overview__legend-row{display:flex;align-items:center;gap:7px;min-width:0}
        .expense-overview__dot{width:8px;height:8px;flex:0 0 8px;border-radius:50%;background:hsl(var(--hue) 72% 52%)}
        .expense-overview__legend-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#334155;font-size:10px;font-weight:800}
        .expense-overview__legend-value{margin-left:auto;color:#0f172a;font-size:10px;font-weight:900;white-space:nowrap}
        .expense-overview__empty-mini{padding:18px 0 4px;color:#94a3b8;font-size:11px;font-weight:650;line-height:1.5}
        .expense-overview__list{display:grid;gap:7px}
        .expense-overview__row{display:flex;align-items:center;gap:10px;min-width:0;padding:9px 0;border-bottom:1px solid rgba(148,163,184,.12)}
        .expense-overview__row:last-child{border-bottom:0}
        .expense-overview__row-icon{width:34px;height:34px;display:grid;place-items:center;flex:0 0 34px;border-radius:11px;background:#f1f5f9;color:#334155;font-size:14px}
        .expense-overview__row-main{min-width:0;flex:1}
        .expense-overview__row-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#1e293b;font-size:11px;font-weight:850}
        .expense-overview__row-sub{margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#94a3b8;font-size:9px;font-weight:650}
        .expense-overview__row-amount{font-size:11px;font-weight:900;white-space:nowrap}
        .expense-overview__row-amount[data-type="income"]{color:#047857}.expense-overview__row-amount[data-type="expense"]{color:#be123c}.expense-overview__row-amount[data-type="transfer"]{color:#475569}
        .expense-overview__budget{display:grid;gap:8px;margin-bottom:15px}.expense-overview__budget:last-child{margin-bottom:0}
        .expense-overview__budget-head{display:flex;justify-content:space-between;gap:8px;color:#334155;font-size:10px;font-weight:850}
        .expense-overview__progress{height:8px;overflow:hidden;border-radius:999px;background:#e2e8f0}.expense-overview__progress>span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#2563eb,#14b8a6)}
        .expense-overview__budget-meta{display:flex;justify-content:space-between;gap:8px;color:#94a3b8;font-size:9px;font-weight:650}
        .expense-overview__insight{padding:12px;border-radius:14px;background:rgba(37,99,235,.055);border:1px solid rgba(37,99,235,.1);color:#334155;font-size:11px;line-height:1.55;font-weight:700}
        .expense-overview__empty{grid-column:span 12;padding:28px 20px;text-align:center}
        .expense-overview__empty-icon{width:52px;height:52px;margin:0 auto 12px;display:grid;place-items:center;border-radius:17px;background:linear-gradient(145deg,#dbeafe,#ede9fe);color:#4338ca;font-size:24px;font-weight:900}
        .expense-overview__empty-title{margin:0;color:#0f172a;font-size:17px;font-weight:950;letter-spacing:-.03em}.expense-overview__empty-copy{max-width:430px;margin:7px auto 16px;color:#64748b;font-size:11px;line-height:1.55;font-weight:650}
        .expense-overview__loading{grid-column:span 12;display:grid;gap:12px}.expense-overview__skeleton{height:126px;border-radius:20px;background:linear-gradient(90deg,#e2e8f0 25%,#f8fafc 50%,#e2e8f0 75%);background-size:200% 100%;animation:expense-shimmer 1.2s infinite}
        .expense-overview__error{grid-column:span 12;padding:16px;border-radius:18px;border:1px solid rgba(190,24,93,.14);background:rgba(190,24,93,.04);color:#9f1239;font-size:11px;font-weight:750}
        @keyframes expense-shimmer{to{background-position:-200% 0}}
        @media (min-width:700px){.expense-overview__metric{grid-column:span 4}.expense-overview__half{grid-column:span 6}.expense-overview__wide{grid-column:span 12}.expense-overview__balance{grid-column:span 12}}
        @media (max-width:460px){.expense-overview__toolbar{align-items:stretch}.expense-overview__add{padding:0 10px}.expense-overview__period-label{min-width:112px;font-size:12px}.expense-overview__spending{gap:12px}.expense-overview__donut{width:108px;height:108px;flex-basis:108px}.expense-overview__donut::after{inset:24px}}
      `}</style>

      <div className="expense-overview__toolbar">
        <div className="expense-overview__period" aria-label="Overview period">
          <button type="button" className="expense-overview__period-button" onClick={() => shiftMonth(-1)} aria-label="Previous month">‹</button>
          <strong className="expense-overview__period-label">{monthLabel(anchor)}</strong>
          <button type="button" className="expense-overview__period-button" onClick={() => shiftMonth(1)} disabled={currentMonth} aria-label="Next month">›</button>
        </div>
        <button type="button" className="expense-overview__add" onClick={() => onNavigate('/expense-manager/transactions?intent=add')}>
          <span aria-hidden="true">＋</span> Add transaction
        </button>
      </div>

      <div className="expense-overview__grid">
        {loading && (
          <div className="expense-overview__loading" aria-label="Loading financial overview">
            <div className="expense-overview__skeleton" />
            <div className="expense-overview__skeleton" />
          </div>
        )}

        {!loading && error && <div className="expense-overview__error">{error}</div>}

        {!loading && !error && data && !data.has_financial_records && (
          <div className="expense-overview__card expense-overview__empty">
            <div className="expense-overview__empty-icon" aria-hidden="true">＋</div>
            <h2 className="expense-overview__empty-title">No financial records yet</h2>
            <p className="expense-overview__empty-copy">Start tracking your money by adding your first expense or income. Your overview will populate from persisted Expense Manager data.</p>
            <button type="button" className="expense-overview__add" onClick={() => onNavigate('/expense-manager/transactions?intent=add')}>＋ Add transaction</button>
          </div>
        )}

        {!loading && !error && data && data.has_financial_records && (
          <>
            <article className="expense-overview__card expense-overview__balance">
              <div className="expense-overview__balance-top">
                <div>
                  <p className="expense-overview__eyebrow">Total balance</p>
                  {data.currencies.length === 1 ? (
                    <h2 className="expense-overview__balance-value">{formatCurrency(data.currencies[0].balance, data.currencies[0].currency)}</h2>
                  ) : (
                    <h2 className="expense-overview__balance-value">{data.currencies.length ? 'Multiple currencies' : '—'}</h2>
                  )}
                  <p className="expense-overview__balance-meta">Derived from account opening balances, income, expenses, and transfers.</p>
                </div>
                {data.currencies.length > 1 && <div className="expense-overview__balance-currencies">{data.currencies.map((item) => <span className="expense-overview__currency-pill" key={item.currency}>{formatCurrency(item.balance, item.currency)}</span>)}</div>}
              </div>
            </article>

            <article className="expense-overview__card expense-overview__metric">
              <p className="expense-overview__metric-label">Income</p>
              <p className="expense-overview__metric-value expense-overview__metric-value--income">{singlePeriod ? formatCurrency(singlePeriod.income, singlePeriod.currency) : periodCurrencyLabel(periods)}</p>
              <p className="expense-overview__metric-note">{singlePeriod ? `${singlePeriod.transaction_count} period transactions` : 'Reported separately when currencies differ'}</p>
            </article>
            <article className="expense-overview__card expense-overview__metric">
              <p className="expense-overview__metric-label">Expenses</p>
              <p className="expense-overview__metric-value expense-overview__metric-value--expense">{singlePeriod ? formatCurrency(singlePeriod.expenses, singlePeriod.currency) : periodCurrencyLabel(periods)}</p>
              <p className="expense-overview__metric-note">This selected month only</p>
            </article>
            <article className="expense-overview__card expense-overview__metric">
              <p className="expense-overview__metric-label">Net</p>
              <p className="expense-overview__metric-value">{singlePeriod ? formatCurrency(singlePeriod.income - singlePeriod.expenses, singlePeriod.currency) : periodCurrencyLabel(periods)}</p>
              <p className="expense-overview__metric-note">Income minus expenses</p>
            </article>

            <article className="expense-overview__card expense-overview__wide">
              <div className="expense-overview__card-head"><h2 className="expense-overview__card-title">Spending</h2><span className="expense-overview__metric-note">{singlePeriod ? formatCurrency(spendingTotal, singlePeriod.currency) : 'Multiple currencies'}</span></div>
              {data.top_categories.length ? (
                singlePeriod && chartCategories.length ? (
                  <div className="expense-overview__spending">
                    <div className="expense-overview__donut" style={{ background: chartGradient }} aria-label="Spending distribution chart" />
                    <div className="expense-overview__legend">
                      {chartCategories.map((item, index) => {
                        const percent = categoryTotal > 0 ? Math.round((item.amount / categoryTotal) * 100) : 0;
                        const hue = (index * 53 + 205) % 360;
                        return <div className="expense-overview__legend-row" key={`${item.id}-${item.currency}`}><span className="expense-overview__dot" style={{ ['--hue' as string]: hue }} /><span className="expense-overview__legend-name">{item.name} · {item.currency}</span><span className="expense-overview__legend-value">{percent}%</span></div>;
                      })}
                    </div>
                  </div>
                ) : <div className="expense-overview__empty-mini">Distribution is shown separately by currency. No exchange rate is applied.</div>
              ) : <div className="expense-overview__empty-mini">No expenses recorded for this period.</div>}
            </article>

            <article className="expense-overview__card expense-overview__half">
              <div className="expense-overview__card-head"><h2 className="expense-overview__card-title">Top spending</h2><button type="button" className="expense-overview__card-action" onClick={() => onNavigate('/expense-manager/categories')}>Categories</button></div>
              {data.top_categories.length ? <div className="expense-overview__list">{data.top_categories.slice(0, 5).map((item) => <div className="expense-overview__row" key={`${item.id}-${item.currency}`}><span className="expense-overview__row-icon" aria-hidden="true">{item.icon || '◈'}</span><div className="expense-overview__row-main"><div className="expense-overview__row-title">{item.name}</div><div className="expense-overview__row-sub">{item.transaction_count} {item.transaction_count === 1 ? 'transaction' : 'transactions'}</div></div><strong className="expense-overview__row-amount" data-type="expense">{formatCurrency(item.amount, item.currency)}</strong></div>)}</div> : <div className="expense-overview__empty-mini">Category spending will appear here after you record expenses.</div>}
            </article>

            <article className="expense-overview__card expense-overview__half">
              <div className="expense-overview__card-head"><h2 className="expense-overview__card-title">Account snapshot</h2><button type="button" className="expense-overview__card-action" onClick={() => onNavigate('/expense-manager/accounts')}>Accounts</button></div>
              {data.accounts.length ? <div className="expense-overview__list">{data.accounts.map((item) => <div className="expense-overview__row" key={item.id}><span className="expense-overview__row-icon" aria-hidden="true">{item.icon || '◫'}</span><div className="expense-overview__row-main"><div className="expense-overview__row-title">{item.name}</div><div className="expense-overview__row-sub">{item.type.replace('_', ' ')} · {item.currency}</div></div><strong className="expense-overview__row-amount">{formatCurrency(item.balance, item.currency)}</strong></div>)}</div> : <div className="expense-overview__empty-mini">No accounts have been created yet.</div>}
            </article>

            <article className="expense-overview__card expense-overview__half">
              <div className="expense-overview__card-head"><h2 className="expense-overview__card-title">Recent transactions</h2><button type="button" className="expense-overview__card-action" onClick={() => onNavigate('/expense-manager/transactions')}>View all</button></div>
              {data.recent_transactions.length ? <div className="expense-overview__list">{data.recent_transactions.map((item) => { const sign = item.type === 'income' ? '+' : item.type === 'expense' ? '−' : '↔'; return <div className="expense-overview__row" key={item.id}><span className="expense-overview__row-icon" aria-hidden="true">{item.category_icon || (item.type === 'transfer' ? '↔' : '•')}</span><div className="expense-overview__row-main"><div className="expense-overview__row-title">{item.category_name || (item.type === 'transfer' ? 'Transfer' : 'Uncategorised')}</div><div className="expense-overview__row-sub">{formatDate(item.date)} · {item.display_account || 'Account'}{item.note ? ` · ${item.note}` : ''}</div></div><strong className="expense-overview__row-amount" data-type={item.type}>{sign} {formatCurrency(item.amount, item.currency || primaryCurrency || 'PKR')}</strong></div>; })}</div> : <div className="expense-overview__empty-mini">No transactions in this period.</div>}
            </article>

            <article className="expense-overview__card expense-overview__half">
              <div className="expense-overview__card-head"><h2 className="expense-overview__card-title">Budgets</h2><button type="button" className="expense-overview__card-action" onClick={() => onNavigate('/expense-manager/budgets')}>Budgets</button></div>
              {data.budgets.length ? data.budgets.map((budget) => { const ratio = budget.budget_amount > 0 ? Math.min(1.2, budget.spent / budget.budget_amount) : 0; return <div className="expense-overview__budget" key={budget.id}><div className="expense-overview__budget-head"><span>{budget.category_name}</span><span>{numberFormatter.format(Math.round(ratio * 100))}%</span></div><div className="expense-overview__progress"><span style={{ width: `${Math.min(100, ratio * 100)}%` }} /></div><div className="expense-overview__budget-meta"><span>{numberFormatter.format(budget.spent)} spent</span><span>{numberFormatter.format(budget.budget_amount)} limit</span></div></div>; }) : <div className="expense-overview__empty-mini">No budgets are configured for this period.</div>}
            </article>

            <article className="expense-overview__card expense-overview__wide">
              <div className="expense-overview__card-head"><h2 className="expense-overview__card-title">Financial insight</h2></div>
              <div className="expense-overview__insight">
                {singlePeriod && singlePeriod.income > 0
                  ? `You spent ${Math.round((singlePeriod.expenses / singlePeriod.income) * 100)}% of recorded ${singlePeriod.currency} income during ${monthLabel(anchor)}.`
                  : periods.length > 1
                    ? 'Your selected period contains multiple currencies. Expense Manager keeps those figures separate instead of applying an invented exchange rate.'
                    : 'No income has been recorded for this period yet, so a spending-to-income comparison is not available.'}
              </div>
            </article>
          </>
        )}
      </div>
    </section>
  );
}
