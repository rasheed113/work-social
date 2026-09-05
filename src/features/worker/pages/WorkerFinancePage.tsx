import { useWorkerProfile } from '../hooks/useWorkerProfile';
import { WorkerFinance } from '../components/WorkerFinance';
import { SalaryDashboardPage } from './SalaryDashboardPage';
import { SalarySetupPage } from './SalarySetupPage';

export function WorkerFinancePage() {
  const profileId = (() => {
    const match = document.cookie.match(/(?:^|; )work-social-profile-id=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  })();
  const { workerProfile, loading } = useWorkerProfile(profileId);
  const setup = new URLSearchParams(window.location.search).get('setup') === '1';
  if (loading || !profileId) return <WorkerFinance />;
  if (workerProfile?.worker_type === 'salary_person') return setup ? <SalarySetupPage profileId={profileId} /> : <SalaryDashboardPage profileId={profileId} />;
  return <WorkerFinance />;
}
