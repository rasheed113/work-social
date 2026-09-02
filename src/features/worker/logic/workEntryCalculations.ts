import type { WorkDecimal, WorkerWorkTotals } from '../types/workEntry';

const INPUT_DECIMAL_RE = /^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/;
const MAX_INPUT_INTEGER_DIGITS = 14; // numeric(18,4)
const MAX_TOTAL_INTEGER_DIGITS = 20; // numeric(24,4)

export function canonicalizeWorkDecimal(value: string): string {
  const normalized = value.trim();
  if (!INPUT_DECIMAL_RE.test(normalized)) return normalized;
  const [integerPart, fractionPart = ''] = normalized.split('.');
  const canonicalInteger = integerPart.replace(/^0+(?=\d)/, '');
  const canonicalFraction = fractionPart.replace(/0+$/, '');
  return canonicalFraction ? `${canonicalInteger}.${canonicalFraction}` : canonicalInteger;
}

function parseScaled(value: string): bigint | null {
  const normalized = canonicalizeWorkDecimal(value);
  if (!INPUT_DECIMAL_RE.test(normalized)) return null;
  const [integerPart, fractionPart = ''] = normalized.split('.');
  if (integerPart.length > MAX_INPUT_INTEGER_DIGITS) return null;
  return BigInt(integerPart) * 10000n + BigInt((fractionPart + '0000').slice(0, 4));
}

/** Exact Quantity × Rate, rounded to PostgreSQL total scale (4 decimals). */
export function calculateWorkEntryTotal(quantity: WorkDecimal, rate: WorkDecimal): WorkDecimal {
  const quantityScaled = parseScaled(quantity);
  const rateScaled = parseScaled(rate);
  if (quantityScaled === null || rateScaled === null) return '0';
  const rounded = (quantityScaled * rateScaled + 5000n) / 10000n;
  const integerPart = rounded / 10000n;
  if (integerPart.toString().length > MAX_TOTAL_INTEGER_DIGITS) return '0';
  const fractionPart = (rounded % 10000n).toString().padStart(4, '0').replace(/0+$/, '');
  return fractionPart ? `${integerPart}.${fractionPart}` : integerPart.toString();
}

export function formatWorkDecimal(value: WorkDecimal) {
  const [integerPart, fractionPart] = canonicalizeWorkDecimal(value).split('.');
  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fractionPart ? `${grouped}.${fractionPart}` : grouped;
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
    dayStart: dayStart.toISOString(), dayEnd: dayEnd.toISOString(),
    weekStart: weekStart.toISOString(), weekEnd: weekEnd.toISOString(),
    monthStart: monthStart.toISOString(), monthEnd: monthEnd.toISOString(),
  };
}

export function normalizeWorkerWorkTotals(value: Partial<Record<keyof WorkerWorkTotals, unknown>> | null | undefined): WorkerWorkTotals {
  const normalize = (entry: unknown) => typeof entry === 'string' ? canonicalizeWorkDecimal(entry) : String(entry ?? '0');
  return {
    daily_total: normalize(value?.daily_total), weekly_total: normalize(value?.weekly_total),
    monthly_total: normalize(value?.monthly_total), lifetime_total: normalize(value?.lifetime_total),
  };
}
