export type ExpenseAccountType = 'cash' | 'bank' | 'wallet' | 'savings' | 'credit_card' | 'other';

export interface ExpenseAccountRecord {
  id: string;
  name: string;
  type: ExpenseAccountType;
  opening_balance: number;
  balance: number;
  currency: string;
  icon: string | null;
  color: string | null;
  transaction_count: number;
}

export const EXPENSE_ACCOUNT_TYPES: Array<{ value: ExpenseAccountType; label: string; icon: string }> = [
  { value: 'cash', label: 'Cash', icon: '💵' },
  { value: 'bank', label: 'Bank Account', icon: '🏦' },
  { value: 'wallet', label: 'Mobile Wallet', icon: '📱' },
  { value: 'savings', label: 'Savings', icon: '🐷' },
  { value: 'credit_card', label: 'Credit Card', icon: '💳' },
  { value: 'other', label: 'Other', icon: '◈' },
];

export function accountTypeLabel(type: string): string {
  return EXPENSE_ACCOUNT_TYPES.find((item) => item.value === type)?.label ?? 'Other';
}

export function accountTypeIcon(type: string): string {
  return EXPENSE_ACCOUNT_TYPES.find((item) => item.value === type)?.icon ?? '◈';
}

export function parseAccountMoney(value: unknown): number {
  const amount = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(amount) ? Math.round((amount + Number.EPSILON) * 100) / 100 : 0;
}

export function validateAccountInput(input: { name: string; type: string; openingBalance: string; currency: string }): string | null {
  if (!input.name.trim()) return 'Account name is required.';
  if (input.name.trim().length > 80) return 'Account name must be 80 characters or fewer.';
  if (!EXPENSE_ACCOUNT_TYPES.some((item) => item.value === input.type)) return 'Choose a valid account type.';
  if (!/^[A-Z]{3}$/.test(input.currency.trim().toUpperCase())) return 'Currency must be a valid 3-letter code.';
  if (input.openingBalance.trim() !== '' && !/^-?(?:\d+\.?\d*|\.\d+)$/.test(input.openingBalance.trim())) return 'Opening balance must be a valid number.';
  const openingBalance = Number(input.openingBalance || 0);
  if (!Number.isFinite(openingBalance) || Math.abs(openingBalance) > 999999999999.99) return 'Opening balance is outside the supported range.';
  return null;
}
