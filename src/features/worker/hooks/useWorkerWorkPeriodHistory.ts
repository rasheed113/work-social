import { useCallback, useEffect, useMemo, useState } from 'react';
import { getWorkerWorkPeriodHistory } from '../api/workEntries';
import type { WorkerWorkPeriod, WorkerWorkPeriodHistoryRow } from '../api/workEntries';

const INITIAL_PAGE_SIZE = 5;
const MORE_PAGE_SIZE = 10;

function currentTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function useWorkerWorkPeriodHistory(period: WorkerWorkPeriod, enabled = true) {
  const timezone = useMemo(currentTimezone, []);
  const [periods, setPeriods] = useState<WorkerWorkPeriodHistoryRow[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (append = false) => {
    if (!enabled || (append && loadingMore)) return;
    setError(null);
    if (append) setLoadingMore(true); else setLoading(true);
    const cursor = append && periods.length ? periods[periods.length - 1].period_start : null;
    const limit = append ? MORE_PAGE_SIZE : INITIAL_PAGE_SIZE;
    const result = await getWorkerWorkPeriodHistory(period, timezone, cursor, limit);
    if (result.error) {
      setError(result.error.message);
    } else {
      const next = append ? [...periods, ...result.data] : result.data;
      setPeriods(next);
      setHasMore(result.data.some((row) => row.has_more) || result.data.length === limit);
    }
    if (append) setLoadingMore(false); else setLoading(false);
  }, [enabled, loadingMore, period, periods, timezone]);

  useEffect(() => {
    setPeriods([]);
    setHasMore(false);
    setError(null);
    if (!enabled) {
      setLoading(false);
      return;
    }
    void load(false);
  }, [enabled, period]);

  return {
    periods,
    loading,
    loadingMore,
    hasMore,
    error,
    loadMore: () => load(true),
    timezone,
  };
}
