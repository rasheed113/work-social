import { useState } from 'react';
import { navigate } from '../../../app/Router';
import { WorkerIdentityForm } from '../components/WorkerIdentityForm';
import { useWorkerProfile } from '../hooks/useWorkerProfile';
import { setWorkerType } from '../api/salary';
import '../work-identity-premium.css';

interface WorkerIdentityPageProps { profileId: string; }

export function WorkerIdentityPage({ profileId }: WorkerIdentityPageProps) {
  const { workerProfile, profile, loading, saving, error, save, reload } = useWorkerProfile(profileId);
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState('');
  const [workerTypeOpen, setWorkerTypeOpen] = useState(false);
  if (loading) return <main style={{ padding: 24 }}>Loading Work Identity…</main>;

  const changeWorkerType = async (value: 'salary_person' | 'contract') => {
    if (!workerProfile || value === workerProfile.worker_type) return;
    setSwitchError(''); setSwitching(true);
    const { error: updateError } = await setWorkerType(workerProfile.id, value);
    setSwitching(false);
    if (updateError) { setSwitchError(updateError.message); return; }
    await reload();
    if (value === 'salary_person') navigate('/work/finance?setup=1');
  };

  return <main className="worker-identity-page" style={{ width: '100%', maxWidth: 760, margin: '0 auto', padding: '24px 14px 112px', boxSizing: 'border-box' }}>
    <div className="worker-identity-page__header" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}><button className="worker-identity-page__back" type="button" onClick={() => navigate('/work')} aria-label="Back to Work House">←</button><div><h1 className="worker-identity-page__title" style={{ margin: 0 }}>Work Identity</h1><p className="worker-identity-page__subtitle" style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>Tell Work House what you do.</p></div></div>
    {error && <p role="alert" style={{ margin: '0 0 14px' }}>{error}</p>}
    {workerProfile && <section className="foundation-card" style={{ marginBottom: 14 }}><div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}><div style={{ minWidth: 0 }}><h2 style={{ marginTop: 0 }}>Worker Type</h2><p style={{ color: '#64748b', lineHeight: 1.5 }}>Choose how your Work House records your earnings. Switching is non-destructive; historical records are retained.</p></div><button type="button" onClick={() => setWorkerTypeOpen(open => !open)} aria-expanded={workerTypeOpen} style={{ flex: '0 0 auto', minHeight: 40, padding: '0 13px', borderRadius: 11, fontWeight: 800, cursor: 'pointer' }}>{workerTypeOpen ? 'Close' : 'View & Edit'}</button></div>{workerTypeOpen && <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(148,163,184,.18)' }}><div style={{ marginBottom: 7, color: '#64748b', fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>Current Worker Type</div><select value={workerProfile.worker_type} disabled={switching} onChange={e => void changeWorkerType(e.target.value as 'salary_person' | 'contract')} style={{ width: '100%', minHeight: 44, boxSizing: 'border-box' }}><option value="salary_person">Salary Person</option><option value="contract">Work per Job / Contract</option></select></div>}{switchError && <p role="alert" style={{ color: '#b91c1c' }}>{switchError}</p>}</section>}
    <WorkerIdentityForm workerProfile={workerProfile} profile={profile} saving={saving} onSave={save} />
  </main>;
}
