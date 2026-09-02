import { useCallback, useEffect, useRef, useState } from 'react';
import { listWorkerWorkPeriods, MORE_PERIOD_PAGE_SIZE, INITIAL_PERIOD_PAGE_SIZE } from '../api/workPeriodHistory';
import type { WorkerWorkPeriod, WorkerWorkPeriodType } from '../types/workPeriodHistory';

export function useWorkerWorkPeriodHistory(period: WorkerWorkPeriodType) {
  const [periods, setPeriods] = useState<WorkerWorkPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cursorRef = useRef<string | null>(null);
  const requestRef = useRef(0);

  const load = useCallback(async (append: boolean) => {
    if (append && loadingMore) return;
    const requestId = ++requestRef.current;
    if (append) setLoadingMore(true); else setLoading(true);
    setError(null);
    const cursor = append && cursorRef.current ? { period_start: cursorRef.current } : null;
    const result = await listWorkerWorkPeriods(period, cursor, append ? MORE_PERIOD_PAGE_SIZE : INITIAL_PERIOD_PAGE_SIZE);
    if (requestId !== requestRef.current) return;
    if (result.error) {
      setError(result.error.message);
    } else {
      setPeriods((previous) => append ? [...previous, ...result.data] : result.data);
      cursorRef.current = result.data.length ? result.data[result.data.length - 1].period_start : cursorRef.current;
      setHasMore(result.hasMore);
    }
    if (append) setLoadingMore(false); else setLoading(false);
  }, [loadingMore, period]);

  useEffect(() => {
    requestRef.current += 1;
    cursorRef.current = null;
    setPeriods([]);
    setHasMore(false);
    void load(false);
  }, [period]);

  return { periods, loading, loadingMore, hasMore, error, loadMore: () => void load(true), refresh: () => void load(false) };
}
