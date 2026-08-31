import { useCallback, useEffect, useState } from 'react';
import { getProfile } from '../../profile/api/getProfile';
import { getWorkerProfile, saveWorkerProfile } from '../api/workerProfile';
import type { WorkerProfile, WorkerProfileUpdateInput } from '../types/workerProfile';

export function useWorkerProfile(profileId: string) {
  const [workerProfile, setWorkerProfile] = useState<WorkerProfile | null>(null);
  const [profile, setProfile] = useState<Awaited<ReturnType<typeof getProfile>>['data']>(null);
  const [loading, setLoading] = useState(Boolean(profileId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profileId) {
      setWorkerProfile(null);
      setProfile(null);
      setError('Your authenticated profile could not be resolved.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [workerResult, socialResult] = await Promise.all([
        getWorkerProfile(profileId),
        getProfile(profileId),
      ]);

      if (socialResult.error) setError(socialResult.error.message);
      else setProfile(socialResult.data);

      if (workerResult.error) setError((current) => current ?? workerResult.error.message);
      else setWorkerProfile(workerResult.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load your Worker profile.');
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async (input: WorkerProfileUpdateInput) => {
    setSaving(true);
    setError(null);
    try {
      const result = await saveWorkerProfile(profileId, input);
      if (result.error) {
        setError(result.error.message);
        return { error: result.error };
      }
      setWorkerProfile(result.data);
      return { data: result.data, error: null };
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error('Unable to save Worker profile.');
      setError(error.message);
      return { error };
    } finally {
      setSaving(false);
    }
  }, [profileId]);

  return { workerProfile, profile, loading, saving, error, reload: load, save };
}
