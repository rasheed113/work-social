import { WorkerHome } from './WorkerHome';

interface WorkerWorkHouseProps {
  profileId: string;
}

export function WorkerWorkHouse({ profileId }: WorkerWorkHouseProps) {
  return <WorkerHome profileId={profileId} />;
}
