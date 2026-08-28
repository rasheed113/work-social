import { navigate } from '../Router';

export function WorkNavigation() {
  return (
    <nav
      aria-label="Work navigation"
      style={{
        position: 'fixed',
        left: 10,
        right: 10,
        bottom: 'calc(10px + env(safe-area-inset-bottom))',
        zIndex: 1000,
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr)',
        gap: 7,
        padding: 8,
        boxSizing: 'border-box',
        background: 'linear-gradient(145deg,rgba(15,23,42,.97),rgba(30,41,59,.96),rgba(49,46,129,.96))',
        border: '1px solid rgba(255,255,255,.16)',
        borderRadius: 22,
        boxShadow: '0 16px 38px rgba(15,23,42,.34)',
      }}
    >
      <button
        type="button"
        onClick={() => navigate('/work')}
        aria-current="page"
        style={{
          position: 'relative',
          minHeight: 56,
          minWidth: 0,
          border: '1px solid rgba(125,211,252,.55)',
          borderRadius: 16,
          color: '#fff',
          background: 'rgba(59,130,246,.35)',
          cursor: 'pointer',
          font: 'inherit',
        }}
      >
        <span aria-hidden="true" style={{ display: 'block', fontSize: 20 }}>⌂</span>
        <span style={{ fontSize: 10, fontWeight: 800 }}>Work House</span>
      </button>
    </nav>
  );
}
