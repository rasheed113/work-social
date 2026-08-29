import { useState } from 'react';
import { navigate } from '../../../app/Router';
import { useWorkerWorkDashboard } from '../hooks/useWorkerWorkDashboard';
import { WorkerNewWorkEntryModal } from './WorkerNewWorkEntryModal';
import { WorkerWorkEntryList } from './WorkerWorkEntryList';
import { WorkerWorkSummaryCards } from './WorkerWorkSummaryCards';

const cardStyle = {
  padding: 18,
  border: '1px solid rgba(99,102,241,.14)',
  borderRadius: 18,
  background: 'rgba(255,255,255,.92)',
  boxShadow: '0 10px 28px rgba(15,23,42,.07)',
};

interface WorkerHomeProps {
  profileId: string;
}

export function WorkerHome({ profileId }: WorkerHomeProps) {
  const [newEntryOpen, setNewEntryOpen] = useState(false);
  const dashboard = useWorkerWorkDashboard(profileId);

  return (
    <main style={{ width: '100%', maxWidth: 900, margin: '0 auto', padding: '24px 14px 112px', boxSizing: 'border-box' }}>
      <header style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
        <div>
          <div style={{ color: '#64748b', fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>Worker Work House</div>
          <h1 style={{ margin: '6px 0 0', fontSize: 'clamp(28px, 7vw, 42px)', letterSpacing: '-.04em' }}>Home</h1>
          <p style={{ margin: '8px 0 0', color: '#64748b', lineHeight: 1.55 }}>Your persisted My Work record and real Work totals.</p>
        </div>
        <button type="button" onClick={() => setNewEntryOpen(true)} disabled={!dashboard.workerProfileId || dashboard.loading} style={{ flex: '0 0 auto', minHeight: 46, padding: '0 15px', borderRadius: 14, fontWeight: 900, cursor: dashboard.workerProfileId && !dashboard.loading ? 'pointer' : 'not-allowed' }}>
          + New Entry
        </button>
      </header>

      {dashboard.error && <p role="alert" style={{ ...cardStyle, margin: '0 0 14px', color: '#b91c1c', fontSize: 13, fontWeight: 700 }}>{dashboard.error}</p>}

      {!dashboard.loading && !dashboard.workerProfileId ? (
        <section style={{ ...cardStyle, marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Set up Work Identity first</h2>
          <p style={{ margin: '7px 0 0', color: '#64748b', lineHeight: 1.5, fontSize: 13 }}>A Worker Work Entry belongs to a real Worker Identity. No placeholder entries or fake totals are created before that identity exists.</p>
          <button type="button" onClick={() => navigate('/work/identity')} style={{ marginTop: 12, minHeight: 42, padding: '0 13px', borderRadius: 12, fontWeight: 800, cursor: 'pointer' }}>Open Work Identity</button>
        </section>
      ) : (
        <>
          <WorkerWorkSummaryCards totals={dashboard.totals} periodLabels={dashboard.periodLabels} />

          <section style={{ marginTop: 16 }} aria-labelledby="worker-home-my-work">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
              <div>
                <h2 id="worker-home-my-work" style={{ margin: 0, fontSize: 19 }}>My Work Entries</h2>
                <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 12 }}>Recent persisted records. Tap an entry to open its details/history.</p>
              </div>
              <button type="button" onClick={() => navigate('/work/history')} style={{ minHeight: 38, padding: '0 11px', borderRadius: 11, fontWeight: 800, cursor: 'pointer' }}>History</button>
            </div>
            {dashboard.loading ? (
              <section style={{ ...cardStyle }}><p style={{ margin: 0, color: '#64748b' }}>Loading Work Entries…</p></section>
            ) : (
              <WorkerWorkEntryList
                entries={dashboard.entries}
                onOpen={(entry) => navigate(`/work/history?entry=${encodeURIComponent(entry.id)}`)}
              />
            )}
          </section>
        </>
      )}

      <section aria-labelledby="worker-home-team" style={{ ...cardStyle, marginTop: 16 }}>
        <h2 id="worker-home-team" style={{ margin: 0, fontSize: 17 }}>Team Work</h2>
        <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 13 }}>Teams and approved Team Work are intentionally outside Phase 3C.</p>
      </section>

      <section aria-labelledby="worker-home-finance" style={{ ...cardStyle, marginTop: 12 }}>
        <h2 id="worker-home-finance" style={{ margin: 0, fontSize: 17 }}>Finance</h2>
        <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 13 }}>Finance remains a separate Worker domain and is not implemented here.</p>
        <button type="button" onClick={() => navigate('/work/finance')} style={{ marginTop: 12, minHeight: 40, padding: '0 13px', borderRadius: 11, fontWeight: 800, cursor: 'pointer' }}>Open Finance</button>
      </section>

      <section aria-labelledby="worker-home-diary" style={{ ...cardStyle, marginTop: 12 }}>
        <h2 id="worker-home-diary" style={{ margin: 0, fontSize: 17 }}>Personal Diary</h2>
        <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 13 }}>Personal Diary remains an independent future Worker feature.</p>
      </section>

      <WorkerNewWorkEntryModal open={newEntryOpen} saving={dashboard.saving} onClose={() => setNewEntryOpen(false)} onSave={dashboard.createEntry} />
    </main>
  );
}
