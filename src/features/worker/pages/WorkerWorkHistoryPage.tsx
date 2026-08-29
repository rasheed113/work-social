import { useEffect, useRef } from 'react';
import { navigate } from '../../../app/Router';
import { useWorkerWorkHistory } from '../hooks/useWorkerWorkHistory';
import { WorkerWorkEntryDetails } from '../components/WorkerWorkEntryDetails';
import { WorkerWorkEntryList } from '../components/WorkerWorkEntryList';

interface WorkerWorkHistoryPageProps {
  profileId: string;
}

export function WorkerWorkHistoryPage({ profileId }: WorkerWorkHistoryPageProps) {
  const history = useWorkerWorkHistory(profileId);
  const openedQueryEntry = useRef<string | null>(null);
  const queryEntryId = new URLSearchParams(window.location.search).get('entry');

  useEffect(() => {
    if (!queryEntryId || openedQueryEntry.current === queryEntryId || history.loading) return;
    const entry = history.entries.find((candidate) => candidate.id === queryEntryId);
    if (!entry) return;
    openedQueryEntry.current = queryEntryId;
    void history.openDetails(entry);
  }, [history.entries, history.loading, history.openDetails, queryEntryId]);

  return (
    <main style={{ width: '100%', maxWidth: 860, margin: '0 auto', padding: '24px 14px 112px', boxSizing: 'border-box' }}>
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
        <div>
          <button type="button" onClick={() => navigate('/work')} style={{ minHeight: 38, padding: '0 11px', borderRadius: 11, cursor: 'pointer' }}>← Home</button>
          <div style={{ marginTop: 14, color: '#64748b', fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>Worker Work House</div>
          <h1 style={{ margin: '5px 0 0', fontSize: 'clamp(28px, 7vw, 40px)', letterSpacing: '-.04em' }}>My Work History</h1>
          <p style={{ margin: '7px 0 0', color: '#64748b', fontSize: 13, lineHeight: 1.5 }}>{history.totalCount} persisted Work Entries. History loads progressively.</p>
        </div>
        <button type="button" onClick={() => navigate('/work')} style={{ minHeight: 44, padding: '0 13px', borderRadius: 12, fontWeight: 900, cursor: 'pointer' }}>New Entry</button>
      </header>

      {history.actionError && <p role="alert" style={{ padding: 13, borderRadius: 13, background: '#fff1f2', color: '#b91c1c', fontSize: 13, fontWeight: 700 }}>{history.actionError}</p>}

      {history.loading ? (
        <section style={{ padding: 20, border: '1px solid #e2e8f0', borderRadius: 18, background: '#fff' }}><p style={{ margin: 0, color: '#64748b' }}>Loading Work History…</p></section>
      ) : (
        <>
          <WorkerWorkEntryList entries={history.entries} emptyTitle="No Work Entries yet" emptyDescription="Create a real My Work Entry from the Worker Home dashboard." onOpen={(entry) => void history.openDetails(entry)} />
          {history.hasMore && (
            <button type="button" onClick={() => void history.loadMore()} disabled={history.loadingMore} style={{ display: 'block', width: '100%', marginTop: 12, minHeight: 44, borderRadius: 12, fontWeight: 800, cursor: history.loadingMore ? 'not-allowed' : 'pointer' }}>
              {history.loadingMore ? 'Loading more…' : 'More'}
            </button>
          )}
        </>
      )}

      <WorkerWorkEntryDetails
        entry={history.selectedEntry}
        versions={history.versions}
        versionsLoading={history.versionsLoading}
        actionError={history.actionError}
        onClose={history.closeDetails}
        onEdit={history.editEntry}
        onDeleteForMe={history.deleteForMe}
      />
    </main>
  );
}
