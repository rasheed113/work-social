import { supabase } from '../../../lib/supabase/client';
import type { AttendanceStatus, SalaryMonthSummary, SalaryPolicy, SalaryPolicyInput, WorkerType } from '../types/salary';

export async function setWorkerType(workerProfileId: string, workerType: WorkerType) {
  return supabase.from('worker_profiles').update({ worker_type: workerType }).eq('id', workerProfileId).select('worker_type').single();
}

export async function getSalaryPolicy(workerProfileId: string) {
  return supabase.from('salary_policies').select('*').eq('worker_profile_id', workerProfileId).order('salary_start_date', { ascending: false }).limit(1).maybeSingle<SalaryPolicy>();
}

export async function saveSalaryPolicy(workerProfileId: string, input: SalaryPolicyInput) {
  return supabase.from('salary_policies').insert({ worker_profile_id: workerProfileId, ...input }).select('*').single<SalaryPolicy>();
}

export async function saveAttendance(workerProfileId: string, attendanceDate: string, status: AttendanceStatus, note?: string, source: 'manual' | 'notification' = 'manual') {
  return supabase.from('salary_attendance_records').upsert({ worker_profile_id: workerProfileId, attendance_date: attendanceDate, status, note: note ?? null, source }, { onConflict: 'worker_profile_id,attendance_date' }).select('*').single();
}

export async function saveOvertime(workerProfileId: string, workDate: string, hours: number, multiplier: 1 | 1.5 | 2, hourlyRate: number, amount: number, note?: string) {
  return supabase.from('salary_overtime_records').insert({ worker_profile_id: workerProfileId, work_date: workDate, hours, multiplier, hourly_rate: hourlyRate, amount, note: note ?? null }).select('*').single();
}

export async function getSalaryMonthSummary(month: string) {
  const { data, error } = await supabase.rpc('get_salary_person_month_summary', { p_month: month });
  return { data: (data?.[0] ?? null) as SalaryMonthSummary | null, error };
}
