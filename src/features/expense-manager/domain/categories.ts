export type ExpenseCategoryType = 'expense' | 'income';

export interface ExpenseCategoryRecord {
  id: string;
  user_id: string;
  name: string;
  type: ExpenseCategoryType;
  icon: string | null;
  color: string | null;
  is_default: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export const EXPENSE_CATEGORY_TYPES: Array<{ value: ExpenseCategoryType; label: string; icon: string }> = [
  { value: 'expense', label: 'Expense', icon: '↘' },
  { value: 'income', label: 'Income', icon: '↗' },
];

export const DEFAULT_EXPENSE_CATEGORIES: Array<{ name: string; type: ExpenseCategoryType; icon: string; color: string }> = [
  { name: 'Housing & Rent', type: 'expense', icon: '🏠', color: '#2563eb' },
  { name: 'Utilities', type: 'expense', icon: '💡', color: '#0f766e' },
  { name: 'Groceries', type: 'expense', icon: '🛒', color: '#16a34a' },
  { name: 'Dining & Restaurants', type: 'expense', icon: '🍔', color: '#ea580c' },
  { name: 'Transportation', type: 'expense', icon: '🚗', color: '#7c3aed' },
  { name: 'Fuel', type: 'expense', icon: '⛽', color: '#ca8a04' },
  { name: 'Shopping', type: 'expense', icon: '🛍️', color: '#db2777' },
  { name: 'Health & Medical', type: 'expense', icon: '❤️', color: '#dc2626' },
  { name: 'Education', type: 'expense', icon: '🎓', color: '#2563eb' },
  { name: 'Travel', type: 'expense', icon: '✈️', color: '#0f766e' },
  { name: 'Entertainment', type: 'expense', icon: '🎬', color: '#7c3aed' },
  { name: 'Subscriptions', type: 'expense', icon: '🔁', color: '#db2777' },
  { name: 'Personal Care', type: 'expense', icon: '✨', color: '#ea580c' },
  { name: 'Family & Children', type: 'expense', icon: '👨‍👩‍👧', color: '#ca8a04' },
  { name: 'Work & Business', type: 'expense', icon: '💼', color: '#475569' },
  { name: 'Gifts & Donations', type: 'expense', icon: '🎁', color: '#db2777' },
  { name: 'Taxes & Fees', type: 'expense', icon: '🧾', color: '#475569' },
  { name: 'Insurance', type: 'expense', icon: '🛡️', color: '#0f766e' },
  { name: 'Other Expense', type: 'expense', icon: '◈', color: '#475569' },
  { name: 'Salary', type: 'income', icon: '💼', color: '#16a34a' },
  { name: 'Freelance & Business', type: 'income', icon: '📈', color: '#2563eb' },
  { name: 'Bonus', type: 'income', icon: '🎁', color: '#ca8a04' },
  { name: 'Interest & Dividends', type: 'income', icon: '💰', color: '#0f766e' },
  { name: 'Refunds', type: 'income', icon: '↩️', color: '#7c3aed' },
  { name: 'Gifts Received', type: 'income', icon: '🎁', color: '#db2777' },
  { name: 'Other Income', type: 'income', icon: '✨', color: '#475569' },
];

export const CATEGORY_ICON_OPTIONS = ['🍔', '🚗', '🛍️', '🧾', '🎬', '❤️', '🎓', '🏠', '✈️', '👤', '🔁', '💼', '💰', '🎁', '📈', '✨', '🛒', '💡', '⛽', '🛡️', '◈', '↩️', '👨‍👩‍👧'];

export const CATEGORY_COLOR_OPTIONS = ['#2563eb', '#0f766e', '#7c3aed', '#db2777', '#ea580c', '#ca8a04', '#16a34a', '#475569', '#dc2626'];

export function validateCategoryInput(input: { name: string; type: ExpenseCategoryType }): string {
  if (!input.name.trim()) return 'Category name is required.';
  if (input.name.trim().length > 80) return 'Category name must be 80 characters or fewer.';
  if (input.type !== 'expense' && input.type !== 'income') return 'Choose a valid category type.';
  return '';
}

export function categoryTypeLabel(type: ExpenseCategoryType): string {
  return type === 'income' ? 'Income' : 'Expense';
}
