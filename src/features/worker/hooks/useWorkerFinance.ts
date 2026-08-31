import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCurrentWorkerProfileId } from './useCurrentWorkerProfileId';
import { createWorkerFinanceReceived, getWorkerFinanceSummary, listWorkerFinanceEarnings, listWorkerFinanceReceived } from '../api/finance';
import type { FinanceListEntry, FinanceReceivedType, WorkerFinanceSummary } from '../types/finance';

const EMPTY_SUMMARY: WorkerFinanceSummary = { total_earnings: '0', received: '0', remaining: '0' };

export function useWorkerFinance() {
  const session = useCurrentWorkerProfileId();
  const [summary, setSummary] = useState<WorkerFinanceSummary>(EMPTY_SUMMARY);
  const [entries, setEntries] = useState<FinanceListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session.profileId) {
      setSummary(EMPTY_SUMMARY);
      setEntries([]);
      return;
    }
    setLoading(true);
    setError(null);
    const [earningsResult, receivedResult, summaryResult] = await Promise.all([
      listWorkerFinanceEarnings(),
      session.profileId ? listWorkerFinanceReceivedForProfile(session.profileId) : Promise.resolve({ data: [], error: null }),
      getWorkerFinanceSummary(),
    ]);
    const firstError = earningsResult.error ?? receivedResult.error ?? summaryResult.error;
    if (firstError) {
      setError(firstError.message);
      setEntries([]);
      setSummary(EMPTY_SUMMARY);
      setLoading(false);
      return;
    }
    const nextEntries: FinanceListEntry[] = [
      ...earningsResult.data.map((entry) => ({ kind: 'earning' as const, id: `earning:${entry.id}`, amount: entry.total, occurred_at: entry.occurred_at, workEntry: entry })),
      ...receivedResult.data.map((record) => ({ kind: record.entry_type, id: `received:${record.id}`, amount: record.amount, occurred_at: record.received_at, record })),
    ];
    nextEntries.sort((a, b) => {
      const time = new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime();
      return time || b.id.localeCompare(a.id);
    });
    setEntries(nextEntries);
    setSummary(summaryResult.data);
    setLoading(false);
  }, [session.profileId]);

  useEffect(() => { void load(); }, [load]);

  const addReceived = useCallback(async (type: FinanceReceivedType, amount: string) => {
    if (!session.profileId) return { data: null, error: new Error('Authenticated profile is unavailable.') };
    setSaving(true);
    setError(null);
    const result = await createWorkerFinanceReceived(session.profileId, type, amount);
    if (result.error) setError(result.error.message);
    else await load();
    setSaving(false);
    return result;
  }, [load, session.profileId]);

  const hasEntries = entries.length > 0;
  const reload = load;
  return useMemo(() => ({ ...session, summary, entries, loading: session.loading || loading, saving, error: session.error ?? error, hasEntries, reload, addReceived }), [session, summary, entries, loading, saving, error, hasEntries, reload, addReceived]);
}

async function listWorkerFinanceReceivedForProfile(profileId: string) {
  return listWorkerFinanceReceived(profileId);
}
