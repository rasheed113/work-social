import { supabase } from '../../../lib/supabase/client';
import type { WorkerProfile, WorkerProfileUpdateInput } from '../types/workerProfile';

const WORKER_PROFILE_COLUMNS =
  'id, profile_id, work_id, work_role, work_description, skills, created_at, updated_at';

export async function getWorkerProfile(profileId: string) {
  return supabase
    .from('worker_profiles')
    .select(WORKER_PROFILE_COLUMNS)
    .eq('profile_id', profileId)
    .maybeSingle<WorkerProfile>();
}

export async function saveWorkerProfile(profileId: string, input: WorkerProfileUpdateInput) {
  const workDescription = input.work_description.trim();
  const skills = Array.from(
    new Set(input.skills.map((skill) => skill.trim()).filter(Boolean)),
  );

  return supabase
    .from('worker_profiles')
    .upsert(
      {
        profile_id: profileId,
        work_description: workDescription || null,
        skills,
      },
      { onConflict: 'profile_id' },
    )
    .select(WORKER_PROFILE_COLUMNS)
    .single<WorkerProfile>();
}
