import { navigate } from '../../../app/Router';
import '../worker-compact.css';
import { useCurrentWorkerProfileId } from '../hooks/useCurrentWorkerProfileId';
import { useWorkerProfile } from '../hooks/useWorkerProfile';
import { ContractorTrashButton } from '../../contractor/components/ContractorTrashButton';

type Destination = { path: string; label: string; icon: string; salaryLabel?: string };

const workerDestinations: Destination[] = [
  { path: '/work', label: 'Home', icon: '⌂' },
  { path: '/work/finance', label: 'Finance', salaryLabel: 'Salary', icon: '¤' },
  { path: '/work/settings', label: 'Settings', icon: '⚙' },
];

const contractorDestinations: Destination[] = [
  { path: '/work/contractor?view=dashboard', label: 'Home', icon: '⌂' },
  { path: '/work/contractor?view=finance', label: 'Finance', icon: '¤' },
  { path: '/work/contractor?view=settings', label: 'Settings', icon: '⚙' },
];

function isActive(pathname: string, search: string, path: string) {
  const [targetPath, targetQuery] = path.split('?');
  if (targetPath === '/work') return pathname === '/work';
  if (targetPath !== '/work/contractor') return pathname === targetPath || pathname.startsWith(`${targetPath}/`);
  const currentView = new URLSearchParams(search).get('view') ?? 'dashboard';
  const targetView = new URLSearchParams(targetQuery ?? '').get('view') ?? 'dashboard';
  return pathname === '/work/contractor' && currentView === targetView;
}

export function WorkerNavigation() {
  const pathname = window.location.pathname;
  const search = window.location.search;
  const session = useCurrentWorkerProfileId();
  const { workerProfile } = useWorkerProfile(session.profileId ?? '');
  const isContractor = pathname === '/work/contractor';
  const isContractorDashboard = isContractor && (new URLSearchParams(search).get('view') ?? 'dashboard') === 'dashboard';
  const isSalaryPerson = workerProfile?.worker_type === 'salary_person';
  const destinations = isContractor ? contractorDestinations : workerDestinations;

  return (
    <>
      {isContractorDashboard && session.profileId && <ContractorTrashButton profileId={session.profileId} />}
      <nav
        aria-label={isContractor ? 'Contractor navigation' : 'Worker navigation'}
        style={{ position: 'fixed', left: 10, right: 10, bottom: 'calc(10px + env(safe-area-inset-bottom))', zIndex: 1000, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 7, padding: 8, boxSizing: 'border-box', background: 'linear-gradient(145deg,rgba(15,23,42,.97),rgba(30,41,59,.96),rgba(49,46,129,.96))', border: '1px solid rgba(255,255,255,.16)', borderRadius: 22, boxShadow: '0 16px 38px rgba(15,23,42,.34)' }}
      >
        {destinations.map((destination) => {
          const active = isActive(pathname, search, destination.path);
          const label = !isContractor && isSalaryPerson && destination.salaryLabel ? destination.salaryLabel : destination.label;
          return (
            <button key={destination.path} type="button" onClick={() => navigate(destination.path)} aria-current={active ? 'page' : undefined} style={{ position: 'relative', minHeight: 56, minWidth: 0, border: active ? '1px solid rgba(125,211,252,.55)' : '1px solid rgba(255,255,255,.08)', borderRadius: 16, color: '#fff', background: active ? 'rgba(59,130,246,.35)' : 'rgba(255,255,255,.04)', cursor: 'pointer', font: 'inherit' }}>
              <span aria-hidden="true" style={{ display: 'block', fontSize: 20 }}>{destination.icon}</span>
              <span style={{ fontSize: 10, fontWeight: 800 }}>{label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
