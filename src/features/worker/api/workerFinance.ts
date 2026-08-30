import { supabase } from '../../../lib/supabase/client';
import { canonicalizeWorkDecimal } from '../logic/workEntryCalculations';
import type {
  WorkerFinanceCursor,
  WorkerFinanceHistoryRow,
  WorkerFinanceSummary,
  WorkerFinanceTransactionType,
} from '../types/finance';

interface FinanceSummaryRow {
  earnings: string | number;
  payments: string | number;
  advances: string | number;
  current_balance: string | number;
}

interface FinanceHistoryRow extends Omit<WorkerFinanceHistoryRow, 'amount' | 'quantity' | 'rate'> {
  amount: string | number;
  quantity: string | number | null;
  rate: string | number | null;
}

export interface WorkerFinanceCreateInput {
  transaction_type: WorkerFinanceTransactionType;
  amount: string;
  occurred_at: string;
  note?: string | null;
}

const IDEMPOTENCY_PREFIX = 'work-social:worker-finance:idempotency:';

function normalize(value: string | number | null | undefined) {
  return canonicalizeWorkDecimal(String(value ?? '0'));
}

function getStableSubmissionKey(input: WorkerFinanceCreateInput) {
  const fingerprint = JSON.stringify([
    input.transaction_type,
    input.amount,
    input.occurred_at,
    input.note?.trim() || null,
  ]);
  const storageKey = `${IDEMPOTENCY_PREFIX}${fingerprint}`;

  try {
    const existing = sessionStorage.getItem(storageKey);
    if (existing) return { storageKey, idempotencyKey: existing };
    const created = crypto.randomUUID();
    sessionStorage.setItem(storageKey, created);
    return { storageKey, idempotencyKey: created };
  } catch {
    return { storageKey: null, idempotencyKey: crypto.randomUUID() };
  }
}

function clearStableSubmissionKey(storageKey: string | null) {
  if (!storageKey) return;
  try {
    sessionStorage.removeItem(storageKey);
  } catch {
    // The persisted server-side transaction remains authoritative.
  }
}

export async function getWorkerFinanceSummary() {
  const result = await supabase.rpc('get_worker_finance_summary');
  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  const data: WorkerFinanceSummary = {
    earnings: normalize((row as FinanceSummaryRow | null | undefined)?.earnings),
    payments: normalize((row as FinanceSummaryRow | null | undefined)?.payments),
    advances: normalize((row as FinanceSummaryRow | null | undefined)?.advances),
    current_balance: normalize((row as FinanceSummaryRow | null | undefined)?.current_balance),
  };
  return { data, error: result.error };
}

export async function createWorkerFinanceTransaction(input: WorkerFinanceCreateInput) {
  const { storageKey, idempotencyKey } = getStableSubmissionKey(input);
  const result = await supabase.rpc('create_worker_finance_transaction', {
    p_transaction_type: input.transaction_type,
    p_amount: input.amount,
    p_occurred_at: input.occurred_at,
    p_note: input.note?.trim() || null,
    p_idempotency_key: idempotencyKey,
  });

  if (!result.error) clearStableSubmissionKey(storageKey);
  return { data: result.data, error: result.error };
}

export async function listWorkerFinanceHistory(limit: number, cursor: WorkerFinanceCursor | null = null) {
  const result = await supabase.rpc('get_worker_finance_history', {
    p_cursor_occurred_at: cursor?.occurred_at ?? null,
    p_cursor_id: cursor?.id ?? null,
    p_cursor_kind: cursor?.source_kind ?? null,
    p_limit: limit,
  });
  const rows = (Array.isArray(result.data) ? result.data : []) as FinanceHistoryRow[];
  const data = rows.map((row) => ({
    ...row,
    amount: normalize(row.amount),
    quantity: row.quantity === null ? null : normalize(row.quantity),
    rate: row.rate === null ? null : normalize(row.rate),
  }));
  return { data, hasMore: data.at(-1)?.has_more ?? false, error: result.error };
}
