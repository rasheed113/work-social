import { SalaryDashboardPage } from './SalaryDashboardPage';
import { WorkerWorkHouse } from '../components/WorkerWorkHouse';
import { useCurrentWorkerProfileId } from '../hooks/useCurrentWorkerProfileId';
import { useWorkerProfile } from '../hooks/useWorkerProfile';

export function WorkerWorkHousePage() {
  const session = useCurrentWorkerProfileId();
  const profile = useWorkerProfile(session.profileId);

  if (session.loading || profile.loading) {
    return <main style={{ width: '100%', maxWidth: 900, margin: '0 auto', padding: '24px 14px 112px', boxSizing: 'border-box' }}><p style={{ color: '#64748b' }}>Loading Worker workspace…</p></main>;
  }

  if (session.error || !session.profileId) {
    return <main style={{ width: '100%', maxWidth: 900, margin: '0 auto', padding: '24px 14px 112px', boxSizing: 'border-box' }}><p role="alert" style={{ color: '#b91c1c', fontWeight: 700 }}>{session.error ?? 'Authenticated profile is unavailable.'}</p></main>;
  }

  if (profile.error) {
    return <main style={{ width: '100%', maxWidth: 900, margin: '0 auto', padding: '24px 14px 112px', boxSizing: 'border-box' }}><p role="alert" style={{ color: '#b91c1c', fontWeight: 700 }}>{profile.error}</p></main>;
  }

  if (profile.workerProfile?.worker_type === 'salary_person') {
    return <SalaryDashboardPage profileId={session.profileId} />;
  }

  return <WorkerWorkHouse profileId={session.profileId} />;
}
