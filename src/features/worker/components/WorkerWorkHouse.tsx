import { WorkerHome } from './WorkerHome';
import { WorkerTrash } from './WorkerTrash';

interface WorkerWorkHouseProps {
  profileId: string;
}

export function WorkerWorkHouse({ profileId }: WorkerWorkHouseProps) {
  if (window.location.pathname === '/work/trash') return <WorkerTrash />;
  return <WorkerHome profileId={profileId} />;
}
