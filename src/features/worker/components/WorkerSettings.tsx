import { useEffect, useState } from 'react';
import { navigate } from '../../../app/Router';
import { setWorkerType } from '../api/salary';
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

const pageStyle = { background: 'radial-gradient(circle at 8% 0%, rgba(99,102,241,.16), transparent 30%), radial-gradient(circle at 92% 12%, rgba(14,165,233,.12), transparent 28%)' };
const cardStyle = { padding: 13, border: '1px solid rgba(255,255,255,.78)', borderRadius: 16, background: 'linear-gradient(145deg, rgba(255,255,255,.96), rgba(248,250,252,.88))', boxShadow: '0 18px 42px rgba(15,23,42,.10), inset 0 1px 0 rgba(255,255,255,.95), inset 0 -1px 0 rgba(99,102,241,.06)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' };
const actionButtonStyle = { ...cardStyle, width: '100%', textAlign: 'left' as const, cursor: 'pointer', font: 'inherit', transition: 'transform .18s ease, box-shadow .18s ease', borderColor: 'rgba(99,102,241,.16)' };
const eyebrowStyle = { color: '#6366f1', fontSize: 10, fontWeight: 900, letterSpacing: '.12em', textTransform: 'uppercase' as const };
const mutedTextStyle = { color: '#64748b', lineHeight: 1.45 };

