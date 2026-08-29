import type { WorkerWorkTotals } from '../types/workEntry';

export function calculateWorkEntryTotal(quantity: number, rate: number) {
  if (!Number.isFinite(quantity) || !Number.isFinite(rate)) return 0;
  return Math.round((quantity * rate + Number.EPSILON) * 10000) / 10000;
}

function startOfDay(value: Date) {
  const result = new Date(value);
  result.setHours(0, 0, 0, 0);
  return result;
}

function startOfWeek(value: Date) {
  const result = startOfDay(value);
  const day = result.getDay();
  const daysSinceMonday = (day + 6) % 7;
  result.setDate(result.getDate() - daysSinceMonday);
  return result;
}

function startOfMonth(value: Date) {
  const result = startOfDay(value);
  result.setDate(1);
  return result;
}

export function getWorkerWorkPeriodBounds(now = new Date()) {
  const dayStart = startOfDay(now);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const weekStart = startOfWeek(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const monthStart = startOfMonth(now);
  const monthEnd = new Date(monthStart);
  monthEnd.setMonth(monthEnd.getMonth() + 1);

  return {
    dayStart: dayStart.toISOString(),
    dayEnd: dayEnd.toISOString(),
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    monthStart: monthStart.toISOString(),
    monthEnd: monthEnd.toISOString(),
  };
}

export function normalizeWorkerWorkTotals(value: Partial<Record<keyof WorkerWorkTotals, unknown>> | null | undefined): WorkerWorkTotals {
  return {
    daily_total: Number(value?.daily_total ?? 0),
    weekly_total: Number(value?.weekly_total ?? 0),
    monthly_total: Number(value?.monthly_total ?? 0),
    lifetime_total: Number(value?.lifetime_total ?? 0),
  };
}
