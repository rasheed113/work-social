import { supabase } from '../../../lib/supabase/client';
import type { WorkerWorkPeriod, WorkerWorkPeriodCursor, WorkerWorkPeriodPage, WorkerWorkPeriodType } from '../types/workPeriodHistory';

export const INITIAL_PERIOD_PAGE_SIZE = 5;
export const MORE_PERIOD_PAGE_SIZE = 10;

function getWorkerTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

function normalizePeriod(row: Record<string, unknown>): WorkerWorkPeriod {
  return {
    period_start: String(row.period_start),
    period_end: String(row.period_end),
    period_total: String(row.period_total ?? '0'),
    entry_count: Number(row.entry_count ?? 0),
  };
}

export async function listWorkerWorkPeriods(
  period: WorkerWorkPeriodType,
  cursor: WorkerWorkPeriodCursor | null = null,
  limit = INITIAL_PERIOD_PAGE_SIZE,
): Promise<WorkerWorkPeriodPage> {
  const result = await supabase.rpc('get_worker_work_period_history', {
    p_period: period,
    p_timezone: getWorkerTimezone(),
    p_cursor_start: cursor?.period_start ?? null,
    p_limit: limit,
  });

  const data = (result.data ?? []).map((row: Record<string, unknown>) => normalizePeriod(row));
  const hasMore = data.length > 0 && Boolean((result.data?.[0] as Record<string, unknown> | undefined)?.has_more);
  return { data, hasMore, error: result.error };
}
