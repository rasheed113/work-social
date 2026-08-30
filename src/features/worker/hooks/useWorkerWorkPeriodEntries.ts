import { useCallback, useEffect, useRef, useState } from 'react';
import { getWorkerWorkEntry, getWorkerWorkEntryVersions, trashWorkerWorkEntry, updateWorkerWorkEntry } from '../api/workEntries';
import type { WorkEntry, WorkEntryUpdateInput, WorkEntryVersion } from '../types/workEntry';
import { listWorkerWorkEntriesForRange } from '../api/workEntries';

const PAGE_SIZE = 10;

export function useWorkerWorkPeriodEntries(start: string | null, end: string | null) {
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<WorkEntry | null>(null);
  const [versions, setVersions] = useState<WorkEntryVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const requestRef = useRef(0);

  const load = useCallback(async (append = false) => {
    if (!start || !end || (append && loadingMore)) return;
    const requestId = ++requestRef.current;
    if (append) setLoadingMore(true); else setLoading(true);
    setError(null);
    const cursor = append && entries.length ? { occurred_at: entries[entries.length - 1].occurred_at, id: entries[entries.length - 1].id } : null;
    const result = await listWorkerWorkEntriesForRange(start, end, PAGE_SIZE, cursor);
    if (requestId !== requestRef.current) return;
    if (result.error) setError(result.error.message);
    else {
      const next = append ? [...entries, ...result.data] : result.data;
      setEntries(next);
      setHasMore(next.length < result.count);
    }
    if (append) setLoadingMore(false); else setLoading(false);
  }, [end, entries, loadingMore, start]);

  useEffect(() => {
    requestRef.current += 1;
    setEntries([]);
    setHasMore(false);
    setSelectedEntry(null);
    if (start && end) void load(false);
    else { setLoading(false); setError(null); }
  }, [start, end]);

  const openDetails = useCallback(async (entry: WorkEntry) => {
    setSelectedEntry(entry);
    setVersions([]);
    setVersionsLoading(true);
    const result = await getWorkerWorkEntryVersions(entry.id);
    if (result.error) setError(result.error.message); else setVersions(result.data);
    setVersionsLoading(false);
  }, []);

  const editEntry = useCallback(async (entryId: string, input: WorkEntryUpdateInput) => {
    setError(null);
    const result = await updateWorkerWorkEntry(entryId, input);
    if (result.error) { setError(result.error.message); return result; }
    await load(false);
    if (result.data) setSelectedEntry(result.data);
    return result;
  }, [load]);

  const trashEntry = useCallback(async (entryId: string) => {
    setError(null);
    const result = await trashWorkerWorkEntry(entryId);
    if (result.error) setError(result.error.message); else { setSelectedEntry(null); await load(false); }
    return result;
  }, [load]);

  return { entries, loading, loadingMore, hasMore, error, selectedEntry, versions, versionsLoading, openDetails, closeDetails: () => setSelectedEntry(null), editEntry, trashEntry, loadMore: () => void load(true) };
}
