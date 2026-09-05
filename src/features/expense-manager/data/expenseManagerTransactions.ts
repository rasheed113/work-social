import { supabase } from '../../../lib/supabase/client';
import type { ExpenseAccountOption, ExpenseCategoryOption, ExpenseTransactionInput, ExpenseTransactionRecord } from '../domain/transactions';
import { toMoney } from '../domain/transactions';

type TransactionRow = {
  id: string;
  user_id: string;
  type: 'expense' | 'income' | 'transfer';
  amount: number | string;
  account_id: string | null;
  category_id: string | null;
  from_account_id: string | null;
  to_account_id: string | null;
  date: string;
  note: string | null;
  created_at: string;
  updated_at: string;
};

type AccountRow = { id: string; name: string; type: string; currency: string; icon: string | null };
type CategoryRow = { id: string; name: string; type: 'expense' | 'income'; icon: string | null; color: string | null };

export async function loadExpenseTransactionData(userId: string): Promise<{
  transactions: ExpenseTransactionRecord[];
  accounts: ExpenseAccountOption[];
  categories: ExpenseCategoryOption[];
}> {
  const [transactionsResult, accountsResult, categoriesResult] = await Promise.all([
    supabase.from('expense_transactions').select('id,user_id,type,amount,account_id,category_id,from_account_id,to_account_id,date,note,created_at,updated_at').eq('user_id', userId).order('date', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('expense_accounts').select('id,name,type,currency,icon').eq('user_id', userId).order('name', { ascending: true }),
    supabase.from('expense_categories').select('id,name,type,icon,color').eq('user_id', userId).eq('is_archived', false).order('type', { ascending: true }).order('name', { ascending: true }),
  ]);

  if (transactionsResult.error) throw transactionsResult.error;
  if (accountsResult.error) throw accountsResult.error;
  if (categoriesResult.error) throw categoriesResult.error;

  const accounts = (accountsResult.data ?? []) as AccountRow[];
  const categories = (categoriesResult.data ?? []) as CategoryRow[];
  const accountMap = new Map(accounts.map((account) => [account.id, account]));
  const categoryMap = new Map(categories.map((category) => [category.id, category]));

  const transactions = ((transactionsResult.data ?? []) as TransactionRow[]).map((row) => ({
    ...row,
    amount: toMoney(row.amount),
    account_name: row.type === 'transfer'
      ? `${accountMap.get(row.from_account_id ?? '')?.name ?? 'Account'} → ${accountMap.get(row.to_account_id ?? '')?.name ?? 'Account'}`
      : accountMap.get(row.account_id ?? '')?.name ?? null,
    account_currency: accountMap.get(row.account_id ?? '')?.currency ?? accountMap.get(row.from_account_id ?? '')?.currency ?? null,
    category_name: categoryMap.get(row.category_id ?? '')?.name ?? null,
    category_icon: categoryMap.get(row.category_id ?? '')?.icon ?? null,
  }));

  return { transactions, accounts, categories };
}

export async function createExpenseTransaction(userId: string, input: ExpenseTransactionInput) {
  const payload = {
    user_id: userId,
    type: input.type,
    amount: input.amount,
    account_id: input.type === 'transfer' ? null : input.account_id ?? null,
    category_id: input.type === 'transfer' ? null : input.category_id ?? null,
    from_account_id: input.type === 'transfer' ? input.from_account_id ?? null : null,
    to_account_id: input.type === 'transfer' ? input.to_account_id ?? null : null,
    date: input.date,
    note: input.note?.trim() || null,
  };
  const { data, error } = await supabase.from('expense_transactions').insert(payload).select('id').single();
  if (error) throw error;
  return data;
}

export async function updateExpenseTransaction(userId: string, id: string, input: ExpenseTransactionInput) {
  const payload = {
    type: input.type,
    amount: input.amount,
    account_id: input.type === 'transfer' ? null : input.account_id ?? null,
    category_id: input.type === 'transfer' ? null : input.category_id ?? null,
    from_account_id: input.type === 'transfer' ? input.from_account_id ?? null : null,
    to_account_id: input.type === 'transfer' ? input.to_account_id ?? null : null,
    date: input.date,
    note: input.note?.trim() || null,
  };
  const { data, error } = await supabase.from('expense_transactions').update(payload).eq('id', id).eq('user_id', userId).select('id').single();
  if (error) throw error;
  return data;
}

export async function deleteExpenseTransaction(userId: string, id: string) {
  const { error } = await supabase.from('expense_transactions').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

export async function createExpenseAccount(userId: string, input: { name: string; type: string; currency: string }) {
  const { data, error } = await supabase.from('expense_accounts').insert({ user_id: userId, name: input.name.trim(), type: input.type, currency: input.currency.toUpperCase() }).select('id,name,type,currency,icon').single();
  if (error) throw error;
  return data as AccountRow;
}

export async function createExpenseCategory(userId: string, input: { name: string; type: 'expense' | 'income'; icon?: string }) {
  const { data, error } = await supabase.from('expense_categories').insert({ user_id: userId, name: input.name.trim(), type: input.type, icon: input.icon?.trim() || null }).select('id,name,type,icon,color').single();
  if (error) throw error;
  return data as CategoryRow;
}
