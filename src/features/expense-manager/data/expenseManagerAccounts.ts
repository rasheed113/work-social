import { supabase } from '../../../lib/supabase/client';
import type { ExpenseAccountRecord, ExpenseAccountType } from '../domain/accounts';
import { parseAccountMoney } from '../domain/accounts';

interface AccountRpcRow { id?: unknown; name?: unknown; type?: unknown; opening_balance?: unknown; balance?: unknown; currency?: unknown; icon?: unknown; color?: unknown; transaction_count?: unknown; }

function mapAccount(row: AccountRpcRow): ExpenseAccountRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    type: row.type as ExpenseAccountType,
    opening_balance: parseAccountMoney(row.opening_balance),
    balance: parseAccountMoney(row.balance),
    currency: String(row.currency),
    icon: row.icon == null ? null : String(row.icon),
    color: row.color == null ? null : String(row.color),
    transaction_count: Number(row.transaction_count) || 0,
  };
}

export async function loadExpenseAccounts(): Promise<ExpenseAccountRecord[]> {
  const { data, error } = await supabase.rpc('expense_manager_overview', {
    period_start: '2000-01-01',
    period_end: '2099-12-31',
  });
  if (error) throw error;
  const payload = data as { all_accounts?: AccountRpcRow[] } | null;
  if (!payload) throw new Error('Expense Manager account data returned no data.');
  return (payload.all_accounts ?? []).map(mapAccount);
}

export async function createExpenseAccountRecord(userId: string, input: { name: string; type: ExpenseAccountType; openingBalance: number; currency: string; icon?: string | null; color?: string | null }) {
  const { data, error } = await supabase.from('expense_accounts').insert({
    user_id: userId,
    name: input.name.trim(),
    type: input.type,
    opening_balance: input.openingBalance,
    currency: input.currency.trim().toUpperCase(),
    icon: input.icon?.trim() || null,
    color: input.color?.trim() || null,
  }).select('id').single();
  if (error) throw error;
  return data.id as string;
}

export async function updateExpenseAccountRecord(userId: string, id: string, input: { name: string; type: ExpenseAccountType; openingBalance: number; currency: string; icon?: string | null; color?: string | null }) {
  const { data, error } = await supabase.from('expense_accounts').update({
    name: input.name.trim(),
    type: input.type,
    opening_balance: input.openingBalance,
    currency: input.currency.trim().toUpperCase(),
    icon: input.icon?.trim() || null,
    color: input.color?.trim() || null,
  }).eq('id', id).eq('user_id', userId).select('id').single();
  if (error) throw error;
  return data.id as string;
}
