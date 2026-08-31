from pathlib import Path

api = Path('src/features/worker/api/finance.ts')
hook = Path('src/features/worker/hooks/useWorkerFinance.ts')
component = Path('src/features/worker/components/WorkerFinance.tsx')

api_text = api.read_text()
marker = "export async function listWorkerFinanceReceived(profileId: string) {"
if "export type FinanceHistoryFilter" not in api_text:
    insert = '''export type FinanceHistoryFilter = 'all' | 'earnings' | 'payments' | 'advances' | 'received';

export interface FinanceReceivedCursor {
  received_at: string;
  id: string;
}

export interface FinanceHistoryCursors {
  earnings: { occurred_at: string; id: string } | null;
  received: FinanceReceivedCursor | null;
}

export interface FinanceHistoryBatch {
  earnings: WorkEntry[];
  received: FinanceReceivedRecord[];
  nextCursors: FinanceHistoryCursors;
  hasMore: { earnings: boolean; received: boolean };
}

export async function getWorkerFinanceSummary() {
  const result = await supabase.rpc('get_worker_finance_summary');
  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  return {
    data: row
      ? {
          total_earnings: canonicalizeWorkDecimal(String(row.total_earnings ?? 0)),
          received: canonicalizeWorkDecimal(String(row.received ?? 0)),
          remaining: canonicalizeWorkDecimal(String(row.remaining ?? 0)),
        }
      : null,
    error: result.error,
  };
}

export async function listWorkerFinanceHistoryBatch(
  profileId: string,
  filter: FinanceHistoryFilter,
  limit: number,
  cursors: FinanceHistoryCursors,
): Promise<{ data: FinanceHistoryBatch | null; error: Error | null }> {
  const workerResult = await resolveWorkerProfileId(profileId);
  if (workerResult.error || !workerResult.data) {
    return { data: null, error: workerResult.error ?? new Error('Worker Identity is unavailable.') };
  }

  const includeEarnings = filter === 'all' || filter === 'earnings';
  const includeReceived = filter === 'all' || filter === 'payments' || filter === 'advances' || filter === 'received';

  const earningsPromise = includeEarnings
    ? listWorkerWorkEntries(limit, cursors.earnings, 'lifetime')
    : Promise.resolve({ data: [] as WorkEntry[], count: 0, error: null });

  let receivedQuery = supabase
    .from('worker_finance_received')
    .select(RECEIVED_COLUMNS)
    .eq('worker_profile_id', workerResult.data)
    .is('deleted_at', null)
    .order('received_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);

  if (filter === 'payments' || filter === 'advances') receivedQuery = receivedQuery.eq('entry_type', filter === 'payments' ? 'payment' : 'advance');
  if (cursors.received) receivedQuery = receivedQuery.or(`received_at.lt.${cursors.received.received_at},and(received_at.eq.${cursors.received.received_at},id.lt.${cursors.received.id})`);

  const receivedPromise = includeReceived
    ? receivedQuery.returns<ReceivedRow[]>()
    : Promise.resolve({ data: [] as ReceivedRow[], error: null });

  const [earningsResult, receivedResult] = await Promise.all([earningsPromise, receivedPromise]);
  const firstError = earningsResult.error ?? receivedResult.error;
  if (firstError) return { data: null, error: firstError };

  const earnings = earningsResult.data;
  const received = receivedResult.data?.map(normalizeReceived) ?? [];
  const nextCursors: FinanceHistoryCursors = {
    earnings: earnings.length ? { occurred_at: earnings[earnings.length - 1].occurred_at, id: earnings[earnings.length - 1].id } : cursors.earnings,
    received: received.length ? { received_at: received[received.length - 1].received_at, id: received[received.length - 1].id } : cursors.received,
  };

  return {
    data: {
      earnings,
      received,
      nextCursors,
      hasMore: { earnings: earnings.length === limit, received: received.length === limit },
    },
    error: null,
  };
}

'''
    api_text = api_text.replace(marker, insert + marker)
    api.write_text(api_text)

