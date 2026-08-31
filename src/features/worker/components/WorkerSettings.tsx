import { useEffect, useState } from 'react';
import { navigate } from '../../../app/Router';
import { useWorkerProfile } from '../hooks/useWorkerProfile';

interface WorkerSettingsProps {
  profileId?: string;
  teamJoining?: boolean;
}

type PublicProfile = {
  display_name: string;
  username: string;
  bio: string | null;
  avatar_url: string | null;
  location: string | null;
  website: string | null;
};

const cardStyle = {
  padding: 18,
  border: '1px solid rgba(99,102,241,.14)',
  borderRadius: 18,
  background: 'rgba(255,255,255,.92)',
  boxShadow: '0 10px 28px rgba(15,23,42,.07)',
};

const actionButtonStyle = {
  ...cardStyle,
  width: '100%',
  textAlign: 'left' as const,
  cursor: 'pointer',
  font: 'inherit',
};

function initials(name: string) {
  const value = name.trim();
  if (!value) return 'W';
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
}

function publicWebsiteLabel(website: string) {
  return website.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

export function WorkerSettings({ profileId, teamJoining = false }: WorkerSettingsProps) {
  const [copied, setCopied] = useState(false);
  const { workerProfile, profile, loading, error, reload } = useWorkerProfile(profileId ?? '');

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

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

  if (!profileId || loading) {
    return (
      <main style={{ width: '100%', maxWidth: 760, margin: '0 auto', padding: '24px 14px 112px', boxSizing: 'border-box' }}>
        <header style={{ marginBottom: 18 }}>
          <div style={{ color: '#64748b', fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>Worker Work House</div>
          <h1 style={{ margin: '6px 0 0', fontSize: 'clamp(28px, 7vw, 40px)', letterSpacing: '-.04em' }}>Settings</h1>
        </header>
        <section aria-live="polite" style={{ ...cardStyle, display: 'grid', gap: 10 }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#e2e8f0' }} aria-hidden="true" />
          <strong>Loading Worker profile…</strong>
          <span style={{ color: '#64748b', fontSize: 13 }}>Loading your real profile and Worker identity.</span>
        </section>
      </main>
    );
  }

  const publicProfile = profile as PublicProfile | null;
  const workerId = workerProfile?.work_id ?? '';

  const copyWorkerId = async () => {
    if (!workerId || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(workerId);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main style={{ width: '100%', maxWidth: 760, margin: '0 auto', padding: '24px 14px 112px', boxSizing: 'border-box' }}>
      <header style={{ marginBottom: 18 }}>
        <div style={{ color: '#64748b', fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>Worker Work House</div>
        <h1 style={{ margin: '6px 0 0', fontSize: 'clamp(28px, 7vw, 40px)', letterSpacing: '-.04em' }}>Settings</h1>
        <p style={{ margin: '8px 0 0', color: '#64748b', lineHeight: 1.55 }}>Your Worker profile and Work House settings.</p>
      </header>

      {error ? (
        <section role="alert" style={{ ...cardStyle, marginBottom: 18, borderColor: 'rgba(220,38,38,.22)' }}>
          <strong>Unable to load your Worker profile.</strong>
          <p style={{ margin: '7px 0 12px', color: '#64748b', lineHeight: 1.5 }}>{error}</p>
          <button type="button" onClick={() => void reload()} style={{ minHeight: 42, padding: '0 14px', borderRadius: 11, fontWeight: 800, cursor: 'pointer' }}>
            Try again
          </button>
        </section>
      ) : (
        <section aria-labelledby="worker-profile-title" style={{ ...cardStyle, marginBottom: 22, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
            {publicProfile?.avatar_url ? (
              <img
                src={publicProfile.avatar_url}
                alt={`${publicProfile.display_name || 'Worker'} profile picture`}
                width={82}
                height={82}
                style={{ flex: '0 0 82px', borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(99,102,241,.12)' }}
              />
            ) : (
              <div
                aria-hidden="true"
                style={{ flex: '0 0 82px', width: 82, height: 82, borderRadius: '50%', display: 'grid', placeItems: 'center', background: '#e2e8f0', color: '#334155', fontSize: 27, fontWeight: 900, border: '3px solid rgba(99,102,241,.12)' }}
              >
                {initials(publicProfile?.display_name ?? '')}
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ color: '#64748b', fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>Worker Profile</div>
              <h2 id="worker-profile-title" style={{ margin: '4px 0 0', fontSize: 'clamp(22px, 6vw, 30px)', letterSpacing: '-.035em', overflowWrap: 'anywhere' }}>
                {publicProfile?.display_name || 'Your profile'}
              </h2>
              {publicProfile?.username && (
                <div style={{ marginTop: 4, color: '#64748b', fontSize: 14 }}>@{publicProfile.username}</div>
              )}
            </div>
          </div>

          {(publicProfile?.bio || publicProfile?.location || publicProfile?.website) && (
            <div style={{ display: 'grid', gap: 8, marginTop: 18, paddingTop: 16, borderTop: '1px solid rgba(148,163,184,.18)' }}>
              {publicProfile.bio && <p style={{ margin: 0, color: '#334155', lineHeight: 1.55, overflowWrap: 'anywhere' }}>{publicProfile.bio}</p>}
              {publicProfile.location && <div style={{ color: '#64748b', fontSize: 13 }}>📍 {publicProfile.location}</div>}
              {publicProfile.website && (
                <a href={publicProfile.website} target="_blank" rel="noreferrer" style={{ color: '#4f46e5', fontSize: 13, fontWeight: 700, overflowWrap: 'anywhere' }}>
                  {publicWebsiteLabel(publicProfile.website)}
                </a>
              )}
            </div>
          )}

          <div style={{ marginTop: 18, padding: 14, borderRadius: 14, background: 'rgba(99,102,241,.055)', border: '1px solid rgba(99,102,241,.1)' }}>
            <div style={{ color: '#64748b', fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>Worker ID</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
              <code style={{ minWidth: 0, flex: 1, fontSize: 14, fontWeight: 800, overflowWrap: 'anywhere' }}>{workerId || 'Worker ID unavailable'}</code>
              {workerId && (
                <button type="button" onClick={() => void copyWorkerId()} style={{ flex: '0 0 auto', minHeight: 36, padding: '0 10px', borderRadius: 9, fontWeight: 800, cursor: 'pointer' }}>
                  {copied ? 'Copied' : 'Copy'}
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      <section aria-labelledby="worker-settings-section-title" style={{ display: 'grid', gap: 10 }}>
        <h2 id="worker-settings-section-title" style={{ margin: '0 0 2px', fontSize: 13, letterSpacing: '.08em', textTransform: 'uppercase', color: '#64748b' }}>Worker</h2>

        <button type="button" onClick={() => navigate('/work/identity')} style={actionButtonStyle}>
          <strong style={{ display: 'block', fontSize: 16 }}>Work Identity</strong>
          <span style={{ display: 'block', marginTop: 5, color: '#64748b', fontSize: 13, lineHeight: 1.45 }}>Manage the existing Work Identity information and skills.</span>
          <span aria-hidden="true" style={{ display: 'block', marginTop: 10, fontWeight: 900 }}>Open →</span>
        </button>

        <button type="button" onClick={() => navigate('/work/settings/team-joining')} style={actionButtonStyle}>
          <strong style={{ display: 'block', fontSize: 16 }}>Team Joining</strong>
          <span style={{ display: 'block', marginTop: 5, color: '#64748b', fontSize: 13, lineHeight: 1.45 }}>Team joining is reserved as the existing entry point.</span>
          <span aria-hidden="true" style={{ display: 'block', marginTop: 10, fontWeight: 900 }}>Open →</span>
        </button>
      </section>
    </main>
  );
}
