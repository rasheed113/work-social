import { useCallback, useEffect, useRef, useState } from 'react';
import { createWorkerDiaryEntry, deleteWorkerDiaryEntry, listWorkerDiaryEntries, setWorkerDiaryTodoCompleted, updateWorkerDiaryEntry } from '../api/diary';
import type { WorkerDiaryCursor, WorkerDiaryEntry, WorkerDiaryEntryInput } from '../types/diary';

const PAGE_SIZE = 20;

export function useWorkerDiary(enabled: boolean) {
  const [entries, setEntries] = useState<WorkerDiaryEntry[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [loadingMore, setLoadingMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const cursorRef = useRef<WorkerDiaryCursor | null>(null);
  const requestRef = useRef(0);

  const load = useCallback(async (term: string, append: boolean) => {
    const requestId = ++requestRef.current;
    if (append) setLoadingMore(true); else setLoading(true);
    setError(null);
    const cursor = append ? cursorRef.current : null;
    const result = await listWorkerDiaryEntries(PAGE_SIZE, cursor, term);
    if (requestId !== requestRef.current) return;
    if (result.error) {
      setError(result.error.message);
    } else {
      setEntries(current => append ? [...current, ...result.data] : result.data);
      const last = result.data.at(-1);
      cursorRef.current = last ? { created_at: last.created_at, id: last.id } : cursor;
      setHasMore(result.hasMore);
    }
    if (append) setLoadingMore(false); else setLoading(false);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setTimeout(() => void load(search, false), 250);
    return () => window.clearTimeout(timer);
  }, [enabled, search, load]);

  const refresh = useCallback(() => load(search, false), [load, search]);

  const create = useCallback(async (input: WorkerDiaryEntryInput) => {
    setSaving(true); setError(null);
    const result = await createWorkerDiaryEntry(input);
    setSaving(false);
    if (result.error) { setError(result.error.message); return { data: null, error: result.error }; }
    await refresh();
    return result;
  }, [refresh]);

  const update = useCallback(async (entryId: string, input: WorkerDiaryEntryInput) => {
    setSaving(true); setError(null);
    const result = await updateWorkerDiaryEntry(entryId, input);
    setSaving(false);
    if (result.error) { setError(result.error.message); return { data: null, error: result.error }; }
    await refresh();
    return result;
  }, [refresh]);

  const remove = useCallback(async (entryId: string) => {
    setSaving(true); setError(null);
    const result = await deleteWorkerDiaryEntry(entryId);
    setSaving(false);
    if (result.error) { setError(result.error.message); return result; }
    setEntries(current => current.filter(entry => entry.id !== entryId));
    return result;
  }, []);

  const toggleTodo = useCallback(async (entryId: string, completed: boolean) => {
    const result = await setWorkerDiaryTodoCompleted(entryId, completed);
    if (result.error) { setError(result.error.message); return result; }
    if (result.data) setEntries(current => current.map(entry => entry.id === entryId ? result.data! : entry));
    return result;
  }, []);

  return { entries, loading, loadingMore, saving, error, search, setSearch, hasMore, loadMore: () => load(search, true), refresh, create, update, remove, toggleTodo };
}
