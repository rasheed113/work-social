import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCurrentWorkerProfileId } from './useCurrentWorkerProfileId';
import {
  createWorkerFinanceReceived,
  listWorkerFinanceEarnings,
  listWorkerFinanceReceived,
  restoreWorkerFinanceReceived,
  softDeleteWorkerFinanceReceived,
  updateWorkerFinanceReceived,
} from '../api/finance';
import { canonicalizeWorkDecimal } from '../logic/workEntryCalculations';
import type { FinanceListEntry, FinanceReceivedType, WorkerFinanceSummary } from '../types/finance';

const EMPTY_SUMMARY: WorkerFinanceSummary = { total_earnings: '0', received: '0', remaining: '0' };

function parseAmount(value: string): bigint {
  const normalized = canonicalizeWorkDecimal(value);
  const [integerPart, fractionPart = ''] = normalized.split('.');
  return BigInt(integerPart) * 10000n + BigInt((fractionPart + '0000').slice(0, 4));
}

function formatAmount(value: bigint): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const integerPart = absolute / 10000n;
  const fractionPart = (absolute % 10000n).toString().padStart(4, '0').replace(/0+$/, '');
  const result = fractionPart ? `${integerPart}.${fractionPart}` : integerPart.toString();
  return negative ? `-${result}` : result;
}

function sumAmounts(values: string[]): string {
  return formatAmount(values.reduce((total, value) => total + parseAmount(value), 0n));
}

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
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const [earningsResult, receivedResult] = await Promise.all([
      listWorkerFinanceEarnings(),
      listWorkerFinanceReceived(session.profileId),
    ]);
    const firstError = earningsResult.error ?? receivedResult.error;
    if (firstError) {
      setError(firstError.message);
      setEntries([]);
      setSummary(EMPTY_SUMMARY);
      setLoading(false);
      return;
    }

    const totalEarnings = sumAmounts(earningsResult.data.map((entry) => entry.total));
    const received = sumAmounts(receivedResult.data.map((record) => record.amount));
    const remaining = formatAmount(parseAmount(totalEarnings) - parseAmount(received));
    const nextEntries: FinanceListEntry[] = [
      ...earningsResult.data.map((entry) => ({ kind: 'earning' as const, id: `earning:${entry.id}`, amount: entry.total, occurred_at: entry.occurred_at, workEntry: entry })),
      ...receivedResult.data.map((record) => ({ kind: record.entry_type, id: `received:${record.id}`, amount: record.amount, occurred_at: record.received_at, record })),
    ];
    nextEntries.sort((a, b) => {
      const time = new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime();
      return time || b.id.localeCompare(a.id);
    });
    setEntries(nextEntries);
    setSummary({ total_earnings: totalEarnings, received, remaining });
    setLoading(false);
  }, [session.profileId]);

  useEffect(() => { void load(); }, [load]);

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
  const reload = load;
  return useMemo(() => ({
    ...session,
    summary,
    entries,
    loading: session.loading || loading,
    saving,
    error: session.error ?? error,
    hasEntries,
    reload,
    addReceived,
    editReceived,
    removeReceived,
    restoreReceived,
  }), [session, summary, entries, loading, saving, error, hasEntries, reload, addReceived, editReceived, removeReceived, restoreReceived]);
}
