import { Component, type ErrorInfo, type ReactNode } from 'react';
import { SalaryDashboardPage } from './SalaryDashboardPage';
import { WorkerOverviewPage } from './WorkerOverviewPage';
import { WorkerWorkHouse } from '../components/WorkerWorkHouse';
import { useCurrentWorkerProfileId } from '../hooks/useCurrentWorkerProfileId';
import { useWorkerProfile } from '../hooks/useWorkerProfile';
import { WorkerTeamWorkPage } from './WorkerTeamWorkPage';
import { WorkerTeamDashboardPage } from './WorkerTeamDashboardPage';
import { WorkerTeamDashboardWorkPageV2 } from './WorkerTeamDashboardWorkPageV2';
import { ContractorTeamFinancePage } from '../../contractor/pages/ContractorTeamFinancePage';

class TeamDashboardWorkBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Team Dashboard Work view failed to render.', error, info); }
  render() { if (this.state.hasError) return <WorkerTeamDashboardPage />; return this.props.children; }
}

export function WorkerWorkHousePage() {
  const session = useCurrentWorkerProfileId();
  const profile = useWorkerProfile(session.profileId ?? '');
  if (session.loading || profile.loading) return <main style={{ width: '100%', maxWidth: 900, margin: '0 auto', padding: '24px 14px 112px', boxSizing: 'border-box' }}><p style={{ color: '#64748b' }}>Loading Worker workspace…</p></main>;
  if (session.error || !session.profileId) return <main style={{ width: '100%', maxWidth: 900, margin: '0 auto', padding: '24px 14px 112px', boxSizing: 'border-box' }}><p role="alert" style={{ color: '#b91c1c', fontWeight: 700 }}>{session.error ?? 'Authenticated profile is unavailable.'}</p></main>;
  if (profile.error) return <main style={{ width: '100%', maxWidth: 900, margin: '0 auto', padding: '24px 14px 112px', boxSizing: 'border-box' }}><p role="alert" style={{ color: '#b91c1c', fontWeight: 700 }}>{profile.error}</p></main>;
  const pathname = window.location.pathname;
  const financeMatch = pathname.match(/^\/work\/contractor\/team-finance\/(\d+)\/?$/);
  if (financeMatch) return <ContractorTeamFinancePage teamNumber={financeMatch[1]} />;
  if (/^\/work\/team-work\/\d+(?:\/|$)/.test(pathname)) {
    if (/^\/work\/team-work\/\d+\/(?:finance|settings)\/?$/.test(pathname)) return <WorkerTeamDashboardPage />;
    return <TeamDashboardWorkBoundary><WorkerTeamDashboardWorkPageV2 /></TeamDashboardWorkBoundary>;
  }
  if (pathname === '/work/team-work') return <WorkerTeamWorkPage />;
  if (pathname === '/work/diary') return <WorkerWorkHouse profileId={session.profileId} />;
  if (pathname === '/work/dashboard') {
    if (profile.workerProfile?.worker_type === 'salary_person') return <SalaryDashboardPage profileId={session.profileId} />;
    return <WorkerWorkHouse profileId={session.profileId} />;
  }
  return <WorkerOverviewPage />;
}
