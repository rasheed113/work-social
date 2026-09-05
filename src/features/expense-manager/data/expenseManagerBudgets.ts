import { supabase } from '../../../lib/supabase/client';
import type { ExpenseBudgetInput, ExpenseBudgetRecord } from '../domain/budgets';

const BUDGET_SELECT = 'id,category_id,amount,period,start_date,end_date,created_at,updated_at';

interface BudgetRpcRow {
  id: string;
  category_id: string;
  category_name: string;
  category_icon: string | null;
  category_color: string | null;
  category_archived: boolean;
  budget_amount: unknown;
  period: 'monthly';
  start_date: string;
  end_date: string;
  spent: unknown;
}

export async function loadExpenseBudgets(): Promise<ExpenseBudgetRecord[]> {
  const { data, error } = await supabase.rpc('expense_manager_budget_progress');
  if (error) throw error;
  return ((data ?? []) as BudgetRpcRow[]).map((row) => ({
    id: String(row.id),
    category_id: String(row.category_id),
    category_name: String(row.category_name),
    category_icon: row.category_icon == null ? null : String(row.category_icon),
    category_color: row.category_color == null ? null : String(row.category_color),
    category_archived: Boolean(row.category_archived),
    budget_amount: Number(row.budget_amount) || 0,
    period: row.period,
    start_date: String(row.start_date),
    end_date: String(row.end_date),
    spent: Number(row.spent) || 0,
  }));
}

export async function createExpenseBudget(userId: string, input: ExpenseBudgetInput): Promise<void> {
  const { error } = await supabase.from('expense_budgets').insert({
    user_id: userId,
    category_id: input.categoryId,
    amount: input.amount,
    period: input.period,
    start_date: input.startDate,
    end_date: input.endDate,
  });
  if (error) throw error;
}

export async function updateExpenseBudget(userId: string, id: string, input: ExpenseBudgetInput): Promise<void> {
  const { error } = await supabase.from('expense_budgets').update({
    category_id: input.categoryId,
    amount: input.amount,
    period: input.period,
    start_date: input.startDate,
    end_date: input.endDate,
  }).eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

export async function getExpenseBudgetByPeriod(userId: string, categoryId: string, startDate: string, endDate: string, excludeId?: string): Promise<boolean> {
  let query = supabase.from('expense_budgets').select('id', { count: 'exact', head: true })
    .eq('user_id', userId).eq('category_id', categoryId).eq('start_date', startDate).eq('end_date', endDate);
  if (excludeId) query = query.neq('id', excludeId);
  const { count, error } = await query;
  if (error) throw error;
  return (count ?? 0) > 0;
}

export { BUDGET_SELECT };
