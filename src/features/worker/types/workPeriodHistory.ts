export type WorkerWorkPeriodType = 'day' | 'week' | 'month';

export interface WorkerWorkPeriod {
  period_start: string;
  period_end: string;
  period_total: string;
  entry_count: number;
}

export interface WorkerWorkPeriodPage {
  data: WorkerWorkPeriod[];
  hasMore: boolean;
  error: Error | null;
}

export interface WorkerWorkPeriodCursor {
  period_start: string;
}
