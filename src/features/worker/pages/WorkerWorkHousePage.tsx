import { WorkerWorkHouse } from '../components/WorkerWorkHouse';

interface WorkerWorkHousePageProps {
  profileId: string;
}

export function WorkerWorkHousePage({ profileId }: WorkerWorkHousePageProps) {
  return <WorkerWorkHouse profileId={profileId} />;
}
