import { WorkerWorkHouse } from '../components/WorkerWorkHouse';
import { useCurrentWorkerProfileId } from '../hooks/useCurrentWorkerProfileId';

export function WorkerWorkHousePage() {
  const session = useCurrentWorkerProfileId();

  if (session.loading) {
    return <main style={{ width: '100%', maxWidth: 900, margin: '0 auto', padding: '24px 14px 112px', boxSizing: 'border-box' }}><p style={{ color: '#64748b' }}>Loading Worker workspace…</p></main>;
  }

  if (session.error || !session.profileId) {
    return <main style={{ width: '100%', maxWidth: 900, margin: '0 auto', padding: '24px 14px 112px', boxSizing: 'border-box' }}><p role="alert" style={{ color: '#b91c1c', fontWeight: 700 }}>{session.error ?? 'Authenticated profile is unavailable.'}</p></main>;
  }

  return <WorkerWorkHouse profileId={session.profileId} />;
}
