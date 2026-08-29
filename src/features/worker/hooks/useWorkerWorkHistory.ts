import { useCallback, useEffect, useState } from 'react';
import {
  getWorkerWorkEntry,
  getWorkerWorkEntryVersions,
  hideWorkerWorkEntry,
  listWorkerWorkEntries,
  updateWorkerWorkEntry,
} from '../api/workEntries';
import type { WorkEntry, WorkEntryUpdateInput, WorkEntryVersion } from '../types/workEntry';

const PAGE_SIZE = 20;

export function useWorkerWorkHistory(profileId: string) {
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<WorkEntry | null>(null);
  const [versions, setVersions] = useState<WorkEntryVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);

  const load = useCallback(async (append = false) => {
    setActionError(null);
    if (append) setLoadingMore(true);
    else setLoading(true);

    const result = await listWorkerWorkEntries(PAGE_SIZE, append ? entries.length : 0);
    if (result.error) {
      setActionError(result.error.message);
    } else {
      setEntries((current) => append ? [...current, ...result.data] : result.data);
      setTotalCount(result.count);
    }

    if (append) setLoadingMore(false);
    else setLoading(false);
  }, [entries.length]);

  useEffect(() => {
    void load(false);
  }, [profileId]);

  const refresh = useCallback(async () => {
    const result = await listWorkerWorkEntries(PAGE_SIZE, 0);
    if (result.error) setActionError(result.error.message);
    else {
      setEntries(result.data);
      setTotalCount(result.count);
    }
  }, []);

  const openDetails = useCallback(async (entry: WorkEntry) => {
    setSelectedEntry(entry);
    setVersions([]);
    setVersionsLoading(true);
    const result = await getWorkerWorkEntryVersions(entry.id);
    if (result.error) setActionError(result.error.message);
    else setVersions(result.data);
    setVersionsLoading(false);
  }, []);

  const editEntry = useCallback(async (entryId: string, input: WorkEntryUpdateInput) => {
    setActionError(null);
    const result = await updateWorkerWorkEntry(entryId, input);
    if (result.error) {
      setActionError(result.error.message);
      return result;
    }

    await refresh();
    if (result.data) {
      setSelectedEntry(result.data);
      const versionResult = await getWorkerWorkEntryVersions(entryId);
      if (!versionResult.error) setVersions(versionResult.data);
    }
    return result;
  }, [refresh]);

  const deleteForMe = useCallback(async (entryId: string) => {
    setActionError(null);
    const result = await hideWorkerWorkEntry(entryId, profileId);
    if (result.error) {
      setActionError(result.error.message);
      return result;
    }

    setSelectedEntry(null);
    await refresh();
    return result;
  }, [profileId, refresh]);

  const reloadSelectedEntry = useCallback(async () => {
    if (!selectedEntry) return;
    const result = await getWorkerWorkEntry(selectedEntry.id);
    if (result.error) setActionError(result.error.message);
    else if (result.data) setSelectedEntry(result.data);
  }, [selectedEntry]);

  return {
    entries,
    totalCount,
    hasMore: entries.length < totalCount,
    loading,
    loadingMore,
    actionError,
    selectedEntry,
    versions,
    versionsLoading,
    openDetails,
    closeDetails: () => setSelectedEntry(null),
    editEntry,
    deleteForMe,
    reloadSelectedEntry,
    loadMore: () => load(true),
    refresh,
  };
}
