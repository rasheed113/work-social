import { useCallback, useEffect, useMemo, useState } from 'react';
import { getWorkerProfile } from '../api/workerProfile';
import { createWorkerWorkEntry, getWorkerWorkTotals, listWorkerWorkEntries } from '../api/workEntries';
import { getWorkerWorkPeriodBounds } from '../logic/workEntryCalculations';
import type { WorkEntry, WorkEntryInput, WorkerWorkTotals } from '../types/workEntry';

const RECENT_LIMIT = 5;

export function useWorkerWorkDashboard(profileId: string) {
  const [workerProfileId, setWorkerProfileId] = useState<string | null>(null);
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [totals, setTotals] = useState<WorkerWorkTotals>({ daily_total: 0, weekly_total: 0, monthly_total: 0, lifetime_total: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const workerResult = await getWorkerProfile(profileId);
    if (workerResult.error) {
      setError(workerResult.error.message); setWorkerProfileId(null); setEntries([]); setTotals({ daily_total: 0, weekly_total: 0, monthly_total: 0, lifetime_total: 0 }); setLoading(false); return;
    }
    const nextWorkerProfileId = workerResult.data?.id ?? null;
    setWorkerProfileId(nextWorkerProfileId);
    if (!nextWorkerProfileId) {
      setEntries([]); setTotals({ daily_total: 0, weekly_total: 0, monthly_total: 0, lifetime_total: 0 }); setLoading(false); return;
    }
    const bounds = getWorkerWorkPeriodBounds();
    const [entriesResult, totalsResult] = await Promise.all([listWorkerWorkEntries(RECENT_LIMIT, 0), getWorkerWorkTotals(bounds)]);
    if (entriesResult.error) setError(entriesResult.error.message); else setEntries(entriesResult.data);
    if (totalsResult.error) { const message = totalsResult.error.message; setError((current) => current ?? message); } else setTotals(totalsResult.data);
    setLoading(false);
  }, [profileId]);

  useEffect(() => { void load(); }, [load]);

  const createEntry = useCallback(async (input: Omit<WorkEntryInput, 'worker_profile_id'>) => {
    if (!workerProfileId) return { data: null, error: new Error('Set up Work Identity before creating a Work Entry.') };
    setSaving(true); setError(null);
    const result = await createWorkerWorkEntry({ ...input, worker_profile_id: workerProfileId });
    if (result.error) { setError(result.error.message); setSaving(false); return result; }
    setSaving(false); await load(); return result;
  }, [load, workerProfileId]);

  const periodLabels = useMemo(() => {
    const now = new Date();
    return { day: now.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), week: `Week of ${getWorkerWorkPeriodBounds(now).weekStart.slice(0, 10)}`, month: now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) };
  }, []);

  return { workerProfileId, entries, totals, periodLabels, loading, saving, error, reload: load, createEntry };
}
