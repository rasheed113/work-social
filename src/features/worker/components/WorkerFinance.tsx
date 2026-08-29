export function WorkerFinance() {
  return (
    <main style={{ width: '100%', maxWidth: 760, margin: '0 auto', padding: '24px 14px 112px', boxSizing: 'border-box' }}>
      <header style={{ marginBottom: 18 }}>
        <div style={{ color: '#64748b', fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>Worker Work House</div>
        <h1 style={{ margin: '6px 0 0', fontSize: 'clamp(28px, 7vw, 40px)', letterSpacing: '-.04em' }}>Finance</h1>
      </header>
      <section aria-labelledby="worker-finance-coming" style={{ padding: 20, border: '1px solid rgba(99,102,241,.14)', borderRadius: 18, background: 'rgba(255,255,255,.92)', boxShadow: '0 10px 28px rgba(15,23,42,.07)' }}>
        <h2 id="worker-finance-coming" style={{ margin: 0, fontSize: 18 }}>Finance is reserved for the next Worker phase</h2>
        <p style={{ margin: '8px 0 0', color: '#64748b', lineHeight: 1.55 }}>
          This route is the Worker Finance boundary only. No balances, payments, transactions, calculations, persistence, or mock financial data are shown in Phase 3B.
        </p>
      </section>
    </main>
  );
}
