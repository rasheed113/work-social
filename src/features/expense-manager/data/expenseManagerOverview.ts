import { supabase } from '../../../lib/supabase/client';
import type { ExpenseOverviewData } from '../domain/overview';
import { parseMoney } from '../domain/overview';

interface ExpenseOverviewRpcRow {
  period_start: string;
  period_end: string;
  income: unknown;
  expenses: unknown;
  transaction_count: unknown;
  net: unknown;
  account_count: unknown;
  currencies: Array<{ currency: string; balance: unknown }> | null;
  period_currencies: Array<{ currency: string; income: unknown; expenses: unknown; transaction_count: unknown }> | null;
  accounts: Array<Record<string, unknown>> | null;
  top_categories: Array<Record<string, unknown>> | null;
  recent_transactions: Array<Record<string, unknown>> | null;
  budgets: Array<Record<string, unknown>> | null;
  has_financial_records: boolean;
}

export async function loadExpenseOverview(periodStart: string, periodEnd: string): Promise<ExpenseOverviewData> {
  const { data, error } = await supabase.rpc('expense_manager_overview', {
    period_start: periodStart,
    period_end: periodEnd,
  });

  if (error) throw error;

  const row = data as ExpenseOverviewRpcRow | null;
  if (!row) throw new Error('Expense Manager overview returned no data.');

  return {
    period_start: row.period_start,
    period_end: row.period_end,
    income: parseMoney(row.income),
    expenses: parseMoney(row.expenses),
    transaction_count: Number(row.transaction_count) || 0,
    net: parseMoney(row.net),
    account_count: Number(row.account_count) || 0,
    currencies: (row.currencies ?? []).map((item) => ({ currency: item.currency, balance: parseMoney(item.balance) })),
    period_currencies: (row.period_currencies ?? []).map((item) => ({
      currency: item.currency,
      income: parseMoney(item.income),
      expenses: parseMoney(item.expenses),
      transaction_count: Number(item.transaction_count) || 0,
    })),
    accounts: (row.accounts ?? []).map((item) => ({
      id: String(item.id),
      name: String(item.name),
      type: String(item.type),
      currency: String(item.currency),
      icon: item.icon == null ? null : String(item.icon),
      color: item.color == null ? null : String(item.color),
      balance: parseMoney(item.balance),
    })),
    top_categories: (row.top_categories ?? []).map((item) => ({
      id: String(item.id),
      name: String(item.name),
      icon: item.icon == null ? null : String(item.icon),
      color: item.color == null ? null : String(item.color),
      currency: String(item.currency),
      amount: parseMoney(item.amount),
      transaction_count: Number(item.transaction_count) || 0,
    })),
    recent_transactions: (row.recent_transactions ?? []).map((item) => ({
      id: String(item.id),
      type: item.type as 'expense' | 'income' | 'transfer',
      amount: parseMoney(item.amount),
      date: String(item.date),
      note: item.note == null ? null : String(item.note),
      category_name: item.category_name == null ? null : String(item.category_name),
      category_icon: item.category_icon == null ? null : String(item.category_icon),
      currency: item.currency == null ? null : String(item.currency),
      display_account: item.display_account == null ? null : String(item.display_account),
    })),
    budgets: (row.budgets ?? []).map((item) => ({
      id: String(item.id),
      category_id: String(item.category_id),
      category_name: String(item.category_name),
      budget_amount: parseMoney(item.budget_amount),
      start_date: String(item.start_date),
      end_date: String(item.end_date),
      spent: parseMoney(item.spent),
    })),
    has_financial_records: Boolean(row.has_financial_records),
  };
}
