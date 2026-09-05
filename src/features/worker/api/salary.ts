import { supabase } from '../../../lib/supabase/client';
import type { AttendanceStatus, BonusAmountType, BonusFrequency, SalaryMonthSummary, SalaryPolicy, SalaryPolicyInput, WorkerType } from '../types/salary';

export async function setWorkerType(workerProfileId: string, workerType: WorkerType) {
  return supabase.from('worker_profiles').update({ worker_type: workerType }).eq('id', workerProfileId).select('worker_type').single();
}

export async function getSalaryPolicy(profileId: string) {
  const { data: worker, error: workerError } = await supabase.from('worker_profiles').select('id').eq('profile_id', profileId).maybeSingle<{ id: string }>();
  if (workerError || !worker?.id) return { data: null as SalaryPolicy | null, error: workerError ?? new Error('Worker Identity is unavailable.') };
  return supabase.from('salary_policies').select('*').eq('worker_profile_id', worker.id).order('salary_start_date', { ascending: false }).limit(1).maybeSingle<SalaryPolicy>();
}

export async function saveSalaryPolicy(workerProfileId: string, input: SalaryPolicyInput) {
  return supabase.from('salary_policies').insert({ worker_profile_id: workerProfileId, ...input }).select('*').single<SalaryPolicy>();
}

export async function saveBonusPolicy(workerProfileId: string, input: { frequency: BonusFrequency; expected_month_count: number; amount_type: BonusAmountType; fixed_amount: number | null; effective_from: string }) {
  return supabase.from('salary_bonus_policies').insert({ worker_profile_id: workerProfileId, ...input }).select('*').single();
}

export async function saveAttendance(workerProfileId: string, attendanceDate: string, status: AttendanceStatus, note?: string, source: 'manual' | 'notification' = 'manual') {
  return supabase.from('salary_attendance_records').upsert({ worker_profile_id: workerProfileId, attendance_date: attendanceDate, status, note: note ?? null, source }, { onConflict: 'worker_profile_id,attendance_date' }).select('*').single();
}

export async function saveOvertime(workerProfileId: string, workDate: string, hours: number, note?: string) {
  const { data, error } = await supabase.rpc('record_salary_overtime', { p_work_date: workDate, p_hours: hours, p_note: note ?? null });
  return { data: data?.[0] ?? null, error };
}

export async function getSalaryMonthSummary(month: string) {
  const { data, error } = await supabase.rpc('get_salary_person_month_summary', { p_month: month });
  return { data: (data?.[0] ?? null) as SalaryMonthSummary | null, error };
}

export async function getFinalizedSalaryTotals(workerProfileId: string) {
  return supabase.from('salary_periods').select('base_salary,overtime_amount,adjustments,bonus_amount,final_amount').eq('worker_profile_id', workerProfileId).eq('status', 'finalized');
}

export type SalaryFinanceRecordType = 'payment' | 'advance' | 'other';

export interface SalaryFinanceRecord {
  id: string;
  worker_profile_id: string;
  entry_type: SalaryFinanceRecordType;
  amount: string | number;
  received_at: string;
  created_at: string;
  deleted_at: string | null;
}

export async function listSalaryFinanceRecords(profileId: string) {
  const { data: worker, error: workerError } = await supabase.from('worker_profiles').select('id').eq('profile_id', profileId).maybeSingle<{ id: string }>();
  if (workerError || !worker?.id) return { data: [] as SalaryFinanceRecord[], error: workerError ?? new Error('Worker Identity is unavailable.') };
  const result = await supabase.from('worker_finance_received').select('id,worker_profile_id,entry_type,amount,received_at,created_at,deleted_at').eq('worker_profile_id', worker.id).is('deleted_at', null).order('received_at', { ascending: false }).order('id', { ascending: false }).returns<SalaryFinanceRecord[]>();
  return { data: result.data ?? [], error: result.error };
}

export async function addSalaryFinanceRecord(profileId: string, entryType: SalaryFinanceRecordType, amount: string, receivedAt: string) {
  const { data: worker, error: workerError } = await supabase.from('worker_profiles').select('id').eq('profile_id', profileId).maybeSingle<{ id: string }>();
  if (workerError || !worker?.id) return { data: null, error: workerError ?? new Error('Worker Identity is unavailable.') };
  const result = await supabase.from('worker_finance_received').insert({ worker_profile_id: worker.id, entry_type: entryType, amount, received_at: receivedAt }).select('id,worker_profile_id,entry_type,amount,received_at,created_at,deleted_at').single<SalaryFinanceRecord>();
  return { data: result.data, error: result.error };
}
