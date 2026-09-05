import { supabase } from '../../../lib/supabase/client';
import type { ExpenseCategoryRecord, ExpenseCategoryType } from '../domain/categories';

const CATEGORY_SELECT = 'id,user_id,name,type,icon,color,is_default,is_archived,created_at,updated_at';

export async function loadExpenseCategories(userId: string, includeArchived = false): Promise<ExpenseCategoryRecord[]> {
  let query = supabase.from('expense_categories').select(CATEGORY_SELECT).eq('user_id', userId).order('type', { ascending: true }).order('name', { ascending: true });
  if (!includeArchived) query = query.eq('is_archived', false);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ExpenseCategoryRecord[];
}

export async function loadExpenseCategoryUsage(userId: string): Promise<Record<string, { transactionCount: number; totalAmount: number }>> {
  const { data, error } = await supabase.from('expense_transactions').select('category_id,amount').eq('user_id', userId).not('category_id', 'is', null);
  if (error) throw error;
  return (data ?? []).reduce<Record<string, { transactionCount: number; totalAmount: number }>>((result, row) => {
    const categoryId = row.category_id as string;
    const current = result[categoryId] ?? { transactionCount: 0, totalAmount: 0 };
    current.transactionCount += 1;
    current.totalAmount += Number(row.amount) || 0;
    result[categoryId] = current;
    return result;
  }, {});
}

export async function getExpenseCategoryUsage(userId: string, id: string): Promise<number> {
  const { count, error } = await supabase.from('expense_transactions').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('category_id', id);
  if (error) throw error;
  return count ?? 0;
}

export async function createExpenseCategoryRecord(userId: string, input: { name: string; type: ExpenseCategoryType; icon: string; color: string }) {
  const { data, error } = await supabase.from('expense_categories').insert({ user_id: userId, name: input.name.trim(), type: input.type, icon: input.icon || null, color: input.color || null }).select(CATEGORY_SELECT).single();
  if (error) throw error;
  return data as ExpenseCategoryRecord;
}

export async function updateExpenseCategoryRecord(userId: string, id: string, input: { name: string; type: ExpenseCategoryType; icon: string; color: string }) {
  const { data, error } = await supabase.from('expense_categories').update({ name: input.name.trim(), type: input.type, icon: input.icon || null, color: input.color || null }).eq('id', id).eq('user_id', userId).select(CATEGORY_SELECT).single();
  if (error) throw error;
  return data as ExpenseCategoryRecord;
}

export async function archiveExpenseCategory(userId: string, id: string) {
  const { data, error } = await supabase.from('expense_categories').update({ is_archived: true }).eq('id', id).eq('user_id', userId).select('id,is_archived').single();
  if (error) throw error;
  return data as { id: string; is_archived: boolean };
}
