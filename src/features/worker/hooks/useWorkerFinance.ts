import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCurrentWorkerProfileId } from './useCurrentWorkerProfileId';
import { createWorkerFinanceReceived, getWorkerFinanceSummary, listWorkerFinanceEarnings, listWorkerFinanceReceived, restoreWorkerFinanceReceived, softDeleteWorkerFinanceReceived, updateWorkerFinanceReceived } from '../api/finance';
import type { FinanceListEntry, FinanceReceivedRecord, FinanceReceivedType, WorkerFinanceSummary } from '../types/finance';
import type { WorkHistoryPeriod, WorkHistoryPeriodBounds } from '../api/workEntries';
import type { WorkEntry } from '../types/workEntry';

type View = 'earnings' | 'received';
type Period = 'daily' | 'weekly' | 'monthly';
const EMPTY_SUMMARY: WorkerFinanceSummary = { total_earnings: '0', received: '0', current_balance: '0', advance: '0' };
function periodToApi(period: Period): WorkHistoryPeriod { return period === 'daily' ? 'day' : period === 'weekly' ? 'week' : 'month'; }
function toEarningEntry(entry: WorkEntry): FinanceListEntry { return { kind: 'earning', id: `earning:${entry.id}`, amount: entry.total, occurred_at: entry.occurred_at, workEntry: entry }; }
function toReceivedEntry(record: FinanceReceivedRecord): FinanceListEntry { return { kind: record.entry_type, id: `received:${record.id}`, amount: record.amount, occurred_at: record.received_at, record }; }

export function useWorkerFinance(view: View, period: Period, bounds: WorkHistoryPeriodBounds) {
  const session = useCurrentWorkerProfileId();
  const [summary, setSummary] = useState<WorkerFinanceSummary>(EMPTY_SUMMARY);
  const [entries, setEntries] = useState<FinanceListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [lastDeletedId, setLastDeletedId] = useState<string | null>(null);
  const cursorRef = useRef<{ occurred_at: string; id: string } | null>(null);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    if (!session.profileId) { setSummary(EMPTY_SUMMARY); setEntries([]); setLoading(false); return; }
    const requestId = ++requestRef.current;
    setLoading(true); setError(null); setEntries([]); cursorRef.current = null;
    const [summaryResult, dataResult] = await Promise.all([
      getWorkerFinanceSummary(session.profileId),
      view === 'earnings' ? listWorkerFinanceEarnings(periodToApi(period), 20, null, bounds) : listWorkerFinanceReceived(session.profileId),
    ]);
    if (requestId !== requestRef.current) return;
    if (summaryResult.error || dataResult.error) { setError((summaryResult.error ?? dataResult.error)?.message ?? 'Unable to load Worker Finance.'); setSummary(EMPTY_SUMMARY); setEntries([]); setLoading(false); return; }
    setSummary(summaryResult.data ?? EMPTY_SUMMARY);
    if (view === 'earnings') {
      const result = dataResult as Awaited<ReturnType<typeof listWorkerFinanceEarnings>>;
      setEntries(result.data.map(toEarningEntry)); setHasMore(result.count > result.data.length);
      cursorRef.current = result.data.length ? { occurred_at: result.data[result.data.length - 1].occurred_at, id: result.data[result.data.length - 1].id } : null;
    } else {
      const result = dataResult as Awaited<ReturnType<typeof listWorkerFinanceReceived>>;
      setEntries(result.data.map(toReceivedEntry)); setHasMore(false); cursorRef.current = null;
    }
    setLoading(false);
  }, [bounds, period, session.profileId, view]);

  useEffect(() => { void load(); }, [load]);

  const loadMore = useCallback(async () => {
    if (view !== 'earnings' || !session.profileId || loadingMore || !hasMore || !cursorRef.current) return;
    const requestId = requestRef.current; setLoadingMore(true);
    try {
      const result = await listWorkerFinanceEarnings(periodToApi(period), 20, cursorRef.current, bounds);
      if (requestId !== requestRef.current) return;
      if (result.error) { setError(result.error.message); return; }
      setEntries((current) => [...current, ...result.data.map(toEarningEntry)]); setHasMore(result.count > result.data.length);
      if (result.data.length) cursorRef.current = { occurred_at: result.data[result.data.length - 1].occurred_at, id: result.data[result.data.length - 1].id };
    } finally { if (requestId === requestRef.current) setLoadingMore(false); }
  }, [bounds, hasMore, loadingMore, period, session.profileId, view]);

  const refresh = useCallback(async () => { await load(); }, [load]);
  const addReceived = useCallback(async (type: FinanceReceivedType, amount: string) => { if (!session.profileId) return { data: null, error: new Error('Authenticated profile is unavailable.') }; setSaving(true); const result = await createWorkerFinanceReceived(session.profileId, type, amount); if (!result.error) await refresh(); setSaving(false); return result; }, [refresh, session.profileId]);
  const editReceived = useCallback(async (id: string, type: FinanceReceivedType, amount: string) => { if (!session.profileId) return { data: null, error: new Error('Authenticated profile is unavailable.') }; setSaving(true); const result = await updateWorkerFinanceReceived(session.profileId, id, type, amount); if (!result.error) await refresh(); setSaving(false); return result; }, [refresh, session.profileId]);
  const removeReceived = useCallback(async (id: string) => { if (!session.profileId) return { data: null, error: new Error('Authenticated profile is unavailable.') }; setSaving(true); const result = await softDeleteWorkerFinanceReceived(session.profileId, id); if (!result.error) { setLastDeletedId(id); await refresh(); } setSaving(false); return result; }, [refresh, session.profileId]);
  const restoreReceived = useCallback(async (id: string) => { if (!session.profileId) return { data: null, error: new Error('Authenticated profile is unavailable.') }; setSaving(true); const result = await restoreWorkerFinanceReceived(session.profileId, id); if (!result.error) { setLastDeletedId(null); await refresh(); } setSaving(false); return result; }, [refresh, session.profileId]);

  return useMemo(() => ({ ...session, summary, entries, loading: session.loading || loading, loadingMore, saving, error: session.error ?? error, hasMore, lastDeletedId, loadMore, addReceived, editReceived, removeReceived, restoreReceived, reload: refresh }), [session, summary, entries, loading, loadingMore, saving, error, hasMore, lastDeletedId, loadMore, addReceived, editReceived, removeReceived, restoreReceived, refresh]);
}
