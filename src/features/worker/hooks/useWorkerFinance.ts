import { useCallback, useEffect, useState } from 'react';
import { listWorkerFinanceHistory, getWorkerFinanceSummary } from '../api/workerFinance';
import type { WorkerFinanceCursor, WorkerFinanceHistoryRow, WorkerFinanceSummary } from '../types/finance';

const INITIAL_PAGE_SIZE = 5;
const MORE_PAGE_SIZE = 10;
const EMPTY_SUMMARY: WorkerFinanceSummary = { earnings: '0', payments: '0', advances: '0', current_balance: '0' };

export function useWorkerFinance(enabled: boolean) {
  const [summary, setSummary] = useState<WorkerFinanceSummary>(EMPTY_SUMMARY);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<WorkerFinanceHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const reloadSummary = useCallback(async () => {
    if (!enabled) return;
    setSummaryLoading(true);
    setSummaryError(null);
    const result = await getWorkerFinanceSummary();
    if (result.error) setSummaryError(result.error.message);
    else setSummary(result.data);
    setSummaryLoading(false);
  }, [enabled]);

  const reloadHistory = useCallback(async () => {
    if (!enabled) return;
    setHistoryLoading(true);
    setHistoryError(null);
    const result = await listWorkerFinanceHistory(INITIAL_PAGE_SIZE);
    if (result.error) {
      setHistoryError(result.error.message);
      setTransactions([]);
      setHasMore(false);
    } else {
      setTransactions(result.data);
      setHasMore(result.hasMore);
    }
    setHistoryLoading(false);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void Promise.all([reloadSummary(), reloadHistory()]);
  }, [enabled, reloadHistory, reloadSummary]);

  const loadMore = useCallback(async () => {
    if (!enabled || historyLoadingMore || !hasMore) return;
    const last = transactions.at(-1);
    if (!last) return;
    const cursor: WorkerFinanceCursor = { occurred_at: last.occurred_at, id: last.id, source_kind: last.source_kind };
    setHistoryLoadingMore(true);
    setHistoryError(null);
    const result = await listWorkerFinanceHistory(MORE_PAGE_SIZE, cursor);
    if (result.error) setHistoryError(result.error.message);
    else {
      setTransactions((current) => [...current, ...result.data]);
      setHasMore(result.hasMore);
    }
    setHistoryLoadingMore(false);
  }, [enabled, hasMore, historyLoadingMore, transactions]);

  return {
    summary,
    summaryLoading,
    summaryError,
    transactions,
    historyLoading,
    historyLoadingMore,
    historyError,
    hasMore,
    loadMore,
    reloadSummary,
    reloadHistory,
  };
}
