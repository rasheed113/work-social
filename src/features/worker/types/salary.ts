export type WorkerType = 'salary_person' | 'contract';
export type SalaryType = 'daily' | 'weekly' | '15_days' | 'monthly';
export type AttendanceStatus = 'present' | 'absent' | 'leave';
export type OvertimeMultiplier = 1 | 1.5 | 2;
export type BonusFrequency = 'yearly' | '6_months' | '3_months' | 'custom';
export type BonusAmountType = 'half_salary' | 'full_salary' | 'fixed_amount';

export interface SalaryPolicyInput {
  salary_amount: number;
  currency: string;
  salary_type: SalaryType;
  working_hours: number | null;
  overtime_multiplier: OvertimeMultiplier;
  sunday_paid: boolean;
  holidays_paid: boolean;
  attendance_notification_time: string | null;
  pay_date: number | null;
  salary_start_date: string;
  total_salary: number | null;
  basic_salary: number | null;
  attendance_allowance: number | null;
  other_allowance: number | null;
  absent_rule: 'none' | 'daily_salary' | null;
  salary_deduction_per_absent_day: number | null;
  allowance_loss_rule: 'none' | 'threshold' | null;
  allowance_loss_after_absences: number | null;
  leave_treatment: 'paid' | 'unpaid' | null;
  custom_rule_note: string | null;
}

export interface SalaryPolicy extends SalaryPolicyInput {
  id: string;
  worker_profile_id: string;
  effective_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalaryMonthSummary {
  month_start: string;
  month_end: string;
  base_salary: number;
  overtime_hours: number;
  overtime_amount: number;
  adjustments: number;
  bonus_amount: number;
  present_days: number;
  absent_days: number;
  leave_days: number;
  paid_days: number;
  attendance_percentage: number;
  final_salary: number;
}
