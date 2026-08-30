import { supabase } from '../../../lib/supabase/client';
import type { WorkerProfile, WorkerProfileUpdateInput } from '../types/workerProfile';

const WORKER_PROFILE_COLUMNS =
  'id, profile_id, work_id, work_role, work_description, skills, created_at, updated_at';
const JWT_ISSUED_AT_FUTURE = 'jwt issued at future';

async function refreshAfterJwtClockError<T>(
  operation: () => Promise<T>,
  getError: (result: T) => { message?: string } | null | undefined,
): Promise<T> {
  const first = await operation();
  if (!getError(first)?.message?.toLowerCase().includes(JWT_ISSUED_AT_FUTURE)) return first;

  const { error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) return first;

  return operation();
}

export async function getWorkerProfile(profileId: string) {
  return refreshAfterJwtClockError(
    () =>
      supabase
        .from('worker_profiles')
        .select(WORKER_PROFILE_COLUMNS)
        .eq('profile_id', profileId)
        .maybeSingle<WorkerProfile>(),
    (result) => result.error,
  );
}

export async function saveWorkerProfile(profileId: string, input: WorkerProfileUpdateInput) {
  const workDescription = input.work_description.trim();
  const skills = Array.from(
    new Set(input.skills.map((skill) => skill.trim()).filter(Boolean)),
  );

  return refreshAfterJwtClockError(
    () =>
      supabase
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
        .single<WorkerProfile>(),
    (result) => result.error,
  );
}
