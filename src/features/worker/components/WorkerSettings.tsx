import { navigate } from '../../../app/Router';

interface WorkerSettingsProps {
  teamJoining?: boolean;
}

const cardStyle = {
  padding: 18,
  border: '1px solid rgba(99,102,241,.14)',
  borderRadius: 18,
  background: 'rgba(255,255,255,.92)',
  boxShadow: '0 10px 28px rgba(15,23,42,.07)',
};

export function WorkerSettings({ teamJoining = false }: WorkerSettingsProps) {
  if (teamJoining) {
    return (
      <main style={{ width: '100%', maxWidth: 760, margin: '0 auto', padding: '24px 14px 112px', boxSizing: 'border-box' }}>
        <button type="button" onClick={() => navigate('/work/settings')} style={{ minHeight: 40, padding: '0 12px', borderRadius: 11, fontWeight: 800, cursor: 'pointer' }}>
          ← Settings
        </button>
        <section aria-labelledby="team-joining-title" style={{ ...cardStyle, marginTop: 16 }}>
          <h1 id="team-joining-title" style={{ margin: 0, fontSize: 'clamp(26px, 7vw, 38px)', letterSpacing: '-.035em' }}>Team Joining</h1>
          <p style={{ margin: '10px 0 0', color: '#64748b', lineHeight: 1.55 }}>
            Team Joining is a Worker navigation boundary. Joining requests, invitations, memberships, and team data are not implemented in this phase.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main style={{ width: '100%', maxWidth: 760, margin: '0 auto', padding: '24px 14px 112px', boxSizing: 'border-box' }}>
      <header style={{ marginBottom: 18 }}>
        <div style={{ color: '#64748b', fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>Worker Work House</div>
        <h1 style={{ margin: '6px 0 0', fontSize: 'clamp(28px, 7vw, 40px)', letterSpacing: '-.04em' }}>Settings</h1>
        <p style={{ margin: '8px 0 0', color: '#64748b', lineHeight: 1.55 }}>Worker-specific settings and future Work configuration.</p>
      </header>

      <section aria-label="Worker settings options" style={{ display: 'grid', gap: 12 }}>
        <button type="button" onClick={() => navigate('/work/identity')} style={{ ...cardStyle, textAlign: 'left', cursor: 'pointer', font: 'inherit' }}>
          <strong style={{ display: 'block', fontSize: 16 }}>Work Identity</strong>
          <span style={{ display: 'block', marginTop: 5, color: '#64748b', fontSize: 13 }}>Open the existing Worker Identity implementation.</span>
        </button>

        <button type="button" onClick={() => navigate('/work/settings/team-joining')} style={{ ...cardStyle, textAlign: 'left', cursor: 'pointer', font: 'inherit' }}>
          <strong style={{ display: 'block', fontSize: 16 }}>Team Joining</strong>
          <span style={{ display: 'block', marginTop: 5, color: '#64748b', fontSize: 13 }}>Entry point only. Team joining functionality is not implemented yet.</span>
        </button>
      </section>
    </main>
  );
}
