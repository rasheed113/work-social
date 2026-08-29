import { useEffect, useState } from 'react';
import { getSession } from '../../auth/api/getSession';

export function useCurrentWorkerProfileId() {
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setError(sessionError.message);
      setProfileId(data.session?.user.id ?? null);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  return { profileId, loading, error };
}
