import { useState } from 'react';
import { navigate } from '../../../app/Router';
import { useWorkerProfile } from '../hooks/useWorkerProfile';
import { saveSalaryPolicy } from '../api/salary';
import type { OvertimeMultiplier, SalaryPolicyInput, SalaryType } from '../types/salary';

const card = { padding: 18, border: '1px solid rgba(99,102,241,.14)', borderRadius: 18, background: 'rgba(255,255,255,.94)', boxShadow: '0 10px 28px rgba(15,23,42,.07)' };
const input = { width: '100%', boxSizing: 'border-box' as const, minHeight: 42, padding: '8px 11px', borderRadius: 10, border: '1px solid #cbd5e1', font: 'inherit' };

export function SalarySetupPage({ profileId }: { profileId: string }) {
  const { workerProfile, loading, error } = useWorkerProfile(profileId);
  const [showRules, setShowRules] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [salary, setSalary] = useState('');
  const [currency, setCurrency] = useState('PKR');
  const [salaryType, setSalaryType] = useState<SalaryType>('monthly');
  const [hours, setHours] = useState('8');
  const [ot, setOt] = useState<OvertimeMultiplier>(1.5);
  const [sundayPaid, setSundayPaid] = useState(false);
  const [holidaysPaid, setHolidaysPaid] = useState(false);
  const [notificationTime, setNotificationTime] = useState('');
  const [payDate, setPayDate] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [totalSalary, setTotalSalary] = useState('');
  const [basicSalary, setBasicSalary] = useState('');
  const [attendanceAllowance, setAttendanceAllowance] = useState('');
  const [otherAllowance, setOtherAllowance] = useState('');
  const [absentRule, setAbsentRule] = useState<'none' | 'daily_salary'>('none');
  const [absenceDeduction, setAbsenceDeduction] = useState('');
  const [allowanceLossRule, setAllowanceLossRule] = useState<'none' | 'threshold'>('none');
  const [allowanceThreshold, setAllowanceThreshold] = useState('');
  const [leaveTreatment, setLeaveTreatment] = useState<'paid' | 'unpaid'>('paid');
  const [note, setNote] = useState('');

  if (loading) return <main style={{ padding: 24 }}>Loading Salary Setup…</main>;
  if (error || !workerProfile) return <main style={{ padding: 24 }}><p role="alert">{error ?? 'Worker profile unavailable.'}</p></main>;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setMessage(''); setSaved(false);
    const amount = Number(salary);
    if (!Number.isFinite(amount) || amount <= 0) { setMessage('Enter a valid positive salary amount.'); return; }
    if (!startDate) { setMessage('Select a salary start date.'); return; }
    setSaving(true);
    const input: SalaryPolicyInput = {
      salary_amount: amount, currency: currency.trim().toUpperCase(), salary_type: salaryType,
      working_hours: hours ? Number(hours) : null, overtime_multiplier: ot, sunday_paid: sundayPaid,
      holidays_paid: holidaysPaid, attendance_notification_time: notificationTime || null,
      pay_date: payDate ? Number(payDate) : null, salary_start_date: startDate,
      total_salary: totalSalary ? Number(totalSalary) : null, basic_salary: basicSalary ? Number(basicSalary) : null,
      attendance_allowance: attendanceAllowance ? Number(attendanceAllowance) : null,
      other_allowance: otherAllowance ? Number(otherAllowance) : null, absent_rule: absentRule,
      salary_deduction_per_absent_day: absenceDeduction ? Number(absenceDeduction) : null,
      allowance_loss_rule: allowanceLossRule, allowance_loss_after_absences: allowanceThreshold ? Number(allowanceThreshold) : null,
      leave_treatment: leaveTreatment, custom_rule_note: note.trim() || null,
    };
    const result = await saveSalaryPolicy(workerProfile.id, input);
    setSaving(false);
    if (result.error) { setMessage(result.error.message); return; }
    setSaved(true);
  };

  if (saved) return <main style={{ width: '100%', maxWidth: 760, margin: '0 auto', padding: '24px 14px 112px', boxSizing: 'border-box' }}><section style={card}><h1 style={{ marginTop: 0 }}>Salary Setup Saved Successfully</h1><p>Thank you for setting up your salary information with Work Social.</p><ul><li><strong>Always add your overtime hours</strong> whenever you work overtime.</li><li><strong>Check your daily attendance notification</strong> and take the appropriate action.</li><li>Keep attendance and overtime information up to date for an accurate salary record.</li></ul><p>Your saved salary settings will be used for future salary and overtime calculations.</p><button type="button" onClick={() => navigate('/work/finance')} style={{ minHeight: 44, padding: '0 16px', borderRadius: 11, fontWeight: 800 }}>Got It</button></section></main>;

  return <main style={{ width: '100%', maxWidth: 760, margin: '0 auto', padding: '24px 14px 112px', boxSizing: 'border-box' }}>
    <button type="button" onClick={() => navigate('/work/identity')} style={{ minHeight: 38, padding: '0 11px', borderRadius: 10, fontWeight: 800 }}>← Work Identity</button>
    <header style={{ margin: '16px 0' }}><div style={{ color: '#64748b', fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>Salary Person</div><h1 style={{ margin: '5px 0 0' }}>Salary Setup</h1><p style={{ color: '#64748b', lineHeight: 1.5 }}>Set your salary policy once. You can keep optional salary rules empty when they do not apply.</p></header>
    <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
      <section style={card}><h2 style={{ marginTop: 0 }}>Your Salary Data Is Private</h2><p style={{ color: '#475569', lineHeight: 1.55 }}>Your salary information is used to maintain your personal salary, attendance, overtime, bonus, and salary records in Work Social. It is not intended for public Social display or sharing. Please review your salary details carefully before continuing.</p></section>
      <section style={{ ...card, display: 'grid', gap: 12 }}><h2 style={{ margin: 0 }}>Salary</h2><label>Salary Amount<input required type="number" min="0.01" step="0.01" value={salary} onChange={e => setSalary(e.target.value)} style={input}/></label><label>Currency<input required maxLength={10} value={currency} onChange={e => setCurrency(e.target.value)} style={input}/></label><label>Salary Type<select value={salaryType} onChange={e => setSalaryType(e.target.value as SalaryType)} style={input}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="15_days">15 Days</option><option value="monthly">Monthly</option></select></label><label>Working Hours<select value={hours} onChange={e => setHours(e.target.value)} style={input}><option value="8">8 hours</option><option value="12">12 hours</option><option value="">Optional / not set</option></select></label><label>Overtime Type<select value={ot} onChange={e => setOt(Number(e.target.value) as OvertimeMultiplier)} style={input}><option value="1">1×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></label></section>
      <section style={{ ...card, display: 'grid', gap: 12 }}><h2 style={{ margin: 0 }}>Work & Notifications</h2><label>Sunday Paid <select value={String(sundayPaid)} onChange={e => setSundayPaid(e.target.value === 'true')} style={input}><option value="true">Yes</option><option value="false">No</option></select></label><label>Holidays Paid <select value={String(holidaysPaid)} onChange={e => setHolidaysPaid(e.target.value === 'true')} style={input}><option value="true">Yes</option><option value="false">No</option></select></label><label>Attendance Notification Time<input type="time" value={notificationTime} onChange={e => setNotificationTime(e.target.value)} style={input}/><small style={{ color: '#64748b' }}>Leave empty for no attendance notification.</small></label><label>Pay Date (notification only)<input type="number" min="1" max="31" value={payDate} onChange={e => setPayDate(e.target.value)} placeholder="Optional" style={input}/></label><label>Salary Start Date<input required type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={input}/></label></section>
      <section style={card}><button type="button" onClick={() => setShowRules(v => !v)} style={{ width: '100%', textAlign: 'left', minHeight: 44, border: 0, background: 'transparent', fontWeight: 900, cursor: 'pointer' }}>{showRules ? '−' : '＋'} Additional Salary Rules (Optional)</button>{showRules && <div style={{ display: 'grid', gap: 12, marginTop: 14 }}><label>Total Salary<input type="number" min="0" step="0.01" value={totalSalary} onChange={e => setTotalSalary(e.target.value)} style={input}/></label><label>Basic Salary<input type="number" min="0" step="0.01" value={basicSalary} onChange={e => setBasicSalary(e.target.value)} style={input}/></label><label>Attendance Allowance<input type="number" min="0" step="0.01" value={attendanceAllowance} onChange={e => setAttendanceAllowance(e.target.value)} style={input}/></label><label>Other Allowance<input type="number" min="0" step="0.01" value={otherAllowance} onChange={e => setOtherAllowance(e.target.value)} style={input}/></label><label>Absent Rule<select value={absentRule} onChange={e => setAbsentRule(e.target.value as 'none'|'daily_salary')} style={input}><option value="none">No absence deduction</option><option value="daily_salary">Daily salary deduction</option></select></label>{absentRule === 'daily_salary' && <label>Salary deduction per absent day<input type="number" min="0" step="0.01" value={absenceDeduction} onChange={e => setAbsenceDeduction(e.target.value)} style={input}/></label>}<label>Allowance-loss rule<select value={allowanceLossRule} onChange={e => setAllowanceLossRule(e.target.value as 'none'|'threshold')} style={input}><option value="none">No allowance loss</option><option value="threshold">Loss after X absences</option></select></label>{allowanceLossRule === 'threshold' && <label>Allowance loss after X absences<input type="number" min="1" step="1" value={allowanceThreshold} onChange={e => setAllowanceThreshold(e.target.value)} style={input}/></label>}<label>Leave treatment<select value={leaveTreatment} onChange={e => setLeaveTreatment(e.target.value as 'paid'|'unpaid')} style={input}><option value="paid">Paid</option><option value="unpaid">Unpaid</option></select></label><label>Custom salary rule / note<textarea rows={4} value={note} onChange={e => setNote(e.target.value)} style={{ ...input, resize: 'vertical' }}/></label></div>}</section>
      {message && <p role="alert" style={{ margin: 0 }}>{message}</p>}
      <button type="submit" disabled={saving} style={{ minHeight: 48, borderRadius: 12, fontWeight: 900 }}>{saving ? 'Saving Salary Setup…' : 'Save Salary Setup'}</button>
    </form>
  </main>;
}
