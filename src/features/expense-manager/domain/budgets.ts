export type ExpenseBudgetPeriod = 'monthly';

export interface ExpenseBudgetRecord {
  id: string;
  category_id: string;
  category_name: string;
  category_icon: string | null;
  category_color: string | null;
  category_archived: boolean;
  budget_amount: number;
  period: ExpenseBudgetPeriod;
  start_date: string;
  end_date: string;
  spent: number;
}

export interface ExpenseBudgetInput {
  categoryId: string;
  amount: number;
  period: ExpenseBudgetPeriod;
  startDate: string;
  endDate: string;
}

export function monthBounds(month: string): { startDate: string; endDate: string } {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('Choose a valid budget month.');
  const [year, monthNumber] = month.split('-').map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    throw new Error('Choose a valid budget month.');
  }
  const end = new Date(Date.UTC(year, monthNumber, 0));
  return {
    startDate: `${year}-${String(monthNumber).padStart(2, '0')}-01`,
    endDate: `${year}-${String(monthNumber).padStart(2, '0')}-${String(end.getUTCDate()).padStart(2, '0')}`,
  };
}

export function monthValue(dateString: string): string {
  return dateString.slice(0, 7);
}

export function validateBudgetInput(input: ExpenseBudgetInput): string {
  if (!input.categoryId) return 'Choose an expense category.';
  if (!Number.isFinite(input.amount) || input.amount <= 0) return 'Budget limit must be greater than zero.';
  if (input.period !== 'monthly') return 'Monthly budgets are the supported budget period.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(input.endDate)) {
    return 'Choose a valid budget month.';
  }
  if (input.endDate < input.startDate) return 'Budget end date must be after its start date.';
  return '';
}

export function budgetRatio(spent: number, limit: number): number {
  if (limit <= 0) return 0;
  return spent / limit;
}

export function budgetRemaining(spent: number, limit: number): number {
  return limit - spent;
}

export function budgetState(spent: number, limit: number): 'Healthy' | 'Approaching Limit' | 'Exceeded' {
  if (limit <= 0 || spent > limit) return 'Exceeded';
  if (spent / limit >= 0.8) return 'Approaching Limit';
  return 'Healthy';
}
