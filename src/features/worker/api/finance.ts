import { supabase } from '../../../lib/supabase/client';
import { getWorkerProfile } from './workerProfile';
import { listWorkerWorkEntries } from './workEntries';
import { canonicalizeWorkDecimal } from '../logic/workEntryCalculations';
import type { FinanceReceivedRecord, FinanceReceivedType } from '../types/finance';
import type { WorkEntry } from '../types/workEntry';

const RECEIVED_COLUMNS = 'id, worker_profile_id, entry_type, amount, received_at, created_at';

type ReceivedRow = Omit<FinanceReceivedRecord, 'amount'> & { amount: string | number };

function normalizeReceived(row: ReceivedRow): FinanceReceivedRecord {
  return { ...row, amount: canonicalizeWorkDecimal(String(row.amount)) };
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

export async function listWorkerFinanceReceived(workerProfileId: string) {
  const result = await supabase
    .from('worker_finance_received')
    .select(RECEIVED_COLUMNS)
    .eq('worker_profile_id', workerProfileId)
    .order('received_at', { ascending: false })
    .order('id', { ascending: false })
    .returns<ReceivedRow[]>();
  return { data: result.data?.map(normalizeReceived) ?? [], error: result.error };
}

export async function createWorkerFinanceReceived(profileId: string, entryType: FinanceReceivedType, amount: string) {
  const workerResult = await getWorkerProfile(profileId);
  if (workerResult.error) return { data: null, error: workerResult.error };
  const workerProfileId = workerResult.data?.id;
  if (!workerProfileId) return { data: null, error: new Error('Set up Work Identity before recording a received amount.') };

  const result = await supabase
    .from('worker_finance_received')
    .insert({ worker_profile_id: workerProfileId, entry_type: entryType, amount: canonicalizeWorkDecimal(amount) })
    .select(RECEIVED_COLUMNS)
    .single<ReceivedRow>();
  return { data: result.data ? normalizeReceived(result.data) : null, error: result.error };
}
