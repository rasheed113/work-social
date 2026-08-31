import { supabase } from '../../../lib/supabase/client';
import type {
  WorkerDiaryCalendarSystem,
  WorkerDiaryCursor,
  WorkerDiaryEntry,
  WorkerDiaryEntryInput,
  WorkerDiaryPreferences,
  WorkerDiaryPushSubscriptionInput,
} from '../types/diary';

const DIARY_COLUMNS = 'id, worker_profile_id, entry_type, title, content, completed, event_start_at, event_end_at, event_timezone, created_at, updated_at, reminder:worker_diary_reminders(id, diary_entry_id, worker_profile_id, reminder_kind, enabled, scheduled_at, timezone, reminder_mode, offset_minutes, status, sent_at)';
const DEFAULT_LIMIT = 20;

async function resolveWorkerProfileId() {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) return { data: null, error: userError };
  if (!user) return { data: null, error: new Error('Authenticated user is unavailable.') };
  const result = await supabase.from('worker_profiles').select('id').eq('profile_id', user.id).maybeSingle<{ id: string }>();
  return { data: result.data?.id ?? null, error: result.error ?? (!result.data ? new Error('Worker Identity is unavailable.') : null) };
}

function normalizeInput(input: WorkerDiaryEntryInput) {
  const content = input.content.trim();
  const title = input.title?.trim() || null;
  return {
    entry_type: input.entry_type,
    title,
    content,
    completed: input.entry_type === 'todo' ? Boolean(input.completed) : null,
    event_start_at: input.entry_type === 'event' ? input.event_start_at ?? null : null,
    event_end_at: input.entry_type === 'event' ? input.event_end_at ?? null : null,
    event_timezone: input.entry_type === 'event' ? input.event_timezone ?? null : null,
    reminder_enabled: Boolean(input.reminder?.enabled),
    reminder_scheduled_at: input.reminder?.enabled ? input.reminder.scheduled_at : null,
    reminder_timezone: input.reminder?.enabled ? input.reminder.timezone : null,
    reminder_mode: input.reminder?.enabled ? input.reminder.reminder_mode : 'custom',
    reminder_offset_minutes: input.reminder?.enabled ? input.reminder.offset_minutes ?? null : null,
  };
}

