import { navigate } from '../../../app/Router';

const pageStyle = {
  background: 'radial-gradient(circle at 8% 0%, rgba(16,185,129,.14), transparent 30%), radial-gradient(circle at 92% 12%, rgba(14,165,233,.12), transparent 28%)',
};

const cardStyle = {
  padding: 16,
  border: '1px solid rgba(255,255,255,.78)',
  borderRadius: 18,
  background: 'linear-gradient(145deg, rgba(255,255,255,.97), rgba(248,250,252,.9))',
  boxShadow: '0 18px 42px rgba(15,23,42,.10), inset 0 1px 0 rgba(255,255,255,.95)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
};

export function ContractorAccountPage() {
  return (
    <main style={{ ...pageStyle, width: '100%', maxWidth: 760, minHeight: '100%', margin: '0 auto', padding: '18px 12px 104px', boxSizing: 'border-box' }}>
      <header style={{ marginBottom: 14, padding: '2px' }}>
        <div style={{ color: '#059669', fontSize: 10, fontWeight: 900, letterSpacing: '.12em', textTransform: 'uppercase' }}>Contractor Account</div>
        <h1 style={{ margin: '4px 0 0', fontSize: 'clamp(28px, 7vw, 38px)', letterSpacing: '-.045em', lineHeight: 1.05, color: '#111827' }}>Contractor</h1>
        <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 12, lineHeight: 1.45 }}>Your Contractor Personal Dashboard starts here.</p>
      </header>

      <section style={{ ...cardStyle, display: 'grid', gap: 8 }}>
        <span style={{ color: '#059669', fontSize: 10, fontWeight: 900, letterSpacing: '.1em', textTransform: 'uppercase' }}>CONTRACTOR MODE</span>
        <h2 style={{ margin: 0, fontSize: 20, letterSpacing: '-.03em', color: '#172033' }}>Account foundation ready</h2>
        <p style={{ margin: 0, color: '#64748b', fontSize: 12, lineHeight: 1.5 }}>Contractor features will be built here without changing the existing Worker Contract flow.</p>
        <button type="button" onClick={() => navigate('/work/settings')} style={{ marginTop: 5, minHeight: 40, padding: '0 13px', borderRadius: 11, border: '1px solid rgba(5,150,105,.18)', background: 'linear-gradient(145deg,rgba(236,253,245,.98),rgba(240,253,250,.9))', color: '#047857', fontWeight: 850, cursor: 'pointer' }}>← Worker Settings</button>
      </section>
    </main>
  );
}
