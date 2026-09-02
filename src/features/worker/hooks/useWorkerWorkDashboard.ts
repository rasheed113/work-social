import { useCallback, useEffect, useMemo, useState } from 'react';
import { getWorkerProfile } from '../api/workerProfile';
import { createWorkerWorkEntry, getWorkerWorkTotals } from '../api/workEntries';
import { getWorkerWorkPeriodBounds } from '../logic/workEntryCalculations';
import type { WorkEntryInput, WorkerWorkTotals } from '../types/workEntry';

const EMPTY_TOTALS: WorkerWorkTotals = { daily_total: '0', weekly_total: '0', monthly_total: '0', lifetime_total: '0' };

export function useWorkerWorkDashboard(profileId: string) {
  const [workerProfileId, setWorkerProfileId] = useState<string | null>(null);
  const [totals, setTotals] = useState<WorkerWorkTotals>(EMPTY_TOTALS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const workerResult = await getWorkerProfile(profileId);
    if (workerResult.error) {
      setError(workerResult.error.message);
      setWorkerProfileId(null);
      setTotals(EMPTY_TOTALS);
      setLoading(false);
      return;
    }
    const nextWorkerProfileId = workerResult.data?.id ?? null;
    setWorkerProfileId(nextWorkerProfileId);
    if (!nextWorkerProfileId) {
      setTotals(EMPTY_TOTALS);
      setLoading(false);
      return;
    }
    const bounds = getWorkerWorkPeriodBounds();
    const totalsResult = await getWorkerWorkTotals(bounds);
    if (totalsResult.error) setError(totalsResult.error.message); else setTotals(totalsResult.data);
    setLoading(false);
  }, [profileId]);

  useEffect(() => { void load(); }, [load]);

  const createEntry = useCallback(async (input: Omit<WorkEntryInput, 'worker_profile_id'>) => {
    if (!workerProfileId) return { data: null, error: new Error('Set up Work Identity before creating a Work Entry.') };
    setSaving(true);
    setError(null);
    const result = await createWorkerWorkEntry({ ...input, worker_profile_id: workerProfileId });
    if (result.error) setError(result.error.message); else await load();
    setSaving(false);
    return result;
  }, [load, workerProfileId]);

  const periodLabels = useMemo(() => {
    const now = new Date();
    const bounds = getWorkerWorkPeriodBounds(now);
    return {
      day: now.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      week: `Week of ${new Date(bounds.weekStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
      month: now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    };
  }, []);

  return { workerProfileId, totals, periodLabels, loading, saving, error, reload: load, createEntry };
}