async function fetchEntry(id: string) {
  const result = await supabase.from('worker_diary_entries').select(DIARY_COLUMNS).eq('id', id).maybeSingle<WorkerDiaryEntry>();
  return { data: result.data ?? null, error: result.error ?? (!result.data ? new Error('Diary entry was not found.') : null) };
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

export async function listWorkerDiaryCalendarEntries(fromIso: string, toIso: string) {
  const events = await supabase.from('worker_diary_entries').select(DIARY_COLUMNS).eq('entry_type', 'event').gte('event_start_at', fromIso).lt('event_start_at', toIso).order('event_start_at', { ascending: true }).returns<WorkerDiaryEntry[]>();
  if (events.error) return { data: [], error: events.error };
  const todos = await supabase.from('worker_diary_reminders').select('id, diary_entry_id, worker_profile_id, reminder_kind, enabled, scheduled_at, timezone, reminder_mode, offset_minutes, status, sent_at, entry:worker_diary_entries(id, worker_profile_id, entry_type, title, content, completed, event_start_at, event_end_at, event_timezone, created_at, updated_at)').eq('reminder_kind', 'todo').eq('enabled', true).gte('scheduled_at', fromIso).lt('scheduled_at', toIso).order('scheduled_at', { ascending: true });
  if (todos.error) return { data: events.data ?? [], error: todos.error };
  const todoEntries = (todos.data ?? []).map(row => {
    const entry = Array.isArray(row.entry) ? row.entry[0] : row.entry;
    if (!entry) return null;
    return { ...entry, reminder: { id: row.id, diary_entry_id: row.diary_entry_id, worker_profile_id: row.worker_profile_id, reminder_kind: row.reminder_kind, enabled: row.enabled, scheduled_at: row.scheduled_at, timezone: row.timezone, reminder_mode: row.reminder_mode, offset_minutes: row.offset_minutes, status: row.status, sent_at: row.sent_at } } as WorkerDiaryEntry;
  }).filter(Boolean) as WorkerDiaryEntry[];
  return { data: [...(events.data ?? []), ...todoEntries].sort((a, b) => new Date(a.event_start_at ?? a.reminder?.scheduled_at ?? a.created_at).getTime() - new Date(b.event_start_at ?? b.reminder?.scheduled_at ?? b.created_at).getTime()), error: null };
}

export async function getWorkerDiaryEntry(entryId: string) { return fetchEntry(entryId); }

export async function saveWorkerDiaryEntry(input: WorkerDiaryEntryInput, entryId: string | null = null) {
  const payload = normalizeInput(input);
  if (!payload.content) return { data: null, error: new Error('Content is required.') };
  if (payload.entry_type === 'event' && (!payload.title || !payload.event_start_at || !payload.event_timezone)) return { data: null, error: new Error('Event title, date/time and timezone are required.') };
  const { data: savedId, error: saveError } = await supabase.rpc('save_worker_diary_entry', {
    p_id: entryId,
    p_entry_type: payload.entry_type,
    p_title: payload.title,
    p_content: payload.content,
    p_completed: payload.completed,
    p_event_start_at: payload.event_start_at,
    p_event_end_at: payload.event_end_at,
    p_event_timezone: payload.event_timezone,
    p_reminder_enabled: payload.reminder_enabled,
    p_reminder_scheduled_at: payload.reminder_scheduled_at,
    p_reminder_timezone: payload.reminder_timezone,
    p_reminder_mode: payload.reminder_mode,
    p_reminder_offset_minutes: payload.reminder_offset_minutes,
  });
  if (saveError || !savedId) return { data: null, error: saveError ?? new Error('Diary entry could not be saved.') };
  return fetchEntry(savedId as string);
}

export async function createWorkerDiaryEntry(input: WorkerDiaryEntryInput) { return saveWorkerDiaryEntry(input); }
export async function updateWorkerDiaryEntry(entryId: string, input: WorkerDiaryEntryInput) { return saveWorkerDiaryEntry(input, entryId); }

export async function deleteWorkerDiaryEntry(entryId: string) {
  const result = await supabase.from('worker_diary_entries').delete().eq('id', entryId).select('id').maybeSingle<{ id: string }>();
  return { error: result.error ?? (!result.data ? new Error('Diary entry could not be deleted.') : null) };
}

export async function setWorkerDiaryTodoCompleted(entryId: string, completed: boolean) {
  const current = await fetchEntry(entryId);
  if (current.error || !current.data || current.data.entry_type !== 'todo') return { data: null, error: current.error ?? new Error('To-do could not be updated.') };
  return saveWorkerDiaryEntry({ entry_type: 'todo', title: current.data.title, content: current.data.content, completed, reminder: current.data.reminder && !completed ? { enabled: current.data.reminder.enabled, scheduled_at: current.data.reminder.scheduled_at, timezone: current.data.reminder.timezone, reminder_mode: current.data.reminder.reminder_mode, offset_minutes: current.data.reminder.offset_minutes } : null }, entryId);
}

export async function getWorkerDiaryPreferences() {
  const owner = await resolveWorkerProfileId();
  if (owner.error || !owner.data) return { data: null, error: owner.error ?? new Error('Worker Identity is unavailable.') };
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const result = await supabase.from('worker_diary_preferences').upsert({ worker_profile_id: owner.data, timezone }, { onConflict: 'worker_profile_id', ignoreDuplicates: true }).select('worker_profile_id, calendar_system, timezone, notifications_enabled, todo_reminders_enabled, event_reminders_enabled').maybeSingle<WorkerDiaryPreferences>();
  if (result.data) return { data: result.data, error: result.error };
  const fallback = await supabase.from('worker_diary_preferences').select('worker_profile_id, calendar_system, timezone, notifications_enabled, todo_reminders_enabled, event_reminders_enabled').eq('worker_profile_id', owner.data).maybeSingle<WorkerDiaryPreferences>();
  return { data: fallback.data ?? null, error: fallback.error ?? result.error };
}

export async function updateWorkerDiaryPreferences(patch: Partial<Omit<WorkerDiaryPreferences, 'worker_profile_id'>>) {
  const owner = await resolveWorkerProfileId();
  if (owner.error || !owner.data) return { data: null, error: owner.error ?? new Error('Worker Identity is unavailable.') };
  const result = await supabase.from('worker_diary_preferences').upsert({ worker_profile_id: owner.data, ...patch }, { onConflict: 'worker_profile_id' }).select('worker_profile_id, calendar_system, timezone, notifications_enabled, todo_reminders_enabled, event_reminders_enabled').single<WorkerDiaryPreferences>();
  return { data: result.data ?? null, error: result.error };
}

export async function saveWorkerDiaryPushSubscription(input: WorkerDiaryPushSubscriptionInput) {
  const owner = await resolveWorkerProfileId();
  if (owner.error || !owner.data) return { error: owner.error ?? new Error('Worker Identity is unavailable.') };
  const result = await supabase.from('worker_diary_push_subscriptions').upsert({ worker_profile_id: owner.data, ...input }, { onConflict: 'endpoint' });
  return { error: result.error };
}

export async function removeWorkerDiaryPushSubscription(endpoint: string) {
  const result = await supabase.from('worker_diary_push_subscriptions').delete().eq('endpoint', endpoint);
  return { error: result.error };
}

export function isSupportedDiaryCalendar(value: string): value is WorkerDiaryCalendarSystem {
  return ['gregory','islamic','islamic-umalqura','islamic-civil','islamic-tbla','persian','hebrew','buddhist','indian','japanese','chinese','coptic','ethiopic','ethiopic-amete-alem','roc','dangi'].includes(value);
}
