import { WorkerSettings } from '../components/WorkerSettings';

interface WorkerSettingsPageProps {
  profileId: string;
  teamJoining?: boolean;
}

export function WorkerSettingsPage({ profileId, teamJoining = false }: WorkerSettingsPageProps) {
  return <WorkerSettings profileId={profileId} teamJoining={teamJoining} />;
}
