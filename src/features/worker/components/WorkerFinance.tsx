import { navigate } from '../../../app/Router';

export function WorkerFinance() {
  return (
    <main
      style={{
        width: '100%',
        maxWidth: 760,
        margin: '0 auto',
        padding: '24px 14px 112px',
        boxSizing: 'border-box',
      }}
    >
      <header style={{ marginBottom: 18 }}>
        <button
          type="button"
          onClick={() => navigate('/work')}
          style={{
            border: 0,
            padding: 0,
            margin: '0 0 14px',
            background: 'transparent',
            color: '#64748b',
            font: 'inherit',
            fontSize: 13,
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          ← Worker Work House
        </button>
        <div
          style={{
            color: '#64748b',
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: '.08em',
            textTransform: 'uppercase',
          }}
        >
          Worker domain
        </div>
        <h1
          style={{
            margin: '6px 0 0',
            fontSize: 'clamp(28px, 7vw, 40px)',
            letterSpacing: '-.04em',
          }}
        >
          Finance
        </h1>
      </header>

      <section
        aria-labelledby="worker-finance-coming"
        style={{
          padding: 22,
          border: '1px solid rgba(99,102,241,.14)',
          borderRadius: 18,
          background: 'rgba(255,255,255,.92)',
          boxShadow: '0 10px 28px rgba(15,23,42,.07)',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            minHeight: 28,
            padding: '0 10px',
            borderRadius: 999,
            background: 'rgba(99,102,241,.08)',
            color: '#4f46e5',
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: '.06em',
            textTransform: 'uppercase',
          }}
        >
          Next Worker phase
        </div>
        <h2 id="worker-finance-coming" style={{ margin: '14px 0 0', fontSize: 18 }}>
          Finance is reserved for the next Worker phase
        </h2>
        <p style={{ margin: '8px 0 0', color: '#64748b', lineHeight: 1.55 }}>
          This route is the Worker Finance boundary only. No balances, payments, transactions, calculations, persistence, or mock financial data are shown in Phase 3B.
        </p>
        <button
          type="button"
          onClick={() => navigate('/work')}
          style={{
            marginTop: 18,
            minHeight: 44,
            padding: '0 16px',
            border: '1px solid rgba(99,102,241,.22)',
            borderRadius: 12,
            background: '#fff',
            color: '#3730a3',
            font: 'inherit',
            fontSize: 14,
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          Back to Work House
        </button>
      </section>
    </main>
  );
}
