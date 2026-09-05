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
  const result = await supabase.from('salary_allowances').select('*').eq('worker_profile_id', workerId).is('effective_to', null).order('effective_from', { ascending: false }).order('created_at', { ascending: false }).returns<SalaryAllowance[]>();
  return { data: result.data ?? [], error: result.error };
}

export async function replaceSalaryAllowances(profileId: string, allowances: SalaryAllowanceInput[]) {
  const { workerId, error } = await getWorkerId(profileId);
  if (error || !workerId) return { error };

  const active = await supabase.from('salary_allowances').select('id,effective_from').eq('worker_profile_id', workerId).is('effective_to', null).returns<Array<{ id: string; effective_from: string }>>();
  if (active.error) return { error: active.error };

  const effectiveFrom = allowances[0]?.effective_from;
  if (!effectiveFrom) {
    if (!active.data?.length) return { error: null };
    const result = await supabase.from('salary_allowances').update({ effective_to: new Date().toISOString().slice(0, 10) }).in('id', active.data.map(row => row.id));
    return { error: result.error };
  }

  for (const row of active.data ?? []) {
    if (row.effective_from === effectiveFrom) {
      const removed = await supabase.from('salary_allowances').delete().eq('id', row.id);
      if (removed.error) return { error: removed.error };
      continue;
    }
    if (row.effective_from > effectiveFrom) return { error: new Error('Allowance start date cannot move backwards over an existing allowance record.') };
    const closed = await supabase.from('salary_allowances').update({ effective_to: new Date(new Date(effectiveFrom + 'T00:00:00').getTime() - 86400000).toISOString().slice(0, 10) }).eq('id', row.id);
    if (closed.error) return { error: closed.error };
  }

  const rows = allowances.map((allowance) => ({ worker_profile_id: workerId, ...allowance }));
  const result = await supabase.from('salary_allowances').insert(rows);
  return { error: result.error };
}
