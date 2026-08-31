import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
    if (requestId !== requestRef.current) return;

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
        if (requestId !== requestRef.current) return;
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
      if (requestId === requestRef.current) setHistoryLoadingMore(false);
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
