import { supabase } from '../../../lib/supabase/client';
import type { ExpenseBudgetRecord } from '../domain/budgets';
import type {
  ExpenseReportAccountActivity,
  ExpenseReportCategory,
  ExpenseReportCategoryTrend,
  ExpenseReportDailyPoint,
  ExpenseReportMonthlyPoint,
  ExpenseReportSummary,
  ExpenseReportsData,
} from '../domain/reports';
import { parseReportMoney } from '../domain/reports';

type ReportRpcRow = {
  period_start: string;
  period_end: string;
  has_any_transactions: boolean;
  summary: Array<Record<string, unknown>> | null;
  category_breakdown: Array<Record<string, unknown>> | null;
  daily_spending: Array<Record<string, unknown>> | null;
  monthly_trend: Array<Record<string, unknown>> | null;
  category_trends: Array<Record<string, unknown>> | null;
  account_activity: Array<Record<string, unknown>> | null;
};

function summary(row: Record<string, unknown>): ExpenseReportSummary {
  return {
    currency: String(row.currency),
    income: parseReportMoney(row.income),
    expenses: parseReportMoney(row.expenses),
    transaction_count: Number(row.transaction_count) || 0,
  };
}

export async function loadExpenseReports(periodStart: string, periodEnd: string): Promise<ExpenseReportsData> {
  const [reportResult, budgetResult] = await Promise.all([
    supabase.rpc('expense_manager_reports', { period_start: periodStart, period_end: periodEnd }),
    supabase.rpc('expense_manager_budget_progress'),
  ]);

  if (reportResult.error) throw reportResult.error;
  if (budgetResult.error) throw budgetResult.error;

  const row = reportResult.data as ReportRpcRow | null;
  if (!row) throw new Error('Expense Manager reports returned no data.');

  const budgets = ((budgetResult.data ?? []) as Array<Record<string, unknown>>)
    .filter((item) => String(item.start_date) <= periodEnd && String(item.end_date) >= periodStart)
    .map((item) => ({
      id: String(item.id),
      category_id: String(item.category_id),
      category_name: String(item.category_name),
      category_icon: item.category_icon == null ? null : String(item.category_icon),
      category_color: item.category_color == null ? null : String(item.category_color),
      category_archived: Boolean(item.category_archived),
      budget_amount: parseReportMoney(item.budget_amount),
      period: 'monthly' as const,
      start_date: String(item.start_date),
      end_date: String(item.end_date),
      spent: parseReportMoney(item.spent),
    })) as ExpenseBudgetRecord[];

  return {
    period_start: String(row.period_start),
    period_end: String(row.period_end),
    has_any_transactions: Boolean(row.has_any_transactions),
    summary: (row.summary ?? []).map(summary),
    category_breakdown: (row.category_breakdown ?? []).map((item) => ({
      id: String(item.id),
      name: String(item.name),
      icon: item.icon == null ? null : String(item.icon),
      color: item.color == null ? null : String(item.color),
      currency: String(item.currency),
      amount: parseReportMoney(item.amount),
      transaction_count: Number(item.transaction_count) || 0,
    })) as ExpenseReportCategory[],
    daily_spending: (row.daily_spending ?? []).map((item) => ({
      date: String(item.date),
      currency: String(item.currency),
      amount: parseReportMoney(item.amount),
      transaction_count: Number(item.transaction_count) || 0,
    })) as ExpenseReportDailyPoint[],
    monthly_trend: (row.monthly_trend ?? []).map((item) => ({
      month_start: String(item.month_start),
      currency: String(item.currency),
      income: parseReportMoney(item.income),
      expenses: parseReportMoney(item.expenses),
      transaction_count: Number(item.transaction_count) || 0,
    })) as ExpenseReportMonthlyPoint[],
    category_trends: (row.category_trends ?? []).map((item) => ({
      id: String(item.id),
      name: String(item.name),
      icon: item.icon == null ? null : String(item.icon),
      color: item.color == null ? null : String(item.color),
      currency: String(item.currency),
      current_amount: parseReportMoney(item.current_amount),
      previous_amount: parseReportMoney(item.previous_amount),
    })) as ExpenseReportCategoryTrend[],
    account_activity: (row.account_activity ?? []).map((item) => ({
      id: String(item.id),
      name: String(item.name),
      type: String(item.type),
      currency: String(item.currency),
      icon: item.icon == null ? null : String(item.icon),
      color: item.color == null ? null : String(item.color),
      money_in: parseReportMoney(item.money_in),
      money_out: parseReportMoney(item.money_out),
      transfer_in: parseReportMoney(item.transfer_in),
      transfer_out: parseReportMoney(item.transfer_out),
    })) as ExpenseReportAccountActivity[],
    budgets,
  };
}
