import { navigate } from '../../../app/Router';
import { WorkerIdentityForm } from '../components/WorkerIdentityForm';
import { useWorkerProfile } from '../hooks/useWorkerProfile';
import '../work-identity-premium.css';

interface WorkerIdentityPageProps {
  profileId: string;
}

export function WorkerIdentityPage({ profileId }: WorkerIdentityPageProps) {
  const { workerProfile, profile, loading, saving, error, save } = useWorkerProfile(profileId);

  if (loading) {
    return <main style={{ padding: 24 }}><p>Loading Work Identity…</p></main>;
  }

  return (
    <main className="worker-identity-page" style={{ width: '100%', maxWidth: 760, margin: '0 auto', padding: '24px 14px 112px', boxSizing: 'border-box' }}>
      <div className="worker-identity-page__header" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <button className="worker-identity-page__back" type="button" onClick={() => navigate('/work')} aria-label="Back to Work House">←</button>
        <div>
          <h1 className="worker-identity-page__title" style={{ margin: 0 }}>Work Identity</h1>
          <p className="worker-identity-page__subtitle" style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>Tell Work House what you do.</p>
        </div>
      </div>

      {error && <p role="alert" style={{ margin: '0 0 14px' }}>{error}</p>}

      <WorkerIdentityForm
        workerProfile={workerProfile}
        profile={profile}
        saving={saving}
        onSave={save}
      />
    </main>
  );
}
