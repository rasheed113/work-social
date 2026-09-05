import { supabase } from '../../../lib/supabase/client';

export interface WorkerDashboardPreference {
  worker_profile_id: string;
  card_order: string[];
  hidden_cards: string[];
  updated_at: string;
}

export async function getWorkerDashboardPreference(workerProfileId: string) {
  const result = await supabase
    .from('worker_dashboard_preferences')
    .select('worker_profile_id, card_order, hidden_cards, updated_at')
    .eq('worker_profile_id', workerProfileId)
    .maybeSingle<WorkerDashboardPreference>();
  return { data: result.data, error: result.error };
}

export async function saveWorkerDashboardPreference(
  workerProfileId: string,
  cardOrder: string[],
  hiddenCards: string[],
) {
  const result = await supabase.from('worker_dashboard_preferences').upsert(
    {
      worker_profile_id: workerProfileId,
      card_order: cardOrder,
      hidden_cards: hiddenCards,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'worker_profile_id' },
  );
  return { error: result.error };
}

export async function deleteWorkerDashboardPreference(workerProfileId: string) {
  const result = await supabase
    .from('worker_dashboard_preferences')
    .delete()
    .eq('worker_profile_id', workerProfileId);
  return { error: result.error };
}
