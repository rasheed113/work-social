import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase/client';
import { WorkerSettings } from '../components/WorkerSettings';

interface WorkerSettingsPageProps {
  teamJoining?: boolean;
}

export function WorkerSettingsPage({ teamJoining = false }: WorkerSettingsPageProps) {
  const [profileId, setProfileId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const sessionProfileId = data.session?.user.id ?? null;
      if (sessionProfileId) {
        setProfileId(sessionProfileId);
        return;
      }
      void supabase.auth.getUser().then(({ data: userData }) => {
        if (active) setProfileId(userData.user?.id ?? null);
      });
    });
    return () => {
      active = false;
    };
  }, []);

  return <WorkerSettings profileId={profileId ?? undefined} teamJoining={teamJoining} />;
}