hook.write_text('''import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCurrentWorkerProfileId } from './useCurrentWorkerProfileId';
import {
  createWorkerFinanceReceived,
  getWorkerFinanceSummary,
  listWorkerFinanceHistoryBatch,
  restoreWorkerFinanceReceived,
  softDeleteWorkerFinanceReceived,
  updateWorkerFinanceReceived,
} from '../api/finance';
import type { FinanceHistoryCursors, FinanceHistoryFilter } from '../api/finance';
import type { FinanceListEntry, FinanceReceivedRecord, FinanceReceivedType, WorkerFinanceSummary } from '../types/finance';

const EMPTY_SUMMARY: WorkerFinanceSummary = { total_earnings: '0', received: '0', remaining: '0' };

type HistorySourceState = {
  cursors: FinanceHistoryCursors;
  buffers: { earnings: FinanceListEntry[]; received: FinanceListEntry[] };
  hasMore: { earnings: boolean; received: boolean };
};

function sortEntries(entries: FinanceListEntry[]) {
  return [...entries].sort((a, b) => {
    const time = new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime();
    return time || b.id.localeCompare(a.id);
  });
}

function consumeHistory(state: HistorySourceState, count: number) {
  const merged = sortEntries([...state.buffers.earnings, ...state.buffers.received]);
  const page = merged.slice(0, count);
  const selectedIds = new Set(page.map((entry) => entry.id));
  state.buffers.earnings = state.buffers.earnings.filter((entry) => !selectedIds.has(entry.id));
  state.buffers.received = state.buffers.received.filter((entry) => !selectedIds.has(entry.id));
  return page;
}

function historyHasMore(state: HistorySourceState) {
  return state.buffers.earnings.length > 0 || state.buffers.received.length > 0 || state.hasMore.earnings || state.hasMore.received;
}

function emptyHistoryState(): HistorySourceState {
  return { cursors: { earnings: null, received: null }, buffers: { earnings: [], received: [] }, hasMore: { earnings: false, received: false } };
}

function toEarningEntry(entry: import('../types/workEntry').WorkEntry): FinanceListEntry {
  return { kind: 'earning', id: `earning:${entry.id}`, amount: entry.total, occurred_at: entry.occurred_at, workEntry: entry };
}

function toReceivedEntry(record: FinanceReceivedRecord): FinanceListEntry {
  return { kind: record.entry_type, id: `received:${record.id}`, amount: record.amount, occurred_at: record.received_at, record };
}

export function useWorkerFinance(filter: FinanceHistoryFilter = 'all') {
  const session = useCurrentWorkerProfileId();
  const [summary, setSummary] = useState<WorkerFinanceSummary>(EMPTY_SUMMARY);
  const [entries, setEntries] = useState<FinanceListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const historyRef = useRef<HistorySourceState>(emptyHistoryState());
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    if (!session.profileId) {
      setSummary(EMPTY_SUMMARY);
      setEntries([]);
      setLoading(false);
      return;
    }
    const requestId = ++requestRef.current;
    setLoading(true);
    setError(null);
    historyRef.current = emptyHistoryState();

    const [summaryResult, historyResult] = await Promise.all([
      getWorkerFinanceSummary(),
      listWorkerFinanceHistoryBatch(session.profileId, filter, 5, historyRef.current.cursors),
    ]);
    if (requestId != requestRef.current) return;

    const firstError = summaryResult.error ?? historyResult.error;
    if (firstError || !historyResult.data) {
      setError(firstError?.message ?? 'Unable to load Finance history.');
      setEntries([]);
      setSummary(EMPTY_SUMMARY);
      setLoading(false);
      return;
    }

    historyRef.current.cursors = historyResult.data.nextCursors;
    historyRef.current.hasMore = historyResult.data.hasMore;
    historyRef.current.buffers.earnings = historyResult.data.earnings.map(toEarningEntry);
    historyRef.current.buffers.received = historyResult.data.received.map(toReceivedEntry);
    setEntries(consumeHistory(historyRef.current, 5));
    setSummary(summaryResult.data ?? EMPTY_SUMMARY);
    setLoading(false);
  }, [filter, session.profileId]);

  useEffect(() => { void load(); }, [load]);

  const loadMoreHistory = useCallback(async () => {
    if (!session.profileId || historyLoadingMore || !historyHasMore(historyRef.current)) return;
    const requestId = requestRef.current;
    setHistoryLoadingMore(true);
    try {
      let page = consumeHistory(historyRef.current, 10);
      if (page.length < 10 && (historyRef.current.hasMore.earnings || historyRef.current.hasMore.received)) {
        const batch = await listWorkerFinanceHistoryBatch(session.profileId, filter, 10, historyRef.current.cursors);
        if (requestId != requestRef.current) return;
        if (batch.error || !batch.data) {
          setError(batch.error?.message ?? 'Unable to load more Finance history.');
          return;
        }
        historyRef.current.cursors = batch.data.nextCursors;
        historyRef.current.hasMore = batch.data.hasMore;
        historyRef.current.buffers.earnings.push(...batch.data.earnings.map(toEarningEntry));
        historyRef.current.buffers.received.push(...batch.data.received.map(toReceivedEntry));
        page = [...page, ...consumeHistory(historyRef.current, 10 - page.length)];
      }
      if (page.length) setEntries((current) => [...current, ...page]);
    } finally {
      if (requestId == requestRef.current) setHistoryLoadingMore(false);
    }
  }, [filter, historyLoadingMore, session.profileId]);

  const addReceived = useCallback(async (type: FinanceReceivedType, amount: string) => {
    if (!session.profileId) return { data: null, error: new Error('Authenticated profile is unavailable.') };
    setSaving(true);
    const result = await createWorkerFinanceReceived(session.profileId, type, amount);
    if (!result.error) await load();
    setSaving(false);
    return result;
  }, [load, session.profileId]);

  const editReceived = useCallback(async (id: string, type: FinanceReceivedType, amount: string) => {
    if (!session.profileId) return { data: null, error: new Error('Authenticated profile is unavailable.') };
    setSaving(true);
    const result = await updateWorkerFinanceReceived(session.profileId, id, type, amount);
    if (!result.error) await load();
    setSaving(false);
    return result;
  }, [load, session.profileId]);

  const removeReceived = useCallback(async (id: string) => {
    if (!session.profileId) return { data: null, error: new Error('Authenticated profile is unavailable.') };
    setSaving(true);
    const result = await softDeleteWorkerFinanceReceived(session.profileId, id);
    if (!result.error) await load();
    setSaving(false);
    return result;
  }, [load, session.profileId]);

  const restoreReceived = useCallback(async (id: string) => {
    if (!session.profileId) return { data: null, error: new Error('Authenticated profile is unavailable.') };
    setSaving(true);
    const result = await restoreWorkerFinanceReceived(session.profileId, id);
    if (!result.error) await load();
    setSaving(false);
    return result;
  }, [load, session.profileId]);

  const hasEntries = entries.length > 0;
  return useMemo(() => ({
    ...session,
    summary,
    entries,
    loading: session.loading || loading,
    historyLoadingMore,
    historyHasMore: historyHasMore(historyRef.current),
    saving,
    error: session.error ?? error,
    hasEntries,
    reload: load,
    loadMoreHistory,
    addReceived,
    editReceived,
    removeReceived,
    restoreReceived,
  }), [session, summary, entries, loading, historyLoadingMore, saving, error, hasEntries, load, loadMoreHistory, addReceived, editReceived, removeReceived, restoreReceived]);
}
''')

