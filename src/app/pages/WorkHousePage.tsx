import { navigate } from '../Router';

export function WorkHousePage() {
  return (
    <main
      style={{
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        padding: '24px 14px 112px',
        overflowX: 'hidden',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 900,
          minWidth: 0,
          margin: '0 auto',
        }}
      >
        <section
          aria-labelledby="work-house-title"
          style={{
            position: 'relative',
            overflow: 'hidden',
            padding: 'clamp(28px, 7vw, 56px) clamp(20px, 5vw, 44px)',
            boxSizing: 'border-box',
            border: '1px solid rgba(99,102,241,.14)',
            borderRadius: 24,
            background: 'linear-gradient(145deg, rgba(255,255,255,.98), rgba(241,245,255,.94) 52%, rgba(235,248,252,.92))',
            boxShadow: '0 18px 46px rgba(15,23,42,.10), inset 0 1px 0 rgba(255,255,255,.98)',
          }}
        >
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              width: 220,
              height: 220,
              right: -100,
              top: -100,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(109,93,252,.16), rgba(34,193,220,0))',
              pointerEvents: 'none',
            }}
          />
          <div
            aria-hidden="true"
            style={{
              width: 52,
              height: 52,
              display: 'grid',
              placeItems: 'center',
              marginBottom: 18,
              borderRadius: 16,
              color: '#fff',
              background: 'linear-gradient(145deg, #22c1dc, #6d5dfc)',
              boxShadow: 'inset 0 1px 1px rgba(255,255,255,.35), 0 10px 24px rgba(79,70,229,.20)',
              fontSize: 24,
              fontWeight: 900,
            }}
          >
            W
          </div>
          <h1
            id="work-house-title"
            style={{
              position: 'relative',
              margin: 0,
              color: 'transparent',
              background: 'linear-gradient(135deg, #6d5dfc 0%, #22c1dc 52%, #ff5ca8 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontSize: 'clamp(30px, 7vw, 46px)',
              lineHeight: 1.05,
              fontWeight: 900,
              letterSpacing: '-.04em',
            }}
          >
            Work House
          </h1>
          <p style={{ position: 'relative', margin: '12px 0 0', maxWidth: 620, color: '#536072', fontSize: 'clamp(14px, 2.4vw, 17px)', lineHeight: 1.6 }}>
            The Work side of Work Social. This is the foundation for future workspaces, without adding unfinished or fake features.
          </p>
          <button
            type="button"
            onClick={() => navigate('/work/identity')}
            style={{ position: 'relative', marginTop: 22, minHeight: 46, padding: '0 16px', borderRadius: 14, cursor: 'pointer', fontWeight: 800 }}
          >
            Work Identity
          </button>
        </section>
      </div>
    </main>
  );
}
