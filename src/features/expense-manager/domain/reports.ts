import type { ExpenseTransactionType } from './overview';

export type ExpenseReportPeriod = 'month';

export interface ExpenseReportSummary {
  currency: string;
  income: number;
  expenses: number;
  transaction_count: number;
}

export interface ExpenseReportCategory {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  currency: string;
  amount: number;
  transaction_count: number;
}

export interface ExpenseReportDailyPoint {
  date: string;
  currency: string;
  amount: number;
  transaction_count: number;
}

export interface ExpenseReportMonthlyPoint {
  month_start: string;
  currency: string;
  income: number;
  expenses: number;
  transaction_count: number;
}

export interface ExpenseReportCategoryTrend {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  currency: string;
  current_amount: number;
  previous_amount: number;
}

export interface ExpenseReportAccountActivity {
  id: string;
  name: string;
  type: string;
  currency: string;
  icon: string | null;
  color: string | null;
  money_in: number;
  money_out: number;
  transfer_in: number;
  transfer_out: number;
}

export interface ExpenseReportBudget {
  id: string;
  category_id: string;
  category_name: string;
  category_icon: string | null;
  category_color: string | null;
  category_archived: boolean;
  budget_amount: number;
  start_date: string;
  end_date: string;
  spent: number;
}

export interface ExpenseReportsData {
  period_start: string;
  period_end: string;
  has_any_transactions: boolean;
  summary: ExpenseReportSummary[];
  category_breakdown: ExpenseReportCategory[];
  daily_spending: ExpenseReportDailyPoint[];
  monthly_trend: ExpenseReportMonthlyPoint[];
  category_trends: ExpenseReportCategoryTrend[];
  account_activity: ExpenseReportAccountActivity[];
  budgets: ExpenseReportBudget[];
}

export function monthBounds(month: string): { start: string; end: string } {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('Choose a valid report month.');
  const [year, monthNumber] = month.split('-').map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    throw new Error('Choose a valid report month.');
  }
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return {
    start: `${year}-${String(monthNumber).padStart(2, '0')}-01`,
    end: `${year}-${String(monthNumber).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  };
}

export function monthValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftMonth(value: string, delta: number): string {
  const [year, month] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function formatMonth(value: string): string {
  const [year, month] = value.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
}

export function parseReportMoney(value: unknown): number {
  const amount = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

export function transactionTypeLabel(type: ExpenseTransactionType): string {
  return type === 'income' ? 'Income' : type === 'expense' ? 'Expense' : 'Transfer';
}
