import { supabase } from '../../../lib/supabase/client';
import type { WorkEntry, WorkEntryInput, WorkEntryUpdateInput, WorkEntryVersion, WorkerWorkTotals } from '../types/workEntry';
import { canonicalizeWorkDecimal, getWorkerWorkPeriodBounds, normalizeWorkerWorkTotals } from '../logic/workEntryCalculations';

const WORK_ENTRY_COLUMNS = 'id, worker_profile_id, work_context, item_name, size, quantity, rate, total, special_note, occurred_at, created_at, updated_at';

interface WorkEntryRow extends Omit<WorkEntry, 'quantity' | 'rate' | 'total'> {
  quantity: string | number;
  rate: string | number;
  total: string | number;
}
interface WorkEntryVersionRow extends Omit<WorkEntryVersion, 'quantity' | 'rate' | 'total' | 'revision_no'> {
  revision_no: string | number;
  quantity: string | number;
  rate: string | number;
  total: string | number;
}

export type WorkHistoryPeriod = 'lifetime' | 'day' | 'week' | 'month';
export interface WorkHistoryCursor { occurred_at: string; id: string; }
export interface WorkHistoryPeriodBounds { start: string; end: string; }
type WorkPeriodBounds = ReturnType<typeof getWorkerWorkPeriodBounds>;

function normalizeDecimal(value: string | number): string { return canonicalizeWorkDecimal(String(value)); }
function normalizeEntry(row: WorkEntryRow): WorkEntry { return { ...row, quantity: normalizeDecimal(row.quantity), rate: normalizeDecimal(row.rate), total: normalizeDecimal(row.total) }; }
function normalizeVersion(row: WorkEntryVersionRow): WorkEntryVersion { return { ...row, revision_no: Number(row.revision_no), quantity: normalizeDecimal(row.quantity), rate: normalizeDecimal(row.rate), total: normalizeDecimal(row.total) }; }

export async function listWorkerWorkEntries(limit: number, cursor: WorkHistoryCursor | null = null, period: WorkHistoryPeriod = 'lifetime') {
  let query = supabase.from('work_entries').select(WORK_ENTRY_COLUMNS).order('occurred_at', { ascending: false }).order('id', { ascending: false }).limit(limit);
  const bounds = getWorkerWorkPeriodBounds();
  const periodBounds: WorkHistoryPeriodBounds | null = period === 'day'
    ? { start: bounds.dayStart, end: bounds.dayEnd }
    : period === 'week'
      ? { start: bounds.weekStart, end: bounds.weekEnd }
      : period === 'month'
        ? { start: bounds.monthStart, end: bounds.monthEnd }
        : null;
  if (periodBounds) query = query.gte('occurred_at', periodBounds.start).lt('occurred_at', periodBounds.end);
  if (cursor) query = query.or(`occurred_at.lt.${cursor.occurred_at},and(occurred_at.eq.${cursor.occurred_at},id.lt.${cursor.id})`);
  const result = await query.returns<WorkEntryRow[]>();
  return { data: result.data?.map(normalizeEntry) ?? [], error: result.error };
}

export async function getWorkerWorkEntry(entryId: string) {
  const result = await supabase.from('work_entries').select(WORK_ENTRY_COLUMNS).eq('id', entryId).maybeSingle<WorkEntryRow>();
  return { data: result.data ? normalizeEntry(result.data) : null, error: result.error };
}

export async function getWorkerWorkEntryVersions(entryId: string) {
  const result = await supabase.from('work_entry_versions').select('id, work_entry_id, revision_no, item_name, size, quantity, rate, total, special_note, recorded_at, changed_by').eq('work_entry_id', entryId).order('revision_no', { ascending: true }).returns<WorkEntryVersionRow[]>();
  return { data: result.data?.map(normalizeVersion) ?? [], error: result.error };
}

function normalizeSize(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed || null;
}

export async function createWorkerWorkEntry(input: WorkEntryInput) {
  const id = input.id ?? crypto.randomUUID();
  const payload = {
    id,
    worker_profile_id: input.worker_profile_id,
    work_context: 'my_work' as const,
    item_name: input.item_name.trim(),
    size: normalizeSize(input.size),
    quantity: canonicalizeWorkDecimal(input.quantity),
    rate: canonicalizeWorkDecimal(input.rate),
    special_note: input.special_note?.trim() || null,
  };
  const result = await supabase.from('work_entries').insert(payload).select(WORK_ENTRY_COLUMNS).maybeSingle<WorkEntryRow>();
  if (!result.error) return { data: result.data ? normalizeEntry(result.data) : null, error: null };
  if (result.error.code !== '23505') return { data: null, error: result.error };
  const existing = await getWorkerWorkEntry(id);
  if (existing.error || !existing.data) return { data: null, error: result.error };
  const samePayload = existing.data.worker_profile_id === payload.worker_profile_id
    && existing.data.work_context === payload.work_context
    && existing.data.item_name === payload.item_name
    && existing.data.size === payload.size
    && existing.data.quantity === payload.quantity
    && existing.data.rate === payload.rate
    && existing.data.special_note === payload.special_note;
  return samePayload
    ? { data: existing.data, error: null }
    : { data: null, error: new Error('A Work Entry with this identity already exists with different values.') };
}

export async function updateWorkerWorkEntry(entryId: string, input: WorkEntryUpdateInput) {
  const result = await supabase.from('work_entries').update({ item_name: input.item_name.trim(), size: normalizeSize(input.size), quantity: canonicalizeWorkDecimal(input.quantity), rate: canonicalizeWorkDecimal(input.rate), special_note: input.special_note?.trim() || null }).eq('id', entryId).select(WORK_ENTRY_COLUMNS).maybeSingle<WorkEntryRow>();
  return { data: result.data ? normalizeEntry(result.data) : null, error: result.error };
}

export async function hideWorkerWorkEntry(entryId: string, profileId: string) { return supabase.from('work_entry_hidden_for').insert({ work_entry_id: entryId, profile_id: profileId }); }
export async function getWorkerWorkTotals(bounds: WorkPeriodBounds) { const result = await supabase.rpc('get_worker_work_totals', { p_day_start: bounds.dayStart, p_day_end: bounds.dayEnd, p_week_start: bounds.weekStart, p_week_end: bounds.weekEnd, p_month_start: bounds.monthStart, p_month_end: bounds.monthEnd }); const row = Array.isArray(result.data) ? result.data[0] : result.data; return { data: normalizeWorkerWorkTotals(row as Partial<WorkerWorkTotals> | null | undefined), error: result.error }; }
