import { supabase } from '../../../lib/supabase/client';
import type { WorkEntry, WorkEntryInput, WorkEntryUpdateInput, WorkEntryVersion, WorkerWorkTotals } from '../types/workEntry';
import { getWorkerWorkPeriodBounds, normalizeWorkerWorkTotals } from '../logic/workEntryCalculations';

const WORK_ENTRY_COLUMNS = 'id, worker_profile_id, work_context, item_name, size, quantity, rate, total, special_note, occurred_at, created_at, updated_at';

interface WorkEntryRow extends Omit<WorkEntry, 'quantity' | 'rate' | 'total'> { quantity: string | number; rate: string | number; total: string | number; }
interface WorkEntryVersionRow extends Omit<WorkEntryVersion, 'quantity' | 'rate' | 'total' | 'revision_no'> { revision_no: string | number; quantity: string | number; rate: string | number; total: string | number; }

type WorkPeriodBounds = ReturnType<typeof getWorkerWorkPeriodBounds>;

function normalizeEntry(row: WorkEntryRow): WorkEntry { return { ...row, quantity: Number(row.quantity), rate: Number(row.rate), total: Number(row.total) }; }
function normalizeVersion(row: WorkEntryVersionRow): WorkEntryVersion { return { ...row, revision_no: Number(row.revision_no), quantity: Number(row.quantity), rate: Number(row.rate), total: Number(row.total) }; }

export async function listWorkerWorkEntries(limit: number, offset: number) {
  const { data, error, count } = await supabase.from('work_entries').select(WORK_ENTRY_COLUMNS, { count: 'exact' }).order('occurred_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + limit - 1).returns<WorkEntryRow[]>();
  return { data: data?.map(normalizeEntry) ?? [], count: count ?? 0, error };
}

export async function getWorkerWorkEntry(entryId: string) {
  const result = await supabase.from('work_entries').select(WORK_ENTRY_COLUMNS).eq('id', entryId).maybeSingle<WorkEntryRow>();
  return { data: result.data ? normalizeEntry(result.data) : null, error: result.error };
}

export async function getWorkerWorkEntryVersions(entryId: string) {
  const result = await supabase.from('work_entry_versions').select('id, work_entry_id, revision_no, item_name, size, quantity, rate, total, special_note, recorded_at, changed_by').eq('work_entry_id', entryId).order('revision_no', { ascending: true }).returns<WorkEntryVersionRow[]>();
  return { data: result.data?.map(normalizeVersion) ?? [], error: result.error };
}

export async function createWorkerWorkEntry(input: WorkEntryInput) {
  const result = await supabase.from('work_entries').insert({ worker_profile_id: input.worker_profile_id, work_context: 'my_work', item_name: input.item_name.trim(), size: input.size.trim(), quantity: input.quantity, rate: input.rate, special_note: input.special_note?.trim() || null }).select(WORK_ENTRY_COLUMNS).single<WorkEntryRow>();
  return { data: result.data ? normalizeEntry(result.data) : null, error: result.error };
}

export async function updateWorkerWorkEntry(entryId: string, input: WorkEntryUpdateInput) {
  const result = await supabase.from('work_entries').update({ item_name: input.item_name.trim(), size: input.size.trim(), quantity: input.quantity, rate: input.rate, special_note: input.special_note?.trim() || null }).eq('id', entryId).select(WORK_ENTRY_COLUMNS).maybeSingle<WorkEntryRow>();
  return { data: result.data ? normalizeEntry(result.data) : null, error: result.error };
}

export async function hideWorkerWorkEntry(entryId: string, profileId: string) {
  return supabase.from('work_entry_hidden_for').insert({ work_entry_id: entryId, profile_id: profileId });
}

export async function getWorkerWorkTotals(bounds: WorkPeriodBounds) {
  const result = await supabase.rpc('get_worker_work_totals', { p_day_start: bounds.dayStart, p_day_end: bounds.dayEnd, p_week_start: bounds.weekStart, p_week_end: bounds.weekEnd, p_month_start: bounds.monthStart, p_month_end: bounds.monthEnd });
  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  return { data: normalizeWorkerWorkTotals(row as Partial<WorkerWorkTotals> | null | undefined), error: result.error };
}
