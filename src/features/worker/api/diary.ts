import { supabase } from '../../../lib/supabase/client';
import type { WorkerDiaryCursor, WorkerDiaryEntry, WorkerDiaryEntryInput } from '../types/diary';

const DIARY_COLUMNS = 'id, worker_profile_id, entry_type, title, content, completed, created_at, updated_at';
const DEFAULT_LIMIT = 20;

function normalizeInput(input: WorkerDiaryEntryInput) {
  const content = input.content.trim();
  const title = input.title?.trim() || null;
  return {
    entry_type: input.entry_type,
    title,
    content,
    completed: input.entry_type === 'todo' ? Boolean(input.completed) : null,
  };
}

async function resolveWorkerProfileId() {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) return { data: null, error: userError };
  if (!user) return { data: null, error: new Error('Authenticated user is unavailable.') };
  const result = await supabase.from('worker_profiles').select('id').eq('profile_id', user.id).maybeSingle<{ id: string }>();
  return { data: result.data?.id ?? null, error: result.error ?? (!result.data ? new Error('Worker Identity is unavailable.') : null) };
}

export async function listWorkerDiaryEntries(limit = DEFAULT_LIMIT, cursor: WorkerDiaryCursor | null = null, search = '') {
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  let query = supabase.from('worker_diary_entries').select(DIARY_COLUMNS).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(safeLimit);
  const term = search.trim().replace(/[\\%_]/g, '\\$&');
  if (term) query = query.or(`title.ilike.%${term}%,content.ilike.%${term}%`);
  if (cursor) query = query.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`);
  const result = await query.returns<WorkerDiaryEntry[]>();
  return { data: result.data ?? [], error: result.error, hasMore: (result.data?.length ?? 0) === safeLimit };
}

export async function getWorkerDiaryEntry(entryId: string) {
  const result = await supabase.from('worker_diary_entries').select(DIARY_COLUMNS).eq('id', entryId).maybeSingle<WorkerDiaryEntry>();
  return { data: result.data ?? null, error: result.error };
}

export async function createWorkerDiaryEntry(input: WorkerDiaryEntryInput) {
  const owner = await resolveWorkerProfileId();
  if (owner.error || !owner.data) return { data: null, error: owner.error ?? new Error('Worker Identity is unavailable.') };
  const payload = normalizeInput(input);
  if (!payload.content) return { data: null, error: new Error('Content is required.') };
  const result = await supabase.from('worker_diary_entries').insert({ id: crypto.randomUUID(), worker_profile_id: owner.data, ...payload }).select(DIARY_COLUMNS).maybeSingle<WorkerDiaryEntry>();
  return { data: result.data ?? null, error: result.error };
}

export async function updateWorkerDiaryEntry(entryId: string, input: WorkerDiaryEntryInput) {
  const payload = normalizeInput(input);
  if (!payload.content) return { data: null, error: new Error('Content is required.') };
  const result = await supabase.from('worker_diary_entries').update(payload).eq('id', entryId).select(DIARY_COLUMNS).maybeSingle<WorkerDiaryEntry>();
  return { data: result.data ?? null, error: result.error };
}

export async function deleteWorkerDiaryEntry(entryId: string) {
  const result = await supabase.from('worker_diary_entries').delete().eq('id', entryId);
  return { error: result.error };
}

export async function setWorkerDiaryTodoCompleted(entryId: string, completed: boolean) {
  const result = await supabase.from('worker_diary_entries').update({ completed }).eq('id', entryId).eq('entry_type', 'todo').select(DIARY_COLUMNS).maybeSingle<WorkerDiaryEntry>();
  return { data: result.data ?? null, error: result.error };
}
