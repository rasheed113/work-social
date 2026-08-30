import { useCallback, useEffect, useState } from 'react';
import { getWorkerWorkEntry, getWorkerWorkEntryVersions, listWorkerWorkEntries, restoreWorkerWorkEntry, removeWorkerWorkEntryPermanently, trashWorkerWorkEntry, updateWorkerWorkEntry } from '../api/workEntries';
import type { WorkHistoryPeriod } from '../api/workEntries';
import type { WorkEntry, WorkEntryUpdateInput, WorkEntryVersion } from '../types/workEntry';

const PAGE_SIZE = 20;

export function useWorkerWorkHistory(profileId: string, period: WorkHistoryPeriod = 'lifetime') {
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<WorkEntry | null>(null);
  const [versions, setVersions] = useState<WorkEntryVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);

  const load = useCallback(async (append = false) => {
    setActionError(null);
    if (append) setLoadingMore(true); else setLoading(true);
    const currentCursor = append && entries.length
      ? { occurred_at: entries[entries.length - 1].occurred_at, id: entries[entries.length - 1].id }
      : null;
    const result = await listWorkerWorkEntries(PAGE_SIZE, currentCursor, period);
    if (result.error) setActionError(result.error.message);
    else {
      setEntries((current) => append ? [...current, ...result.data] : result.data);
      setHasMore(result.data.length === PAGE_SIZE);
    }
    if (append) setLoadingMore(false); else setLoading(false);
  }, [entries, period]);

  useEffect(() => {
    setEntries([]);
    setHasMore(false);
    setSelectedEntry(null);
    void load(false);
  }, [profileId, period]);

  const refresh = useCallback(async () => {
    const result = await listWorkerWorkEntries(PAGE_SIZE, null, period);
    if (result.error) setActionError(result.error.message);
    else {
      setEntries(result.data);
      setHasMore(result.data.length === PAGE_SIZE);
    }
  }, [period]);

  const openDetails = useCallback(async (entry: WorkEntry) => {
    setSelectedEntry(entry);
    setVersions([]);
    setVersionsLoading(true);
    const result = await getWorkerWorkEntryVersions(entry.id);
    if (result.error) setActionError(result.error.message); else setVersions(result.data);
    setVersionsLoading(false);
  }, []);

  const editEntry = useCallback(async (entryId: string, input: WorkEntryUpdateInput) => {
    setActionError(null);
    const result = await updateWorkerWorkEntry(entryId, input);
    if (result.error) { setActionError(result.error.message); return result; }
    await refresh();
    if (result.data) {
      setSelectedEntry(result.data);
      const versionResult = await getWorkerWorkEntryVersions(entryId);
      if (!versionResult.error) setVersions(versionResult.data);
    }
    return result;
  }, [refresh]);

  const trashEntry = useCallback(async (entryId: string) => {
    setActionError(null);
    const result = await trashWorkerWorkEntry(entryId);
    if (result.error) { setActionError(result.error.message); return result; }
    setSelectedEntry(null);
    await refresh();
    return result;
  }, [refresh]);

  const restoreEntry = useCallback(async (entryId: string) => {
    setActionError(null);
    const result = await restoreWorkerWorkEntry(entryId);
    if (result.error) setActionError(result.error.message);
    return result;
  }, []);

  const removePermanently = useCallback(async (entryId: string) => {
    setActionError(null);
    const result = await removeWorkerWorkEntryPermanently(entryId);
    if (result.error) setActionError(result.error.message);
    return result;
  }, []);

  const reloadSelectedEntry = useCallback(async () => {
    if (!selectedEntry) return;
    const result = await getWorkerWorkEntry(selectedEntry.id);
    if (result.error) setActionError(result.error.message); else if (result.data) setSelectedEntry(result.data);
  }, [selectedEntry]);

  return {
    entries,
    hasMore,
    loading,
    loadingMore,
    actionError,
    selectedEntry,
    versions,
    versionsLoading,
    openDetails,
    closeDetails: () => setSelectedEntry(null),
    editEntry,
    trashEntry,
    restoreEntry,
    removePermanently,
    reloadSelectedEntry,
    loadMore: () => load(true),
    refresh,
  };
}
