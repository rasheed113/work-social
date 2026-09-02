import { navigate } from '../../../app/Router';

const destinations = [
  { path: '/work', label: 'Home', icon: '⌂' },
  { path: '/work/finance', label: 'Finance', icon: '¤' },
  { path: '/work/settings', label: 'Settings', icon: '⚙' },
];

function isActive(pathname: string, path: string) {
  if (path === '/work') return pathname === '/work';
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function WorkerNavigation() {
  const pathname = window.location.pathname;

  return (
    <nav
      aria-label="Worker navigation"
      style={{
        position: 'fixed',
        left: 10,
        right: 10,
        bottom: 'calc(10px + env(safe-area-inset-bottom))',
        zIndex: 1000,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: 7,
        padding: 8,
        boxSizing: 'border-box',
        background: 'linear-gradient(145deg,rgba(15,23,42,.97),rgba(30,41,59,.96),rgba(49,46,129,.96))',
        border: '1px solid rgba(255,255,255,.16)',
        borderRadius: 22,
        boxShadow: '0 16px 38px rgba(15,23,42,.34)',
      }}
    >
      {destinations.map((destination) => {
        const active = isActive(pathname, destination.path);
        return (
          <button
            key={destination.path}
            type="button"
            onClick={() => navigate(destination.path)}
            aria-current={active ? 'page' : undefined}
            style={{
              position: 'relative',
              minHeight: 56,
              minWidth: 0,
              border: active ? '1px solid rgba(125,211,252,.55)' : '1px solid rgba(255,255,255,.08)',
              borderRadius: 16,
              color: '#fff',
              background: active ? 'rgba(59,130,246,.35)' : 'rgba(255,255,255,.04)',
              cursor: 'pointer',
              font: 'inherit',
            }}
          >
            <span aria-hidden="true" style={{ display: 'block', fontSize: 20 }}>{destination.icon}</span>
            <span style={{ fontSize: 10, fontWeight: 800 }}>{destination.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
