import { supabase } from '../../../lib/supabase/client';
import { getWorkerProfile } from './workerProfile';
import { listWorkerWorkEntries } from './workEntries';
import { canonicalizeWorkDecimal } from '../logic/workEntryCalculations';
import type { FinanceReceivedRecord, FinanceReceivedType } from '../types/finance';
import type { WorkEntry } from '../types/workEntry';

const RECEIVED_COLUMNS = 'id, worker_profile_id, entry_type, amount, received_at, created_at, deleted_at';

type ReceivedRow = Omit<FinanceReceivedRecord, 'amount'> & { amount: string | number };

function normalizeReceived(row: ReceivedRow): FinanceReceivedRecord {
  return { ...row, amount: canonicalizeWorkDecimal(String(row.amount)) };
}

async function resolveWorkerProfileId(profileId: string) {
  const workerResult = await getWorkerProfile(profileId);
  if (workerResult.error) return { data: null, error: workerResult.error };
  const workerProfileId = workerResult.data?.id;
  if (!workerProfileId) {
    return { data: null, error: new Error('Set up Work Identity before using Finance.') };
  }
  return { data: workerProfileId, error: null };
}

export async function listWorkerFinanceEarnings(): Promise<{ data: WorkEntry[]; error: Error | null }> {
  const entries: WorkEntry[] = [];
  let cursor: { occurred_at: string; id: string } | null = null;

  for (;;) {
    const result = await listWorkerWorkEntries(100, cursor, 'lifetime');
    if (result.error) return { data: [], error: result.error };
    entries.push(...result.data);
    if (result.data.length < 100) break;
    const last = result.data[result.data.length - 1];
    cursor = { occurred_at: last.occurred_at, id: last.id };
  }

  return { data: entries, error: null };
}

export type FinanceHistoryFilter = 'all' | 'earnings' | 'payments' | 'advances' | 'received';

export interface FinanceReceivedCursor {
  received_at: string;
  id: string;
}

export interface FinanceHistoryCursors {
  earnings: { occurred_at: string; id: string } | null;
  received: FinanceReceivedCursor | null;
}

export interface FinanceHistoryBatch {
  earnings: WorkEntry[];
  received: FinanceReceivedRecord[];
  nextCursors: FinanceHistoryCursors;
  hasMore: { earnings: boolean; received: boolean };
}

export async function getWorkerFinanceSummary() {
  const result = await supabase.rpc('get_worker_finance_summary');
  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  return {
    data: row
      ? {
          total_earnings: canonicalizeWorkDecimal(String(row.total_earnings ?? 0)),
          received: canonicalizeWorkDecimal(String(row.received ?? 0)),
          remaining: canonicalizeWorkDecimal(String(row.remaining ?? 0)),
        }
      : null,
    error: result.error,
  };
}

