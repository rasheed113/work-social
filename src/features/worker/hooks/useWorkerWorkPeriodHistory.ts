import { useCallback, useEffect, useState } from 'react';
import { listWorkerWorkPeriods, type WorkHistoryPeriod, type WorkerWorkPeriod, type WorkerWorkPeriodCursor } from '../api/workEntries';

const INITIAL_PAGE_SIZE = 5;
const MORE_PAGE_SIZE = 10;

type Period = Exclude<WorkHistoryPeriod, 'lifetime'>;

export function useWorkerWorkPeriodHistory(period: Period) {
  const [periods, setPeriods] = useState<WorkerWorkPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async (append = false) => {
    if (append && loadingMore) return;
    setActionError(null);
    if (append) setLoadingMore(true); else setLoading(true);
    const cursor: WorkerWorkPeriodCursor | null = append && periods.length
      ? { period_start: periods[periods.length - 1].period_start }
      : null;
    const result = await listWorkerWorkPeriods(append ? MORE_PAGE_SIZE : INITIAL_PAGE_SIZE, cursor, period);
    if (result.error) setActionError(result.error.message);
    else {
      const next = append ? [...periods, ...result.data] : result.data;
      setPeriods(next);
      setHasMore(result.data.length === (append ? MORE_PAGE_SIZE : INITIAL_PAGE_SIZE));
    }
    if (append) setLoadingMore(false); else setLoading(false);
  }, [loadingMore, period, periods]);

  useEffect(() => {
    setPeriods([]);
    setHasMore(false);
    setActionError(null);
    void load(false);
  }, [period]);

  const refresh = useCallback(async () => {
    const result = await listWorkerWorkPeriods(INITIAL_PAGE_SIZE, null, period);
    if (result.error) setActionError(result.error.message);
    else {
      setPeriods(result.data);
      setHasMore(result.data.length === INITIAL_PAGE_SIZE);
    }
  }, [period]);

  return {
    periods,
    loading,
    loadingMore,
    hasMore,
    actionError,
    loadMore: () => load(true),
    refresh,
  };
}
