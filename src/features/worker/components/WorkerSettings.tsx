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

const cardStyle = { padding: 13, border: '1px solid rgba(99,102,241,.14)', borderRadius: 14, background: 'rgba(255,255,255,.92)', boxShadow: '0 6px 18px rgba(15,23,42,.06)' };
const actionButtonStyle = { ...cardStyle, width: '100%', textAlign: 'left' as const, cursor: 'pointer', font: 'inherit' };
const selectStyle = { width: '100%', minHeight: 40, boxSizing: 'border-box' as const, border: '1px solid #cbd5e1', borderRadius: 9, padding: '0 10px', font: 'inherit', background: '#fff' };

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
  const { workerProfile, profile, loading, error, reload } = useWorkerProfile(profileId ?? '');

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  if (teamJoining) return <main style={{ width: '100%', maxWidth: 760, margin: '0 auto', padding: '18px 12px 104px', boxSizing: 'border-box' }}><button type="button" onClick={() => navigate('/work/settings')} style={{ minHeight: 36, padding: '0 10px', borderRadius: 9, fontWeight: 800, cursor: 'pointer' }}>← Settings</button><section aria-labelledby="team-joining-title" style={{ ...cardStyle, marginTop: 12 }}><h1 id="team-joining-title" style={{ margin: 0, fontSize: 'clamp(24px, 7vw, 34px)', letterSpacing: '-.035em' }}>Team Joining</h1><p style={{ margin: '7px 0 0', color: '#64748b', lineHeight: 1.45 }}>Team Joining is a Worker navigation boundary. Joining requests, invitations, memberships, and team data are not implemented in this phase.</p></section></main>;

  const shell = (children: React.ReactNode) => <main style={{ width: '100%', maxWidth: 760, margin: '0 auto', padding: '18px 12px 104px', boxSizing: 'border-box' }}><header style={{ marginBottom: 12 }}><div style={{ color: '#64748b', fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>Worker Work House</div><h1 style={{ margin: '4px 0 0', fontSize: 'clamp(26px, 7vw, 36px)', letterSpacing: '-.04em' }}>Settings</h1></header>{children}</main>;

  if (loading) return shell(<section aria-live="polite" style={{ ...cardStyle, display: 'grid', gap: 7 }}><div style={{ width: 56, height: 56, borderRadius: '50%', background: '#e2e8f0' }} aria-hidden="true" /><strong>Loading Worker profile…</strong><span style={{ color: '#64748b', fontSize: 12 }}>Loading your real profile and Worker identity.</span></section>);

  if (error || !workerProfile || !profile) return shell(<section role="alert" style={{ ...cardStyle, borderColor: 'rgba(220,38,38,.22)' }}><strong>Unable to load Worker profile</strong><p style={{ margin: '6px 0 10px', color: '#64748b', lineHeight: 1.45 }}>{error ?? 'The real Worker profile data could not be resolved.'}</p><button type="button" onClick={() => void reload()} style={{ minHeight: 38, padding: '0 12px', borderRadius: 9, fontWeight: 800, cursor: 'pointer' }}>Retry</button></section>);

  const publicProfile = profile as PublicProfile;
  const workerId = workerProfile.work_id;
  const selectedSkills = workerProfile.skills ?? [];
  const isSalaryPerson = workerProfile.worker_type === 'salary_person';
  const copyWorkerId = async () => { if (!navigator.clipboard) return; try { await navigator.clipboard.writeText(workerId); setCopied(true); } catch { setCopied(false); } };
  const changeWorkerType = async (value: 'salary_person' | 'contract') => {
    if (value === workerProfile.worker_type) return;
    setSwitchError(''); setSwitching(true);
    const { error: updateError } = await setWorkerType(workerProfile.id, value);
    setSwitching(false);
    if (updateError) { setSwitchError(updateError.message); return; }
    await reload();
  };
  const identityAction = () => navigate(isSalaryPerson ? '/work/finance?setup=1' : '/work/identity');
  const identityTitle = isSalaryPerson ? 'Salary Slip' : 'Work Identity';
  const identityDescription = isSalaryPerson ? 'View and edit your Salary Person salary setup and salary records.' : 'Manage the existing Work Identity information and skills.';
  const identityActionLabel = isSalaryPerson ? 'View & Edit Salary →' : 'View & Edit Work Identity →';

  return shell(<><p style={{ margin: '-4px 0 12px', color: '#64748b', lineHeight: 1.45, fontSize: 13 }}>Your Worker profile and Work House settings.</p><section aria-labelledby="worker-profile-title" style={{ ...cardStyle, marginBottom: 12, padding: 14 }}><div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>{publicProfile.avatar_url ? <img src={publicProfile.avatar_url} alt={`${publicProfile.display_name || 'Worker'} profile picture`} width={64} height={64} style={{ flex: '0 0 64px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(99,102,241,.12)' }} /> : <div aria-hidden="true" style={{ flex: '0 0 64px', width: 64, height: 64, borderRadius: '50%', display: 'grid', placeItems: 'center', background: '#e2e8f0', color: '#334155', fontSize: 22, fontWeight: 900, border: '2px solid rgba(99,102,241,.12)' }}>{initials(publicProfile.display_name)}</div>}<div style={{ minWidth: 0 }}><div style={{ color: '#64748b', fontSize: 10, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>Worker Profile</div><h2 id="worker-profile-title" style={{ margin: '3px 0 0', fontSize: 'clamp(20px, 6vw, 26px)', letterSpacing: '-.035em', overflowWrap: 'anywhere' }}>{publicProfile.display_name || 'Your profile'}</h2>{publicProfile.username && <div style={{ marginTop: 2, color: '#64748b', fontSize: 13 }}>@{publicProfile.username}</div>}</div></div>{(publicProfile.bio || publicProfile.location || publicProfile.website) && <div style={{ display: 'grid', gap: 6, marginTop: 12, paddingTop: 11, borderTop: '1px solid rgba(148,163,184,.18)' }}>{publicProfile.bio && <p style={{ margin: 0, color: '#334155', lineHeight: 1.45, fontSize: 13, overflowWrap: 'anywhere' }}>{publicProfile.bio}</p>}{publicProfile.location && <div style={{ color: '#64748b', fontSize: 12 }}>📍 {publicProfile.location}</div>}{publicProfile.website && <a href={publicProfile.website} target="_blank" rel="noreferrer" style={{ color: '#4f46e5', fontSize: 12, fontWeight: 700, overflowWrap: 'anywhere' }}>{publicWebsiteLabel(publicProfile.website)}</a>}</div>}<div style={{ marginTop: 12, padding: 10, borderRadius: 11, background: 'rgba(99,102,241,.055)', border: '1px solid rgba(99,102,241,.1)' }}><div style={{ color: '#64748b', fontSize: 10, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>Worker ID</div><div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}><code style={{ minWidth: 0, flex: 1, fontSize: 12, fontWeight: 800, overflowWrap: 'anywhere' }}>{workerId}</code><button type="button" onClick={() => void copyWorkerId()} style={{ flex: '0 0 auto', minHeight: 32, padding: '0 9px', borderRadius: 8, fontWeight: 800, cursor: 'pointer', fontSize: 12 }}>{copied ? 'Copied' : 'Copy'}</button></div></div><div style={{ marginTop: 10, padding: 10, borderRadius: 11, background: '#f8fafc', border: '1px solid rgba(148,163,184,.2)' }}><div style={{ color: '#64748b', fontSize: 10, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>Selected Skills</div>{selectedSkills.length > 0 ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 7 }}>{selectedSkills.map((skill) => <span key={skill} style={{ borderRadius: 999, padding: '5px 8px', background: '#fff', border: '1px solid #cbd5e1', color: '#334155', fontSize: 11, fontWeight: 750 }}>{skill}</span>)}</div> : <div style={{ marginTop: 5, color: '#94a3b8', fontSize: 12 }}>No skills selected yet.</div>}</div></section><section aria-labelledby="worker-settings-section-title" style={{ display: 'grid', gap: 7 }}><h2 id="worker-settings-section-title" style={{ margin: '0 0 1px', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: '#64748b' }}>Worker</h2><section style={{ ...cardStyle, padding: 10, borderRadius: 11 }} aria-labelledby="worker-type-title"><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}><div><h2 id="worker-type-title" style={{ margin: 0, fontSize: 14 }}>Worker Type</h2><p style={{ margin: '2px 0 0', color: '#64748b', fontSize: 11, lineHeight: 1.3 }}>Choose Salary Person or Work per Job / Contract.</p></div><span style={{ flex: '0 0 auto', fontSize: 9, fontWeight: 900, color: isSalaryPerson ? '#166534' : '#475569' }}>{isSalaryPerson ? 'SALARY' : 'CONTRACT'}</span></div><select aria-label="Worker Type" value={workerProfile.worker_type} disabled={switching} onChange={(event) => void changeWorkerType(event.target.value as 'salary_person' | 'contract')} style={{ ...selectStyle, minHeight: 36, marginTop: 7, borderRadius: 8, fontSize: 12 }}><option value="salary_person">Salary Person</option><option value="contract">Work per Job / Contract</option></select>{switchError && <p role="alert" style={{ margin: '5px 0 0', color: '#b91c1c', fontSize: 11 }}>{switchError}</p>}</section><button type="button" onClick={identityAction} style={actionButtonStyle}><strong style={{ display: 'block', fontSize: 14 }}>{identityTitle}</strong><span style={{ display: 'block', marginTop: 3, color: '#64748b', fontSize: 12, lineHeight: 1.4 }}>{identityDescription}</span><span aria-hidden="true" style={{ display: 'block', marginTop: 7, fontWeight: 900, fontSize: 12 }}>{identityActionLabel}</span></button><button type="button" onClick={() => navigate('/work/settings/team-joining')} style={actionButtonStyle}><strong style={{ display: 'block', fontSize: 14 }}>Team Joining</strong><span style={{ display: 'block', marginTop: 3, color: '#64748b', fontSize: 12, lineHeight: 1.4 }}>Team joining is reserved as the existing entry point.</span><span aria-hidden="true" style={{ display: 'block', marginTop: 7, fontWeight: 900, fontSize: 12 }}>Open →</span></button></section></>);
}
