import { useCallback, useEffect, useState } from 'react';
import { getProfile } from '../../profile/api/getProfile';
import { getWorkerProfile, saveWorkerProfile } from '../api/workerProfile';
import type { WorkerProfile, WorkerProfileUpdateInput } from '../types/workerProfile';

export function useWorkerProfile(profileId: string) {
  const [workerProfile, setWorkerProfile] = useState<WorkerProfile | null>(null);
  const [profile, setProfile] = useState<Awaited<ReturnType<typeof getProfile>>['data']>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const workerResult = await getWorkerProfile(profileId);
    const socialResult = await getProfile(profileId);

    if (socialResult.error) setError(socialResult.error.message);
    else setProfile(socialResult.data);

    if (workerResult.error) setError((current) => current ?? workerResult.error.message);
    else setWorkerProfile(workerResult.data);

    setLoading(false);
  }, [profileId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async (input: WorkerProfileUpdateInput) => {
    setSaving(true);
    setError(null);
    const result = await saveWorkerProfile(profileId, input);
    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return { error: result.error };
    }
    setWorkerProfile(result.data);
    setSaving(false);
    return { data: result.data, error: null };
  }, [profileId]);

  return { workerProfile, profile, loading, saving, error, reload: load, save };
}