text = component.read_text()
text = text.replace("  const finance = useWorkerFinance();\n  const [filter, setFilter] = useState<Filter>('all');\n  const [visibleCount, setVisibleCount] = useState(5);", "  const [filter, setFilter] = useState<Filter>('all');\n  const finance = useWorkerFinance(filter);")
text = text.replace("  useEffect(() => { setVisibleCount(5); }, [filter]);\n\n", "")
text = text.replace("  const displayedEntries = visibleEntries.slice(0, visibleCount);\n  const hasMore = visibleCount < visibleEntries.length;", "  const displayedEntries = visibleEntries;\n  const hasMore = finance.historyHasMore;")
old = "{hasMore && <button type=\"button\" onClick={() => setVisibleCount((count) => count + 5)} style={{ ...button, width: '100%', minHeight: 38, marginTop: 10, background: 'linear-gradient(180deg,#fff,#f3f6fa)', boxShadow: 'inset 0 1px 0 #fff, 0 3px 8px rgba(15,23,42,.08)' }}>Show 5 more</button>}"
new = "{hasMore && <button type=\"button\" onClick={() => void finance.loadMoreHistory()} disabled={finance.historyLoadingMore} style={{ ...button, width: '100%', minHeight: 38, marginTop: 10, background: 'linear-gradient(180deg,#fff,#f3f6fa)', boxShadow: 'inset 0 1px 0 #fff, 0 3px 8px rgba(15,23,42,.08)', opacity: finance.historyLoadingMore ? .7 : 1 }}>{finance.historyLoadingMore ? 'Loading…' : 'Load More'}</button>}"
if old not in text:
    raise SystemExit('Finance Load More control pattern not found')
text = text.replace(old, new)
component.write_text(text)
print('Finance pagination transformation applied.')
