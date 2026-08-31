import { WorkerHome } from './WorkerHome';
import { WorkerTrash } from './WorkerTrash';
import { WorkerDiaryPage } from '../pages/WorkerDiaryPage';

interface WorkerWorkHouseProps {
  profileId: string;
}

export function WorkerWorkHouse({ profileId }: WorkerWorkHouseProps) {
  if (window.location.pathname === '/work/trash') return <WorkerTrash />;
  if (window.location.pathname === '/work/diary') return <WorkerDiaryPage />;
  return <WorkerHome profileId={profileId} />;
}
