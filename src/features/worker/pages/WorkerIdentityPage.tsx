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
  const [pendingWorkerType, setPendingWorkerType] = useState<'salary_person' | 'contract' | null>(null);
  if (loading) return <main style={{ padding: 24 }}>Loading Work Identity…</main>;

  const workerTypeLabel = (value: 'salary_person' | 'contract') => value === 'salary_person' ? 'Salary Person' : 'Work per Job / Contract';

  const changeWorkerType = async (value: 'salary_person' | 'contract') => {
    if (!workerProfile || value === workerProfile.worker_type) { setPendingWorkerType(null); return; }
    setSwitchError(''); setSwitching(true);
    const { error: updateError } = await setWorkerType(workerProfile.id, value);
    setSwitching(false);
    if (updateError) { setSwitchError(updateError.message); return; }
    setPendingWorkerType(null);
    await reload();
    if (value === 'salary_person') navigate('/work/finance?setup=1');
  };

  const requestWorkerTypeChange = (value: 'salary_person' | 'contract') => {
    if (!workerProfile || value === workerProfile.worker_type) return;
    setSwitchError('');
    setPendingWorkerType(value);
  };

  return <main className="worker-identity-page" style={{ width: '100%', maxWidth: 760, margin: '0 auto', padding: '24px 14px 112px', boxSizing: 'border-box' }}>
    <div className="worker-identity-page__header" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}><button className="worker-identity-page__back" type="button" onClick={() => navigate('/work')} aria-label="Back to Work House">←</button><div><h1 className="worker-identity-page__title" style={{ margin: 0 }}>Work Identity</h1><p className="worker-identity-page__subtitle" style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>Tell Work House what you do.</p></div></div>
    {error && <p role="alert" style={{ margin: '0 0 14px' }}>{error}</p>}
    {workerProfile && <section className="foundation-card" style={{ marginBottom: 14 }}><div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}><div style={{ minWidth: 0 }}><h2 style={{ marginTop: 0 }}>Worker Type</h2><p style={{ color: '#64748b', lineHeight: 1.5 }}>Choose how your Work House records your earnings. Switching is non-destructive; historical records are retained.</p></div><button type="button" onClick={() => setWorkerTypeOpen(open => !open)} aria-expanded={workerTypeOpen} style={{ flex: '0 0 auto', minHeight: 40, padding: '0 13px', borderRadius: 11, fontWeight: 800, cursor: 'pointer' }}>{workerTypeOpen ? 'Close' : 'View & Edit'}</button></div>{workerTypeOpen && <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(148,163,184,.18)' }}><div style={{ marginBottom: 7, color: '#64748b', fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>Current Worker Type</div><select value={workerProfile.worker_type} disabled={switching} onChange={e => requestWorkerTypeChange(e.target.value as 'salary_person' | 'contract')} style={{ width: '100%', minHeight: 44, boxSizing: 'border-box' }}><option value="salary_person">Salary Person</option><option value="contract">Work per Job / Contract</option></select></div>}{switchError && <p role="alert" style={{ color: '#b91c1c' }}>{switchError}</p>}</section>}

    {pendingWorkerType && workerProfile && <div role="presentation" onMouseDown={e => { if (e.currentTarget === e.target && !switching) setPendingWorkerType(null); }} style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'grid', placeItems: 'center', padding: 18, background: 'rgba(8, 18, 30, .56)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}>
      <div role="dialog" aria-modal="true" aria-labelledby="worker-type-switch-title" style={{ width: '100%', maxWidth: 430, boxSizing: 'border-box', border: '1px solid rgba(255,255,255,.72)', borderRadius: 26, padding: 20, background: 'linear-gradient(145deg, rgba(255,255,255,.98), rgba(235,248,250,.97) 55%, rgba(216,239,243,.96))', boxShadow: '0 8px 0 rgba(7,42,55,.16), 0 28px 65px rgba(2,18,31,.3), inset 0 1px 0 #fff, inset 0 -1px 0 rgba(15,23,42,.06)' }}>
        <div style={{ width: 48, height: 48, display: 'grid', placeItems: 'center', marginBottom: 14, borderRadius: 15, background: 'linear-gradient(145deg,#e6fbff,#a9dfe8)', color: '#14576b', fontSize: 22, fontWeight: 900, boxShadow: '0 4px 0 rgba(20,87,107,.18), 0 10px 22px rgba(20,87,107,.15), inset 0 1px 0 #fff' }}>↔</div>
        <div style={{ marginBottom: 5, color: '#5b7480', fontSize: 10, fontWeight: 900, letterSpacing: '.12em', textTransform: 'uppercase' }}>Worker Type</div>
        <h2 id="worker-type-switch-title" style={{ margin: '0 0 8px', color: '#123d50', fontSize: 21, lineHeight: 1.15, fontWeight: 950, letterSpacing: '-.025em' }}>Confirm switch</h2>
        <p style={{ margin: '0 0 16px', color: '#627985', fontSize: 12.5, lineHeight: 1.55 }}>You are changing how Work House records your earnings. Your historical records will remain preserved.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 32px 1fr', alignItems: 'center', gap: 8, marginBottom: 15 }}>
          <div style={{ minWidth: 0, padding: '12px 11px', borderRadius: 15, border: '1px solid rgba(99,132,145,.2)', background: 'rgba(255,255,255,.72)', boxShadow: 'inset 0 1px 0 #fff, 0 3px 0 rgba(100,116,139,.1)' }}><div style={{ marginBottom: 4, color: '#78909b', fontSize: 9, fontWeight: 900, letterSpacing: '.1em', textTransform: 'uppercase' }}>Current</div><div style={{ color: '#274b5b', fontSize: 12, fontWeight: 900, lineHeight: 1.3 }}>{workerTypeLabel(workerProfile.worker_type)}</div></div>
          <div style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', borderRadius: 10, background: 'linear-gradient(180deg,#fff,#dceff2)', color: '#267287', fontWeight: 900, boxShadow: '0 2px 0 rgba(100,116,139,.14), inset 0 1px 0 #fff' }}>→</div>
          <div style={{ minWidth: 0, padding: '12px 11px', borderRadius: 15, border: '1px solid rgba(20,125,145,.24)', background: 'linear-gradient(145deg,rgba(239,253,255,.95),rgba(208,240,244,.9))', boxShadow: '0 3px 0 rgba(20,125,145,.14), 0 8px 18px rgba(20,125,145,.08), inset 0 1px 0 #fff' }}><div style={{ marginBottom: 4, color: '#438094', fontSize: 9, fontWeight: 900, letterSpacing: '.1em', textTransform: 'uppercase' }}>New</div><div style={{ color: '#124d61', fontSize: 12, fontWeight: 900, lineHeight: 1.3 }}>{workerTypeLabel(pendingWorkerType)}</div></div>
        </div>
        <div style={{ marginBottom: 17, padding: '10px 11px', borderRadius: 13, border: '1px solid rgba(20,125,145,.14)', background: 'rgba(255,255,255,.55)', color: '#56727e', fontSize: 11, lineHeight: 1.45, fontWeight: 650 }}>✓ Existing salary, attendance, overtime and contract history is not deleted by this switch.</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 9 }}>
          <button type="button" disabled={switching} onClick={() => setPendingWorkerType(null)} style={{ minHeight: 44, borderRadius: 13, border: '1px solid rgba(99,132,145,.24)', background: 'linear-gradient(180deg,#fff,#e8f3f5)', color: '#31586a', fontWeight: 850, cursor: switching ? 'default' : 'pointer', boxShadow: '0 3px 0 rgba(100,116,139,.14), inset 0 1px 0 #fff' }}>Cancel</button>
          <button type="button" disabled={switching} onClick={() => void changeWorkerType(pendingWorkerType)} style={{ minHeight: 44, borderRadius: 13, border: '1px solid rgba(20,125,145,.35)', background: 'linear-gradient(145deg,#287f91,#12566b)', color: '#fff', fontWeight: 900, cursor: switching ? 'default' : 'pointer', boxShadow: '0 4px 0 rgba(8,62,76,.28), 0 10px 22px rgba(20,87,107,.2), inset 0 1px 0 rgba(255,255,255,.24)' }}>{switching ? 'Switching…' : 'Confirm Switch'}</button>
        </div>
      </div>
    </div>}

    <WorkerIdentityForm workerProfile={workerProfile} profile={profile} saving={saving} onSave={save} />
  </main>;
}
