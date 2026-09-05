import { supabase } from '../../../lib/supabase/client';

export type SalaryAllowanceFrequency = 'monthly' | 'other';
export type SalaryAllowanceRule = 'always' | 'present_only' | 'after_absences' | 'after_unpaid_leaves' | 'custom';

export interface SalaryAllowance {
  id: string;
  worker_profile_id: string;
  allowance_type: string;
  amount: number | string;
  frequency: SalaryAllowanceFrequency;
  eligibility_rule: SalaryAllowanceRule;
  loss_after_count: number | null;
  rule_note: string | null;
  effective_from: string;
  effective_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalaryAllowanceInput {
  allowance_type: string;
  amount: number;
  frequency: SalaryAllowanceFrequency;
  eligibility_rule: SalaryAllowanceRule;
  loss_after_count: number | null;
  rule_note: string | null;
  effective_from: string;
}

async function getWorkerId(profileId: string) {
  const { data, error } = await supabase.from('worker_profiles').select('id').eq('profile_id', profileId).maybeSingle<{ id: string }>();
  return { workerId: data?.id ?? null, error: error ?? (!data?.id ? new Error('Worker Identity is unavailable.') : null) };
}

export async function listSalaryAllowances(profileId: string) {
  const { workerId, error } = await getWorkerId(profileId);
  if (error || !workerId) return { data: [] as SalaryAllowance[], error };
  const result = await supabase.from('salary_allowances').select('*').eq('worker_profile_id', workerId).order('effective_from', { ascending: false }).order('created_at', { ascending: false }).returns<SalaryAllowance[]>();
  return { data: result.data ?? [], error: result.error };
}

export async function replaceSalaryAllowances(profileId: string, allowances: SalaryAllowanceInput[]) {
  const { workerId, error } = await getWorkerId(profileId);
  if (error || !workerId) return { error };
  const existing = await supabase.from('salary_allowances').delete().eq('worker_profile_id', workerId);
  if (existing.error) return { error: existing.error };
  if (!allowances.length) return { error: null };
  const rows = allowances.map((allowance) => ({ worker_profile_id: workerId, ...allowance }));
  const result = await supabase.from('salary_allowances').insert(rows);
  return { error: result.error };
}
