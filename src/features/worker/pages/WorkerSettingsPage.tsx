import { WorkerSettings } from '../components/WorkerSettings';

interface WorkerSettingsPageProps {
  teamJoining?: boolean;
}

export function WorkerSettingsPage({ teamJoining = false }: WorkerSettingsPageProps) {
  return <WorkerSettings teamJoining={teamJoining} />;
}
