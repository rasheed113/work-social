export type ExpenseTransactionType = 'expense' | 'income' | 'transfer';

export interface ExpenseOverviewAccount {
  id: string;
  name: string;
  type: string;
  currency: string;
  icon: string | null;
  color: string | null;
  balance: number;
}

export interface ExpenseOverviewCategory {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  currency: string;
  amount: number;
  transaction_count: number;
}

export interface ExpenseOverviewTransaction {
  id: string;
  type: ExpenseTransactionType;
  amount: number;
  date: string;
  note: string | null;
  category_name: string | null;
  category_icon: string | null;
  currency: string | null;
  display_account: string | null;
}

export interface ExpenseOverviewBudget {
  id: string;
  category_id: string;
  category_name: string;
  budget_amount: number;
  start_date: string;
  end_date: string;
  spent: number;
}

export interface ExpenseOverviewCurrency {
  currency: string;
  balance: number;
}

export interface ExpenseOverviewPeriodCurrency {
  currency: string;
  income: number;
  expenses: number;
  transaction_count: number;
}

export interface ExpenseOverviewData {
  period_start: string;
  period_end: string;
  income: number;
  expenses: number;
  transaction_count: number;
  net: number;
  account_count: number;
  currencies: ExpenseOverviewCurrency[];
  period_currencies: ExpenseOverviewPeriodCurrency[];
  accounts: ExpenseOverviewAccount[];
  top_categories: ExpenseOverviewCategory[];
  recent_transactions: ExpenseOverviewTransaction[];
  budgets: ExpenseOverviewBudget[];
  has_financial_records: boolean;
}

export function getExpensePeriodBounds(anchor: Date): { start: string; end: string } {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return { start: toDateString(start), end: toDateString(end) };
}

export function toDateString(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseMoney(value: unknown): number {
  const amount = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(amount) ? amount : 0;
}
