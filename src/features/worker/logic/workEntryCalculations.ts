import type { WorkDecimal, WorkerWorkTotals } from '../types/workEntry';

const WORK_TIME_ZONE = 'Asia/Karachi';
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

function karachiDateParts(value: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: WORK_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return { year: get('year'), month: get('month'), day: get('day') };
}

function karachiMidnight(value: Date) {
  const { year, month, day } = karachiDateParts(value);
  return new Date(`${year}-${month}-${day}T00:00:00+05:00`);
}

function addKarachiDays(value: Date, days: number) {
  const result = new Date(value.getTime() + days * 86400000);
  return karachiMidnight(result);
}

function startOfDay(value: Date) {
  return karachiMidnight(value);
}

function startOfWeek(value: Date) {
  const result = startOfDay(value);
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: WORK_TIME_ZONE, weekday: 'short' }).format(result);
  const daysSinceMonday = ({ Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 } as Record<string, number>)[weekday] ?? 0;
  return addKarachiDays(result, -daysSinceMonday);
}

function startOfMonth(value: Date) {
  const { year, month } = karachiDateParts(value);
  return new Date(`${year}-${month}-01T00:00:00+05:00`);
}

export function getWorkerWorkPeriodBounds(now = new Date()) {
  const dayStart = startOfDay(now);
  const dayEnd = addKarachiDays(dayStart, 1);
  const weekStart = startOfWeek(now);
  const weekEnd = addKarachiDays(weekStart, 7);
  const monthStart = startOfMonth(now);
  const nextMonthSeed = new Date(monthStart.getTime() + 32 * 86400000);
  const { year, month } = karachiDateParts(nextMonthSeed);
  const monthEnd = new Date(`${year}-${month}-01T00:00:00+05:00`);
  return {
    dayStart: dayStart.toISOString(), dayEnd: dayEnd.toISOString(),
    weekStart: weekStart.toISOString(), weekEnd: weekEnd.toISOString(),
    monthStart: monthStart.toISOString(), monthEnd: monthEnd.toISOString(),
  };
}

export function getWorkerWorkDayBounds(day: Date) {
  const dayStart = startOfDay(day);
  const dayEnd = addKarachiDays(dayStart, 1);
  return { dayStart: dayStart.toISOString(), dayEnd: dayEnd.toISOString() };
}

export function getWorkerWorkMonthBounds(month: Date) {
  const monthStart = startOfMonth(month);
  const nextMonthSeed = new Date(monthStart.getTime() + 32 * 86400000);
  const { year, month: nextMonth } = karachiDateParts(nextMonthSeed);
  const monthEnd = new Date(`${year}-${nextMonth}-01T00:00:00+05:00`);
  return { monthStart: monthStart.toISOString(), monthEnd: monthEnd.toISOString() };
}

/** Build a Work History week from its local Karachi calendar Monday. */
export function getWorkerWorkWeekBounds(weekStartDate: Date) {
  const weekStart = startOfWeek(weekStartDate);
  const weekEnd = addKarachiDays(weekStart, 7);
  return { weekStart: weekStart.toISOString(), weekEnd: weekEnd.toISOString() };
}

export function getWorkerWorkWeekStart(now = new Date()) {
  return startOfWeek(now);
}

export function normalizeWorkerWorkTotals(value: Partial<Record<keyof WorkerWorkTotals, unknown>> | null | undefined): WorkerWorkTotals {
  const normalize = (entry: unknown) => typeof entry === 'string' ? canonicalizeWorkDecimal(entry) : String(entry ?? '0');
  return {
    daily_total: normalize(value?.daily_total), weekly_total: normalize(value?.weekly_total),
    monthly_total: normalize(value?.monthly_total), lifetime_total: normalize(value?.lifetime_total),
  };
}
