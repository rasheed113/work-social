import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase/client';
import { useWorkerProfile } from '../hooks/useWorkerProfile';
import { WorkerFinance } from '../components/WorkerFinance';
import { SalaryDashboardPage } from './SalaryDashboardPage';
import { SalarySetupPage } from './SalarySetupPage';

function SalaryAwareFinance({ profileId }: { profileId: string }) {
  const { workerProfile, loading } = useWorkerProfile(profileId);
  const setup = new URLSearchParams(window.location.search).get('setup') === '1';
  if (loading) return <main style={{ padding: 24 }}>Loading Worker finance…</main>;
  if (workerProfile?.worker_type === 'salary_person') return setup ? <SalarySetupPage profileId={profileId} /> : <SalaryDashboardPage profileId={profileId} />;
  return <WorkerFinance />;
}

export function WorkerFinancePage() {
  const [profileId, setProfileId] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => { let active = true; void supabase.auth.getUser().then(({ data }) => { if (active) { setProfileId(data.user?.id ?? ''); setLoading(false); } }); return () => { active = false; }; }, []);
  if (loading) return <main style={{ padding: 24 }}>Loading Worker finance…</main>;
  if (!profileId) return <WorkerFinance />;
  return <SalaryAwareFinance profileId={profileId} />;
}
