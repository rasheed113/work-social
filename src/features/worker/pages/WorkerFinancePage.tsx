import { WorkSocialPremiumLoader } from '../../../app/components/WorkSocialPremiumLoader';
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase/client';
import { useWorkerProfile } from '../hooks/useWorkerProfile';
import { WorkerFinance } from '../components/WorkerFinance';
import { SalaryFinancePage } from './SalaryFinancePage';
import { SalarySetupPage } from './SalarySetupPage';

function SalaryAwareFinance({ profileId }: { profileId: string }) {
  const { workerProfile, loading } = useWorkerProfile(profileId);
  const setup = new URLSearchParams(window.location.search).get('setup') === '1';
  if (loading) return <WorkSocialPremiumLoader title="Worker Finance" message="Loading Worker finance…" />;
  if (workerProfile?.worker_type === 'salary_person') return setup ? <SalarySetupPage profileId={profileId} /> : <SalaryFinancePage profileId={profileId} />;
  return <WorkerFinance />;
}

export function WorkerFinancePage() {
  const [profileId, setProfileId] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => { let active = true; void supabase.auth.getUser().then(({ data }) => { if (active) { setProfileId(data.user?.id ?? ''); setLoading(false); } }); return () => { active = false; }; }, []);
  if (loading) return <WorkSocialPremiumLoader title="Worker Finance" message="Loading Worker finance…" />;
  if (!profileId) return <WorkerFinance />;
  return <SalaryAwareFinance profileId={profileId} />;
}
