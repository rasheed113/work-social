import { supabase } from '../../../lib/supabase/client';
import type { WorkerProfile, WorkerProfileUpdateInput } from '../types/workerProfile';

const WORKER_PROFILE_COLUMNS =
  'id, profile_id, work_id, work_role, worker_type, work_description, skills, created_at, updated_at';
const JWT_ISSUED_AT_FUTURE = 'jwt issued at future';

async function refreshIfJwtIssuedAtFuture(error: { message?: string } | null | undefined) {
  if (!error?.message?.trim().toLowerCase().includes(JWT_ISSUED_AT_FUTURE)) return false;
  const { error: refreshError } = await supabase.auth.refreshSession();
  return !refreshError;
}

export async function getWorkerProfile(profileId: string) {
  const run = () => supabase.from('worker_profiles').select(WORKER_PROFILE_COLUMNS).eq('profile_id', profileId).maybeSingle<WorkerProfile>();
  const result = await run();
  if (await refreshIfJwtIssuedAtFuture(result.error)) return run();
  return result;
}

export async function saveWorkerProfile(profileId: string, input: WorkerProfileUpdateInput) {
  const workDescription = input.work_description.trim();
  const skills = Array.from(new Set(input.skills.map((skill) => skill.trim()).filter(Boolean)));
  const run = () => supabase.from('worker_profiles').upsert({ profile_id: profileId, work_description: workDescription || null, skills }, { onConflict: 'profile_id' }).select(WORKER_PROFILE_COLUMNS).single<WorkerProfile>();
  const result = await run();
  if (await refreshIfJwtIssuedAtFuture(result.error)) return run();
  return result;
}