function initials(name: string) {
  const value = name.trim();
  if (!value) return 'W';
  return value.split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase();
}
function publicWebsiteLabel(website: string) { return website.replace(/^https?:\/\//, '').replace(/\/$/, ''); }

export function WorkerSettings({ profileId, teamJoining = false }: WorkerSettingsProps) {
  const [copied, setCopied] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState('');
  const [workerTypeOpen, setWorkerTypeOpen] = useState(false);
  const { workerProfile, profile, loading, error, reload } = useWorkerProfile(profileId ?? '');

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const shell = (children: React.ReactNode) => <main style={{ ...pageStyle, width: '100%', maxWidth: 760, margin: '0 auto', padding: '18px 12px 104px', boxSizing: 'border-box', minHeight: '100%' }}><header style={{ marginBottom: 14, padding: '2px 2px' }}><div style={eyebrowStyle}>Worker Work House</div><h1 style={{ margin: '4px 0 0', fontSize: 'clamp(28px, 7vw, 38px)', letterSpacing: '-.045em', lineHeight: 1.05, color: '#111827', textShadow: '0 3px 18px rgba(79,70,229,.10)' }}>Settings</h1><p style={{ margin: '6px 0 0', ...mutedTextStyle, fontSize: 12 }}>Control your Worker identity, type and Work House access.</p></header>{children}</main>;

  if (teamJoining) return shell(<button type="button" onClick={() => navigate('/work/settings')} style={{ minHeight: 38, padding: '0 12px', borderRadius: 10, fontWeight: 850, cursor: 'pointer', border: '1px solid rgba(99,102,241,.18)', background: 'rgba(255,255,255,.88)', color: '#3730a3', boxShadow: '0 10px 24px rgba(15,23,42,.08)' }}>← Settings</button>);

  if (loading) return shell(<section aria-live="polite" style={{ ...cardStyle, display: 'grid', gap: 8 }}><div aria-hidden="true" style={{ width: 58, height: 58, borderRadius: '50%', background: 'linear-gradient(145deg,#e0e7ff,#e2e8f0)', boxShadow: '0 10px 26px rgba(99,102,241,.16), inset 0 2px 4px rgba(255,255,255,.9)' }} /><strong style={{ color: '#172033' }}>Loading Worker profile…</strong><span style={{ ...mutedTextStyle, fontSize: 12 }}>Loading your real profile and Worker identity.</span></section>);

  if (error || !workerProfile || !profile) return shell(<section role="alert" style={{ ...cardStyle, borderColor: 'rgba(220,38,38,.22)', boxShadow: '0 18px 42px rgba(127,29,29,.08)' }}><strong style={{ color: '#991b1b' }}>Unable to load Worker profile</strong><p style={{ margin: '6px 0 10px', ...mutedTextStyle, fontSize: 12 }}>{error ?? 'The real Worker profile data could not be resolved.'}</p><button type="button" onClick={() => void reload()} style={{ minHeight: 38, padding: '0 12px', borderRadius: 10, fontWeight: 800, cursor: 'pointer' }}>Retry</button></section>);

  const publicProfile = profile as PublicProfile;
  const workerId = workerProfile.work_id;
  const selectedSkills = workerProfile.skills ?? [];
  const isSalaryPerson = workerProfile.worker_type === 'salary_person';
  const copyWorkerId = async () => { if (!navigator.clipboard) return; try { await navigator.clipboard.writeText(workerId); setCopied(true); } catch { setCopied(false); } };
  const changeWorkerType = async (value: 'salary_person' | 'contract') => {
    if (value === workerProfile.worker_type) { setWorkerTypeOpen(false); return; }
    setSwitchError(''); setSwitching(true);
    const { error: updateError } = await setWorkerType(workerProfile.id, value);
    setSwitching(false);
    if (updateError) { setSwitchError(updateError.message); return; }
    setWorkerTypeOpen(false);
    await reload();
  };
  const identityAction = () => navigate(isSalaryPerson ? '/work/finance?setup=1' : '/work/identity');
  const identityTitle = isSalaryPerson ? 'Salary Slip' : 'Work Identity';
  const identityDescription = isSalaryPerson ? 'View and edit your Salary Person salary setup and salary records.' : 'Manage the existing Work Identity information and skills.';
  const identityActionLabel = isSalaryPerson ? 'View & Edit Salary →' : 'View & Edit Work Identity →';

  return shell(<>
    <p style={{ margin: '-3px 0 12px', color: '#475569', lineHeight: 1.45, fontSize: 12 }}>A premium control center for your Worker profile.</p>

    <section aria-labelledby="worker-profile-title" style={{ ...cardStyle, marginBottom: 12, padding: 14, position: 'relative', overflow: 'hidden' }}>
      <div aria-hidden="true" style={{ position: 'absolute', width: 150, height: 150, borderRadius: '50%', right: -75, top: -80, background: 'rgba(99,102,241,.10)', filter: 'blur(2px)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, position: 'relative' }}>
        {publicProfile.avatar_url ? <img src={publicProfile.avatar_url} alt={`${publicProfile.display_name || 'Worker'} profile picture`} width={64} height={64} style={{ flex: '0 0 64px', borderRadius: '20px', objectFit: 'cover', border: '2px solid rgba(255,255,255,.9)', boxShadow: '0 12px 28px rgba(15,23,42,.16), 0 0 0 3px rgba(99,102,241,.08)' }} /> : <div aria-hidden="true" style={{ flex: '0 0 64px', width: 64, height: 64, borderRadius: '20px', display: 'grid', placeItems: 'center', background: 'linear-gradient(145deg,#eef2ff,#dbeafe)', color: '#3730a3', fontSize: 22, fontWeight: 950, border: '2px solid rgba(255,255,255,.95)', boxShadow: '0 12px 28px rgba(79,70,229,.18), inset 0 2px 4px rgba(255,255,255,.9)' }}>{initials(publicProfile.display_name)}</div>}
        <div style={{ minWidth: 0 }}><div style={eyebrowStyle}>Worker Profile</div><h2 id="worker-profile-title" style={{ margin: '3px 0 0', fontSize: 'clamp(20px, 6vw, 27px)', letterSpacing: '-.04em', overflowWrap: 'anywhere', color: '#111827' }}>{publicProfile.display_name || 'Your profile'}</h2>{publicProfile.username && <div style={{ marginTop: 2, color: '#64748b', fontSize: 12, fontWeight: 650 }}>@{publicProfile.username}</div>}</div>
      </div>
      {(publicProfile.bio || publicProfile.location || publicProfile.website) && <div style={{ display: 'grid', gap: 6, marginTop: 12, paddingTop: 11, borderTop: '1px solid rgba(148,163,184,.16)' }}>{publicProfile.bio && <p style={{ margin: 0, color: '#334155', lineHeight: 1.45, fontSize: 12, overflowWrap: 'anywhere' }}>{publicProfile.bio}</p>}{publicProfile.location && <div style={{ color: '#64748b', fontSize: 11 }}>📍 {publicProfile.location}</div>}{publicProfile.website && <a href={publicProfile.website} target="_blank" rel="noreferrer" style={{ color: '#4f46e5', fontSize: 11, fontWeight: 800, overflowWrap: 'anywhere' }}>{publicWebsiteLabel(publicProfile.website)}</a>}</div>}
      <div style={{ marginTop: 12, padding: 10, borderRadius: 12, background: 'linear-gradient(145deg,rgba(238,242,255,.88),rgba(239,246,255,.7))', border: '1px solid rgba(99,102,241,.12)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.9), 0 8px 20px rgba(99,102,241,.06)' }}><div style={eyebrowStyle}>Worker ID</div><div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}><code style={{ minWidth: 0, flex: 1, fontSize: 11, fontWeight: 850, color: '#1e293b', overflowWrap: 'anywhere' }}>{workerId}</code><button type="button" onClick={() => void copyWorkerId()} style={{ flex: '0 0 auto', minHeight: 31, padding: '0 10px', borderRadius: 9, fontWeight: 850, cursor: 'pointer', fontSize: 11, border: '1px solid rgba(99,102,241,.16)', background: '#fff', color: copied ? '#166534' : '#3730a3', boxShadow: '0 6px 14px rgba(15,23,42,.08)' }}>{copied ? 'Copied ✓' : 'Copy'}</button></div></div>
      <div style={{ marginTop: 9, padding: 10, borderRadius: 12, background: 'rgba(248,250,252,.78)', border: '1px solid rgba(148,163,184,.17)', boxShadow: 'inset 0 1px 2px rgba(15,23,42,.025)' }}><div style={eyebrowStyle}>Selected Skills</div>{selectedSkills.length > 0 ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 7 }}>{selectedSkills.map((skill) => <span key={skill} style={{ borderRadius: 999, padding: '5px 9px', background: 'linear-gradient(145deg,#fff,#f1f5f9)', border: '1px solid rgba(99,102,241,.14)', color: '#334155', fontSize: 10.5, fontWeight: 800, boxShadow: '0 4px 10px rgba(15,23,42,.06)' }}>{skill}</span>)}</div> : <div style={{ marginTop: 5, color: '#94a3b8', fontSize: 11 }}>No skills selected yet.</div>}</div>
    </section>

    <section aria-labelledby="worker-settings-section-title" style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}><h2 id="worker-settings-section-title" style={{ margin: 0, fontSize: 10, letterSpacing: '.13em', textTransform: 'uppercase', color: '#64748b', fontWeight: 950 }}>Worker Controls</h2><span style={{ fontSize: 9, color: '#94a3b8', fontWeight: 800 }}>SECURE SETTINGS</span></div>

      <section style={{ ...cardStyle, padding: 10, borderRadius: 13, background: 'linear-gradient(145deg,rgba(255,255,255,.97),rgba(238,242,255,.86))' }} aria-labelledby="worker-type-title">
        <button type="button" onClick={() => { setSwitchError(''); setWorkerTypeOpen(true); }} disabled={switching} aria-haspopup="dialog" aria-expanded={workerTypeOpen} style={{ width: '100%', border: 0, padding: 0, background: 'transparent', textAlign: 'left', cursor: switching ? 'wait' : 'pointer', font: 'inherit' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}><div><h2 id="worker-type-title" style={{ margin: 0, fontSize: 14, color: '#172033', letterSpacing: '-.015em' }}>Worker Type</h2><p style={{ margin: '2px 0 0', color: '#64748b', fontSize: 10.5, lineHeight: 1.35 }}>Tap to choose how your Work House tracks earnings.</p></div><span style={{ flex: '0 0 auto', padding: '4px 7px', borderRadius: 999, fontSize: 8.5, fontWeight: 950, letterSpacing: '.07em', color: isSalaryPerson ? '#4338ca' : '#475569', background: isSalaryPerson ? 'rgba(99,102,241,.10)' : 'rgba(100,116,139,.09)', border: '1px solid rgba(99,102,241,.10)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.9)' }}>{isSalaryPerson ? 'SALARY' : 'CONTRACT'}</span></div>
          <div style={{ marginTop: 8, minHeight: 38, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '0 11px', borderRadius: 10, border: '1px solid rgba(99,102,241,.18)', background: 'linear-gradient(145deg,rgba(255,255,255,.95),rgba(238,242,255,.72))', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.95), 0 7px 16px rgba(79,70,229,.07)' }}><span style={{ color: '#172033', fontSize: 12, fontWeight: 800 }}>{isSalaryPerson ? 'Salary Person' : 'Work per Job / Contract'}</span><span aria-hidden="true" style={{ color: '#6366f1', fontSize: 16, fontWeight: 900 }}>⌄</span></div>
        </button>
        {switchError && <p role="alert" style={{ margin: '6px 0 0', color: '#b91c1c', fontSize: 10.5 }}>{switchError}</p>}
      </section>

      <button type="button" onClick={identityAction} style={{ ...actionButtonStyle, padding: 12, background: 'linear-gradient(145deg,rgba(255,255,255,.98),rgba(239,246,255,.9))' }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}><strong style={{ display: 'block', fontSize: 14, color: '#172033', letterSpacing: '-.015em' }}>{identityTitle}</strong><span aria-hidden="true" style={{ width: 28, height: 28, borderRadius: 9, display: 'grid', placeItems: 'center', background: 'linear-gradient(145deg,#eef2ff,#dbeafe)', color: '#4338ca', fontWeight: 950, boxShadow: '0 7px 15px rgba(79,70,229,.14), inset 0 1px 0 #fff' }}>→</span></div><span style={{ display: 'block', marginTop: 4, color: '#64748b', fontSize: 11, lineHeight: 1.4 }}>{identityDescription}</span><span aria-hidden="true" style={{ display: 'block', marginTop: 8, color: '#4f46e5', fontWeight: 900, fontSize: 10.5, letterSpacing: '.01em' }}>{identityActionLabel}</span></button>

      <button type="button" onClick={() => navigate('/work/settings/team-joining')} style={{ ...actionButtonStyle, padding: 12, background: 'linear-gradient(145deg,rgba(255,255,255,.98),rgba(248,250,252,.9))' }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}><strong style={{ display: 'block', fontSize: 14, color: '#172033', letterSpacing: '-.015em' }}>Team Joining</strong><span aria-hidden="true" style={{ width: 28, height: 28, borderRadius: 9, display: 'grid', placeItems: 'center', background: 'linear-gradient(145deg,#f8fafc,#e2e8f0)', color: '#475569', fontWeight: 950, boxShadow: '0 7px 15px rgba(15,23,42,.08), inset 0 1px 0 #fff' }}>→</span></div><span style={{ display: 'block', marginTop: 4, color: '#64748b', fontSize: 11, lineHeight: 1.4 }}>Team joining is reserved as the existing entry point.</span><span aria-hidden="true" style={{ display: 'block', marginTop: 8, color: '#475569', fontWeight: 900, fontSize: 10.5 }}>Open team joining →</span></button>
    </section>

    {workerTypeOpen && <div role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setWorkerTypeOpen(false); }} style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(15,23,42,.48)', backdropFilter: 'blur(9px)', WebkitBackdropFilter: 'blur(9px)' }}>
      <section role="dialog" aria-modal="true" aria-labelledby="worker-type-dialog-title" style={{ width: 'min(100%, 430px)', padding: 16, borderRadius: 22, border: '1px solid rgba(255,255,255,.72)', background: 'linear-gradient(145deg,rgba(255,255,255,.98),rgba(239,246,255,.94))', boxShadow: '0 30px 80px rgba(15,23,42,.28), inset 0 1px 0 rgba(255,255,255,.95)', position: 'relative', overflow: 'hidden' }}>
        <div aria-hidden="true" style={{ position: 'absolute', width: 180, height: 180, borderRadius: '50%', right: -95, top: -105, background: 'rgba(99,102,241,.14)', filter: 'blur(4px)' }} />
        <div style={{ position: 'relative' }}><div style={eyebrowStyle}>WORKER MODE</div><h2 id="worker-type-dialog-title" style={{ margin: '4px 0 0', fontSize: 22, letterSpacing: '-.035em', color: '#111827' }}>Choose your work type</h2><p style={{ margin: '5px 0 14px', ...mutedTextStyle, fontSize: 11.5 }}>Select the mode that matches how you earn. Your existing records stay preserved when you switch.</p>
          <div style={{ display: 'grid', gap: 9 }}>
            {([
              ['salary_person', 'Salary Person', 'Fixed salary cycle with salary, attendance, overtime and allowance records.', 'SALARY'],
              ['contract', 'Work per Job / Contract', 'Existing contract-based Work House and earnings flow.', 'CONTRACT'],
            ] as const).map(([value, title, description, badge]) => {
              const selected = workerProfile.worker_type === value;
              return <button key={value} type="button" disabled={switching} onClick={() => void changeWorkerType(value)} style={{ width: '100%', padding: 12, borderRadius: 15, border: selected ? '1.5px solid rgba(79,70,229,.48)' : '1px solid rgba(148,163,184,.22)', background: selected ? 'linear-gradient(145deg,rgba(238,242,255,.98),rgba(219,234,254,.78))' : 'rgba(255,255,255,.82)', boxShadow: selected ? '0 12px 26px rgba(79,70,229,.13), inset 0 1px 0 #fff' : '0 7px 18px rgba(15,23,42,.06), inset 0 1px 0 #fff', textAlign: 'left', cursor: switching ? 'wait' : 'pointer', font: 'inherit', transition: 'transform .15s ease, box-shadow .15s ease' }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}><strong style={{ fontSize: 14, color: '#172033' }}>{title}</strong><span style={{ padding: '4px 7px', borderRadius: 999, fontSize: 8, fontWeight: 950, letterSpacing: '.08em', color: selected ? '#4338ca' : '#64748b', background: selected ? 'rgba(99,102,241,.12)' : 'rgba(148,163,184,.10)' }}>{selected ? 'CURRENT' : badge}</span></div><span style={{ display: 'block', marginTop: 5, color: '#64748b', fontSize: 11, lineHeight: 1.45 }}>{description}</span><span style={{ display: 'block', marginTop: 8, color: selected ? '#4f46e5' : '#475569', fontSize: 10.5, fontWeight: 900 }}>{selected ? 'Selected ✓' : 'Choose this mode →'}</span></button>;
            })}
          </div>
          <button type="button" onClick={() => setWorkerTypeOpen(false)} disabled={switching} style={{ width: '100%', marginTop: 11, minHeight: 38, borderRadius: 11, border: '1px solid rgba(148,163,184,.22)', background: 'rgba(255,255,255,.78)', color: '#475569', fontWeight: 850, cursor: switching ? 'wait' : 'pointer' }}>Cancel</button>
        </div>
      </section>
    </div>}
  </>);
}
