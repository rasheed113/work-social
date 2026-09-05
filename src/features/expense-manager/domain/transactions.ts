export type ExpenseTransactionType = 'expense' | 'income' | 'transfer';

export interface ExpenseTransactionRecord {
  id: string;
  user_id: string;
  type: ExpenseTransactionType;
  amount: number;
  account_id: string | null;
  category_id: string | null;
  from_account_id: string | null;
  to_account_id: string | null;
  date: string;
  note: string | null;
  created_at: string;
  updated_at: string;
  account_name: string | null;
  account_currency: string | null;
  category_name: string | null;
  category_icon: string | null;
}

export interface ExpenseAccountOption {
  id: string;
  name: string;
  type: string;
  currency: string;
  icon: string | null;
}

export interface ExpenseCategoryOption {
  id: string;
  name: string;
  type: 'expense' | 'income';
  icon: string | null;
  color: string | null;
}

export interface ExpenseTransactionInput {
  type: ExpenseTransactionType;
  amount: number;
  account_id?: string;
  category_id?: string;
  from_account_id?: string;
  to_account_id?: string;
  date: string;
  note?: string;
}

export function toMoney(value: unknown): number {
  const amount = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

export function formatTransactionAmount(type: ExpenseTransactionType, amount: number, currency: string | null): string {
  const prefix = type === 'income' ? '+' : type === 'expense' ? '−' : '';
  const formatted = new Intl.NumberFormat(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount);
  return `${prefix} ${currency ?? ''} ${formatted}`.replace(/\s+/g, ' ').trim();
}

export function transactionSign(type: ExpenseTransactionType): string {
  return type === 'income' ? '+' : type === 'expense' ? '−' : '↔';
}

export function monthBounds(anchor: Date): { start: string; end: string; label: string } {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  const toDate = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  return { start: toDate(start), end: toDate(end), label: new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(start) };
}

export function parseDateInput(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
}
