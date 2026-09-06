import type { ExpenseOverviewData, ExpenseOverviewPeriodCurrency } from '../domain/overview';

interface ExpenseFinancialIntelligenceCardsProps {
  data: ExpenseOverviewData;
  periodLabel: string;
}

const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

function formatCurrency(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${numberFormatter.format(amount)}`;
  }
}

function periodRows(data: ExpenseOverviewData) {
  return data.period_currencies;
}

function singlePeriod(data: ExpenseOverviewData) {
  const rows = periodRows(data);
  return rows.length === 1 ? rows[0] : null;
}

function Ring({ value, label, tone, empty = false }: { value: number; label: string; tone: 'positive' | 'negative' | 'neutral'; empty?: boolean }) {
  const size = 132;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const visiblePercent = empty ? 0 : Math.min(Math.max(value, 0), 100);
  const dash = (visiblePercent / 100) * circumference;

  return (
    <div className={`expense-financial-ring expense-financial-ring--${tone}${empty ? ' expense-financial-ring--empty' : ''}`}>
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="expense-financial-ring__svg">
        <circle className="expense-financial-ring__track" cx={size / 2} cy={size / 2} r={radius} />
        {!empty && <circle className="expense-financial-ring__value" cx={size / 2} cy={size / 2} r={radius} strokeDasharray={`${dash} ${circumference - dash}`} />}
      </svg>
      <div className="expense-financial-ring__center">
        <strong>{label}</strong>
      </div>
    </div>
  );
}

function currencyRows(data: ExpenseOverviewData): ExpenseOverviewPeriodCurrency[] {
  return periodRows(data);
}

export function FinancialInsightCard({ data, periodLabel }: ExpenseFinancialIntelligenceCardsProps) {
  const rows = currencyRows(data);
  const period = singlePeriod(data);

  return (
    <article className="expense-financial-intelligence__card expense-financial-intelligence__card--insight" aria-labelledby="expense-financial-insight-title">
      <style>{`
        .expense-financial-intelligence{display:contents}
        .expense-financial-intelligence__card{min-width:0;border:1px solid rgba(148,163,184,.17);border-radius:20px;background:linear-gradient(145deg,rgba(255,255,255,.98),rgba(248,250,252,.92));box-shadow:0 12px 28px rgba(15,23,42,.06),inset 0 1px 0 rgba(255,255,255,.95);padding:16px;box-sizing:border-box}
        .expense-financial-intelligence__card--insight{grid-column:span 12}
        .expense-financial-intelligence__card--deterministic{grid-column:span 12;background:linear-gradient(145deg,rgba(248,250,252,.98),rgba(255,255,255,.96))}
        .expense-financial-intelligence__head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin:0 0 14px}
        .expense-financial-intelligence__eyebrow{margin:0 0 4px;color:#2563eb;font-size:9px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}
        .expense-financial-intelligence__title{margin:0;color:#172033;font-size:15px;font-weight:950;letter-spacing:-.025em}
        .expense-financial-intelligence__period{flex:0 0 auto;padding:5px 8px;border:1px solid rgba(148,163,184,.16);border-radius:999px;color:#64748b;background:#fff;font-size:9px;font-weight:850}
        .expense-financial-intelligence__body{display:grid;grid-template-columns:150px minmax(0,1fr);align-items:center;gap:18px;min-width:0}
        .expense-financial-intelligence__ring-wrap{display:grid;place-items:center}
        .expense-financial-ring{position:relative;width:132px;height:132px}
        .expense-financial-ring__svg{display:block;width:100%;height:100%;transform:rotate(-90deg)}
        .expense-financial-ring__track,.expense-financial-ring__value{fill:none;stroke-width:10}
        .expense-financial-ring__track{stroke:#e2e8f0}
        .expense-financial-ring__value{stroke:#2563eb;stroke-linecap:round;transition:stroke-dasharray .25s ease}
        .expense-financial-ring--negative .expense-financial-ring__value{stroke:#e11d48}
        .expense-financial-ring--positive .expense-financial-ring__value{stroke:#059669}
        .expense-financial-ring--neutral .expense-financial-ring__value{stroke:#64748b}
        .expense-financial-ring--empty .expense-financial-ring__track{stroke:#e2e8f0}
        .expense-financial-ring__center{position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:25px}
        .expense-financial-ring__center strong{color:#0f172a;font-size:18px;line-height:1.05;font-weight:950;letter-spacing:-.04em}
        .expense-financial-intelligence__copy{min-width:0}
        .expense-financial-intelligence__status{margin:0;color:#0f172a;font-size:16px;line-height:1.15;font-weight:950;letter-spacing:-.025em}
        .expense-financial-intelligence__sub{margin:7px 0 0;color:#64748b;font-size:10px;line-height:1.5;font-weight:650}
        .expense-financial-intelligence__metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:13px}
        .expense-financial-intelligence__metric{padding:9px 10px;border:1px solid rgba(148,163,184,.13);border-radius:12px;background:rgba(255,255,255,.78);min-width:0}
        .expense-financial-intelligence__metric-label{display:block;color:#94a3b8;font-size:8px;font-weight:850;text-transform:uppercase;letter-spacing:.08em}
        .expense-financial-intelligence__metric-value{display:block;margin-top:4px;color:#172033;font-size:11px;font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .expense-financial-intelligence__metric-value--income{color:#047857}.expense-financial-intelligence__metric-value--expense{color:#be123c}
        .expense-financial-intelligence__multi{display:grid;gap:8px;margin-top:13px}
        .expense-financial-intelligence__currency-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 10px;border:1px solid rgba(148,163,184,.13);border-radius:12px;background:rgba(255,255,255,.78)}
        .expense-financial-intelligence__currency-name{color:#334155;font-size:9px;font-weight:900}.expense-financial-intelligence__currency-value{color:#0f172a;font-size:10px;font-weight:900;white-space:nowrap}
        .expense-financial-intelligence__neutral{display:grid;gap:4px;color:#64748b;font-size:10px;line-height:1.5;font-weight:650}
        @media(min-width:700px){.expense-financial-intelligence__card--deterministic{grid-column:span 12}}
        @media(max-width:520px){.expense-financial-intelligence__body{grid-template-columns:1fr;gap:12px}.expense-financial-intelligence__ring-wrap{justify-content:start}.expense-financial-intelligence__period{font-size:8px}.expense-financial-intelligence__metrics{grid-template-columns:1fr 1fr}}
        @media(prefers-reduced-motion:reduce){.expense-financial-ring__value{transition:none}}
      `}</style>
      <div className="expense-financial-intelligence__head">
        <div><p className="expense-financial-intelligence__eyebrow">Financial insight</p><h2 id="expense-financial-insight-title" className="expense-financial-intelligence__title">Spending / income</h2></div>
        <span className="expense-financial-intelligence__period">{periodLabel}</span>
      </div>

      {period ? (
        <div className="expense-financial-intelligence__body">
          <div className="expense-financial-intelligence__ring-wrap">
            <Ring
              value={period.income > 0 ? (period.expenses / period.income) * 100 : 0}
              label={period.income > 0 ? `${Math.round((period.expenses / period.income) * 100)}%` : 'No data'}
              tone={period.income > 0 && period.expenses > period.income ? 'negative' : 'positive'}
              empty={period.income <= 0}
            />
          </div>
          <div className="expense-financial-intelligence__copy">
            <p className="expense-financial-intelligence__status">{period.income > 0 ? period.expenses > period.income ? 'Spending exceeded recorded income' : 'Spending within recorded income' : 'No income recorded'}</p>
            <p className="expense-financial-intelligence__sub">{period.income > 0 ? `${Math.round((period.expenses / period.income) * 100)}% of recorded ${period.currency} income was spent during ${periodLabel}.` : `There is no income transaction to compare with spending during ${periodLabel}.`}</p>
            <div className="expense-financial-intelligence__metrics">
              <div className="expense-financial-intelligence__metric"><span className="expense-financial-intelligence__metric-label">Income</span><strong className="expense-financial-intelligence__metric-value expense-financial-intelligence__metric-value--income">{formatCurrency(period.income, period.currency)}</strong></div>
              <div className="expense-financial-intelligence__metric"><span className="expense-financial-intelligence__metric-label">Spending</span><strong className="expense-financial-intelligence__metric-value expense-financial-intelligence__metric-value--expense">{formatCurrency(period.expenses, period.currency)}</strong></div>
            </div>
          </div>
        </div>
      ) : rows.length > 1 ? (
        <div className="expense-financial-intelligence__multi">
          <div className="expense-financial-intelligence__neutral"><strong>Multiple currencies</strong><span>A single spending-to-income percentage would be misleading, so each currency remains separate.</span></div>
          {rows.map((row) => <div className="expense-financial-intelligence__currency-row" key={row.currency}><span className="expense-financial-intelligence__currency-name">{row.currency}</span><span className="expense-financial-intelligence__currency-value">{formatCurrency(row.expenses, row.currency)} spent / {formatCurrency(row.income, row.currency)} income</span></div>)}
        </div>
      ) : (
        <div className="expense-financial-intelligence__body">
          <div className="expense-financial-intelligence__ring-wrap"><Ring value={0} label="No data" tone="neutral" empty /></div>
          <div className="expense-financial-intelligence__neutral"><strong>No income recorded</strong><span>No persisted income transaction exists for this period, so no percentage is calculated.</span></div>
        </div>
      )}
    </article>
  );
}

export function DeterministicIntelligenceCard({ data, periodLabel }: ExpenseFinancialIntelligenceCardsProps) {
  const rows = currencyRows(data);
  const period = singlePeriod(data);
  const cashFlow = period ? period.income - period.expenses : null;
  const status = cashFlow === null ? 'Multiple currencies' : cashFlow > 0 ? 'Cash-flow positive' : cashFlow < 0 ? 'Cash-flow negative' : 'Cash-flow neutral';
  const tone = cashFlow === null ? 'neutral' : cashFlow > 0 ? 'positive' : cashFlow < 0 ? 'negative' : 'neutral';
  const icon = cashFlow === null ? '↔' : cashFlow > 0 ? '✓' : cashFlow < 0 ? '!' : '—';

  return (
    <article className="expense-financial-intelligence__card expense-financial-intelligence__card--deterministic" aria-labelledby="expense-deterministic-title">
      <div className="expense-financial-intelligence__head">
        <div><p className="expense-financial-intelligence__eyebrow">Deterministic intelligence</p><h2 id="expense-deterministic-title" className="expense-financial-intelligence__title">Financial health</h2></div>
        <span className="expense-financial-intelligence__period">{periodLabel}</span>
      </div>
      <div className="expense-financial-intelligence__body">
        <div className="expense-financial-intelligence__ring-wrap">
          <div className={`expense-financial-ring expense-financial-ring--${tone}`} role="img" aria-label={status}>
            <div className="expense-financial-ring__center"><strong aria-hidden="true">{icon}</strong></div>
          </div>
        </div>
        <div className="expense-financial-intelligence__copy">
          <p className="expense-financial-intelligence__status">{status}</p>
          {period ? (
            <>
              <p className="expense-financial-intelligence__sub">{cashFlow! > 0 ? 'Income is greater than spending for the selected period.' : cashFlow! < 0 ? 'Spending is greater than income for the selected period.' : 'Income and spending are exactly balanced for the selected period.'}</p>
              <div className="expense-financial-intelligence__metrics">
                <div className="expense-financial-intelligence__metric"><span className="expense-financial-intelligence__metric-label">Cash flow</span><strong className="expense-financial-intelligence__metric-value">{cashFlow! > 0 ? '+' : ''}{formatCurrency(cashFlow!, period.currency)}</strong></div>
                <div className="expense-financial-intelligence__metric"><span className="expense-financial-intelligence__metric-label">Currency</span><strong className="expense-financial-intelligence__metric-value">{period.currency}</strong></div>
              </div>
            </>
          ) : rows.length > 1 ? (
            <div className="expense-financial-intelligence__neutral"><strong>Cash flow is kept separate by currency.</strong><span>A combined cash-flow amount would require an exchange rate, so no invented conversion is applied.</span></div>
          ) : (
            <div className="expense-financial-intelligence__neutral"><strong>No financial activity to compare.</strong><span>Cash flow is neutral until persisted income or expense transactions are recorded for this period.</span></div>
          )}
        </div>
      </div>
    </article>
  );
}