export async function listWorkerFinanceHistoryBatch(
  profileId: string,
  filter: FinanceHistoryFilter,
  limit: number,
  cursors: FinanceHistoryCursors,
): Promise<{ data: FinanceHistoryBatch | null; error: Error | null }> {
  const workerResult = await resolveWorkerProfileId(profileId);
  if (workerResult.error || !workerResult.data) {
    return { data: null, error: workerResult.error ?? new Error('Worker Identity is unavailable.') };
  }

  const includeEarnings = filter === 'all' || filter === 'earnings';
  const includeReceived = filter === 'all' || filter === 'payments' || filter === 'advances' || filter === 'received';

  const earningsPromise = includeEarnings
    ? listWorkerWorkEntries(limit, cursors.earnings, 'lifetime')
    : Promise.resolve({ data: [] as WorkEntry[], count: 0, error: null });

  let receivedQuery = supabase
    .from('worker_finance_received')
    .select(RECEIVED_COLUMNS)
    .eq('worker_profile_id', workerResult.data)
    .is('deleted_at', null)
    .order('received_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);

  if (filter === 'payments' || filter === 'advances') receivedQuery = receivedQuery.eq('entry_type', filter === 'payments' ? 'payment' : 'advance');
  if (cursors.received) receivedQuery = receivedQuery.or(`received_at.lt.${cursors.received.received_at},and(received_at.eq.${cursors.received.received_at},id.lt.${cursors.received.id})`);

  const receivedPromise = includeReceived
    ? receivedQuery.returns<ReceivedRow[]>()
    : Promise.resolve({ data: [] as ReceivedRow[], error: null });

  const [earningsResult, receivedResult] = await Promise.all([earningsPromise, receivedPromise]);
  const firstError = earningsResult.error ?? receivedResult.error;
  if (firstError) return { data: null, error: firstError };

  const earnings = earningsResult.data;
  const received = receivedResult.data?.map(normalizeReceived) ?? [];
  const nextCursors: FinanceHistoryCursors = {
    earnings: earnings.length ? { occurred_at: earnings[earnings.length - 1].occurred_at, id: earnings[earnings.length - 1].id } : cursors.earnings,
    received: received.length ? { received_at: received[received.length - 1].received_at, id: received[received.length - 1].id } : cursors.received,
  };

  return {
    data: {
      earnings,
      received,
      nextCursors,
      hasMore: { earnings: earnings.length === limit, received: received.length === limit },
    },
    error: null,
  };
}

export async function listWorkerFinanceReceived(profileId: string) {
  const workerResult = await resolveWorkerProfileId(profileId);
  if (workerResult.error || !workerResult.data) {
    return { data: [], error: workerResult.error ?? new Error('Worker Identity is unavailable.') };
  }

  const result = await supabase
    .from('worker_finance_received')
    .select(RECEIVED_COLUMNS)
    .eq('worker_profile_id', workerResult.data)
    .is('deleted_at', null)
    .order('received_at', { ascending: false })
    .order('id', { ascending: false })
    .returns<ReceivedRow[]>();
  return { data: result.data?.map(normalizeReceived) ?? [], error: result.error };
}

export async function createWorkerFinanceReceived(profileId: string, entryType: FinanceReceivedType, amount: string) {
  const workerResult = await resolveWorkerProfileId(profileId);
  if (workerResult.error || !workerResult.data) {
    return { data: null, error: workerResult.error ?? new Error('Worker Identity is unavailable.') };
  }

  const result = await supabase
    .from('worker_finance_received')
    .insert({ worker_profile_id: workerResult.data, entry_type: entryType, amount: canonicalizeWorkDecimal(amount) })
    .select(RECEIVED_COLUMNS)
    .single<ReceivedRow>();
  return { data: result.data ? normalizeReceived(result.data) : null, error: result.error };
}

export async function updateWorkerFinanceReceived(profileId: string, id: string, entryType: FinanceReceivedType, amount: string) {
  const workerResult = await resolveWorkerProfileId(profileId);
  if (workerResult.error || !workerResult.data) {
    return { data: null, error: workerResult.error ?? new Error('Worker Identity is unavailable.') };
  }

  const result = await supabase
    .from('worker_finance_received')
    .update({ entry_type: entryType, amount: canonicalizeWorkDecimal(amount) })
    .eq('id', id)
    .eq('worker_profile_id', workerResult.data)
    .is('deleted_at', null)
    .select(RECEIVED_COLUMNS)
    .single<ReceivedRow>();
  return { data: result.data ? normalizeReceived(result.data) : null, error: result.error };
}

export async function softDeleteWorkerFinanceReceived(profileId: string, id: string) {
  const workerResult = await resolveWorkerProfileId(profileId);
  if (workerResult.error || !workerResult.data) {
    return { data: null, error: workerResult.error ?? new Error('Worker Identity is unavailable.') };
  }

  const result = await supabase
    .from('worker_finance_received')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('worker_profile_id', workerResult.data)
    .is('deleted_at', null)
    .select(RECEIVED_COLUMNS)
    .single<ReceivedRow>();
  return { data: result.data ? normalizeReceived(result.data) : null, error: result.error };
}

export async function restoreWorkerFinanceReceived(profileId: string, id: string) {
  const workerResult = await resolveWorkerProfileId(profileId);
  if (workerResult.error || !workerResult.data) {
    return { data: null, error: workerResult.error ?? new Error('Worker Identity is unavailable.') };
  }

  const result = await supabase
    .from('worker_finance_received')
    .update({ deleted_at: null })
    .eq('id', id)
    .eq('worker_profile_id', workerResult.data)
    .not('deleted_at', 'is', null)
    .select(RECEIVED_COLUMNS)
    .single<ReceivedRow>();
  return { data: result.data ? normalizeReceived(result.data) : null, error: result.error };
}
