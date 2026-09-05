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

export const CATEGORY_ICON_OPTIONS = ['🍔', '🚗', '🛍️', '🧾', '🎬', '❤️', '🎓', '🏠', '✈️', '👤', '🔁', '💼', '💰', '🎁', '📈', '✨'];

export const CATEGORY_COLOR_OPTIONS = ['#2563eb', '#0f766e', '#7c3aed', '#db2777', '#ea580c', '#ca8a04', '#16a34a', '#475569'];

export function validateCategoryInput(input: { name: string; type: ExpenseCategoryType }): string {
  if (!input.name.trim()) return 'Category name is required.';
  if (input.name.trim().length > 80) return 'Category name must be 80 characters or fewer.';
  if (input.type !== 'expense' && input.type !== 'income') return 'Choose a valid category type.';
  return '';
}

export function categoryTypeLabel(type: ExpenseCategoryType): string {
  return type === 'income' ? 'Income' : 'Expense';
}
