import { navigate } from '../../../app/Router';

const cardStyle = {
  padding: 18,
  border: '1px solid rgba(99,102,241,.14)',
  borderRadius: 18,
  background: 'rgba(255,255,255,.92)',
  boxShadow: '0 10px 28px rgba(15,23,42,.07)',
};

export function WorkerHome() {
  return (
    <main style={{ width: '100%', maxWidth: 900, margin: '0 auto', padding: '24px 14px 112px', boxSizing: 'border-box' }}>
      <header style={{ marginBottom: 20 }}>
        <div style={{ color: '#64748b', fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>
          Worker Work House
        </div>
        <h1 style={{ margin: '6px 0 0', fontSize: 'clamp(28px, 7vw, 42px)', letterSpacing: '-.04em' }}>Home</h1>
        <p style={{ margin: '8px 0 0', color: '#64748b', lineHeight: 1.55 }}>
          Your Worker workspace. Work records, teams, finance, and diary will be added through their own domains in later phases.
        </p>
      </header>

      <section aria-labelledby="worker-home-identity" style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h2 id="worker-home-identity" style={{ margin: 0, fontSize: 17 }}>Worker Identity</h2>
          <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 13 }}>Manage your existing Work Identity profile.</p>
        </div>
        <button type="button" onClick={() => navigate('/work/identity')} style={{ minHeight: 42, padding: '0 14px', borderRadius: 12, fontWeight: 800, cursor: 'pointer' }}>
          Open
        </button>
      </section>

      <section aria-labelledby="worker-home-work" style={{ ...cardStyle, marginTop: 12 }}>
        <h2 id="worker-home-work" style={{ margin: 0, fontSize: 17 }}>My Work</h2>
        <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 13 }}>Work Entries are not implemented in this phase.</p>
      </section>

      <section aria-labelledby="worker-home-team" style={{ ...cardStyle, marginTop: 12 }}>
        <h2 id="worker-home-team" style={{ margin: 0, fontSize: 17 }}>Team Work</h2>
        <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 13 }}>Approved team work will be available in a future Worker phase.</p>
      </section>

      <section aria-labelledby="worker-home-finance" style={{ ...cardStyle, marginTop: 12 }}>
        <h2 id="worker-home-finance" style={{ margin: 0, fontSize: 17 }}>Finance</h2>
        <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 13 }}>Finance is reserved for its dedicated Worker domain.</p>
        <button type="button" onClick={() => navigate('/work/finance')} style={{ marginTop: 12, minHeight: 40, padding: '0 13px', borderRadius: 11, fontWeight: 800, cursor: 'pointer' }}>
          Open Finance
        </button>
      </section>

      <section aria-labelledby="worker-home-diary" style={{ ...cardStyle, marginTop: 12 }}>
        <h2 id="worker-home-diary" style={{ margin: 0, fontSize: 17 }}>Personal Diary</h2>
        <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 13 }}>Personal Diary is a separate future Worker feature.</p>
      </section>
    </main>
  );
}
